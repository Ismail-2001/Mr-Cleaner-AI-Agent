/**
 * Rate limiter with Redis (Upstash/Vercel KV) primary and in-memory fallback.
 *
 * WHY REDIS: Vercel serverless functions are ephemeral — in-memory Maps reset
 * on cold start and don't share state across instances. Redis gives persistent,
 * cross-instance rate limiting. When Redis isn't configured (local dev, CI),
 * the in-memory fallback keeps things working.
 *
 * The public API is identical regardless of backend:
 *   checkRateLimit(sessionId)      → chat requests/session (20/min)
 *   checkLoginRateLimit(ip)        → dashboard login (5/15min)
 *   checkBookingRateLimit(ip)      → booking creation (5/min)
 *   checkChatIpRateLimit(ip)       → chat requests/IP backstop (30/min)
 *   checkWebhookRateLimit(ip)      → external webhooks (60/min)
 */

// ─── Redis Backend (shared client from lib/redis.js) ────────────────────────

import { tryRedisOp } from './redis.js';

let Ratelimit = null;
let redisReady = false;

const USE_REDIS = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

async function ensureRedis() {
    if (redisReady || !USE_REDIS) return;
    try {
        const ratelimitMod = await import('@upstash/ratelimit');
        Ratelimit = ratelimitMod.Ratelimit;
        redisReady = true;
        console.log('[rate-limit] Redis backend active (Upstash)');
    } catch (err) {
        console.warn('[rate-limit] Failed to load Redis modules, falling back to in-memory:', err.message);
        redisReady = true; // Mark as ready even on failure to avoid retrying
    }
}

/**
 * Creates an Upstash Ratelimit instance with sliding window algorithm.
 * Falls back to null if Redis isn't available.
 */
async function createRedisLimiter(maxRequests, windowMs) {
    await ensureRedis();
    if (!Ratelimit) return null;
    const redisClient = await tryRedisOp(client => client);
    if (!redisClient) return null;
    return new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
        analytics: false,
        prefix: 'rbl',
    });
}

/**
 * Converts Upstash result to our standard { retryAfterMs, retryAfterSec } | null format.
 */
function upstashResult(result, windowMs) {
    if (result.success) return null;
    // Upstash returns `reset` as a unix timestamp (seconds) when the window resets
    const resetMs = typeof result.reset === 'number'
        ? (result.reset * 1000) - Date.now()
        : windowMs;
    return {
        retryAfterMs: Math.max(0, resetMs),
        retryAfterSec: Math.ceil(Math.max(0, resetMs) / 1000),
    };
}

// ─── In-Memory Backend (fallback) ────────────────────────────────────────────

function createInMemoryLimiter(maxRequests, windowMs) {
    const store = new Map();
    const MAX_ENTRIES = 10000;

    function cleanup(now) {
        for (const [key, entry] of store) {
            if (now - entry.windowStart > windowMs * 2) store.delete(key);
        }
    }

    function check(key, now = Date.now()) {
        if (!store.has(key) && store.size >= MAX_ENTRIES) {
            cleanup(now);
            if (store.size >= MAX_ENTRIES) {
                return { retryAfterMs: windowMs, retryAfterSec: Math.ceil(windowMs / 1000) };
            }
        }

        const entry = store.get(key);
        if (!entry || now - entry.windowStart > windowMs) {
            store.set(key, { count: 1, windowStart: now });
            return null;
        }

        entry.count++;
        if (entry.count > maxRequests) {
            const retryAfterMs = windowMs - (now - entry.windowStart);
            return {
                retryAfterMs,
                retryAfterSec: Math.ceil(retryAfterMs / 1000),
            };
        }
        return null;
    }

    return { check, store };
}

// ─── Rate Limiter Instances ──────────────────────────────────────────────────

// Constants only — no module-level async work
const CHAT_WINDOW_MS = 60_000;
const CHAT_MAX = 20;
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX = 5;
const BOOKING_WINDOW_MS = 60_000;
const BOOKING_MAX = 5;
const CHAT_IP_WINDOW_MS = 60_000;
const CHAT_IP_MAX = 30;
const WEBHOOK_WINDOW_MS = 60_000;
const WEBHOOK_MAX = 60;

// In-memory limiters (created immediately — no async)
const chatMemory = createInMemoryLimiter(CHAT_MAX, CHAT_WINDOW_MS);
const loginMemory = createInMemoryLimiter(LOGIN_MAX, LOGIN_WINDOW_MS);
const bookingMemory = createInMemoryLimiter(BOOKING_MAX, BOOKING_WINDOW_MS);
const chatIpMemory = createInMemoryLimiter(CHAT_IP_MAX, CHAT_IP_WINDOW_MS);
const webhookMemory = createInMemoryLimiter(WEBHOOK_MAX, WEBHOOK_WINDOW_MS);

// Redis limiters (lazy — created on first use)
let chatRedisLimiter = null;
let loginRedisLimiter = null;
let bookingRedisLimiter = null;
let chatIpRedisLimiter = null;
let webhookRedisLimiter = null;

async function getChatRedis() {
    if (USE_REDIS && !chatRedisLimiter) chatRedisLimiter = await createRedisLimiter(CHAT_MAX, CHAT_WINDOW_MS);
    return chatRedisLimiter;
}
async function getLoginRedis() {
    if (USE_REDIS && !loginRedisLimiter) loginRedisLimiter = await createRedisLimiter(LOGIN_MAX, LOGIN_WINDOW_MS);
    return loginRedisLimiter;
}
async function getBookingRedis() {
    if (USE_REDIS && !bookingRedisLimiter) bookingRedisLimiter = await createRedisLimiter(BOOKING_MAX, BOOKING_WINDOW_MS);
    return bookingRedisLimiter;
}
async function getChatIpRedis() {
    if (USE_REDIS && !chatIpRedisLimiter) chatIpRedisLimiter = await createRedisLimiter(CHAT_IP_MAX, CHAT_IP_WINDOW_MS);
    return chatIpRedisLimiter;
}
async function getWebhookRedis() {
    if (USE_REDIS && !webhookRedisLimiter) webhookRedisLimiter = await createRedisLimiter(WEBHOOK_MAX, WEBHOOK_WINDOW_MS);
    return webhookRedisLimiter;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Chat session rate limiter: 20 requests per minute per session.
 * Returns null if allowed, { retryAfterMs, retryAfterSec } if blocked.
 */
export async function checkRateLimit(sessionId) {
    const redisLimiter = await getChatRedis();
    if (redisLimiter) {
        const result = await redisLimiter.limit(sessionId);
        return upstashResult(result, CHAT_WINDOW_MS);
    }
    return chatMemory.check(sessionId);
}

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP.
 */
export async function checkLoginRateLimit(ip) {
    const redisLimiter = await getLoginRedis();
    if (redisLimiter) {
        const result = await redisLimiter.limit(ip);
        return upstashResult(result, LOGIN_WINDOW_MS);
    }
    return loginMemory.check(ip);
}

/**
 * Booking rate limiter: 5 requests per minute per IP.
 */
export async function checkBookingRateLimit(ip) {
    const redisLimiter = await getBookingRedis();
    if (redisLimiter) {
        const result = await redisLimiter.limit(ip);
        return upstashResult(result, BOOKING_WINDOW_MS);
    }
    return bookingMemory.check(ip);
}

/**
 * Chat IP backstop: 30 requests per minute per IP.
 * Catches attackers who bypass session limiter by generating new session IDs.
 */
export async function checkChatIpRateLimit(ip) {
    const redisLimiter = await getChatIpRedis();
    if (redisLimiter) {
        const result = await redisLimiter.limit(ip);
        return upstashResult(result, CHAT_IP_WINDOW_MS);
    }
    return chatIpMemory.check(ip);
}

/**
 * Webhook rate limiter: 60 requests per minute per IP.
 * For external webhooks (Meta, Google, Jobber) that send delivery receipts.
 */
export async function checkWebhookRateLimit(ip) {
    const redisLimiter = await getWebhookRedis();
    if (redisLimiter) {
        const result = await redisLimiter.limit(ip);
        return upstashResult(result, WEBHOOK_WINDOW_MS);
    }
    return webhookMemory.check(ip);
}

/**
 * Reset in-memory stores (for tests only).
 */
export function resetRateLimiters() {
    chatMemory.store.clear();
    loginMemory.store.clear();
    bookingMemory.store.clear();
    chatIpMemory.store.clear();
    webhookMemory.store.clear();
}
