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

// ─── Redis Backend (when UPSTASH env vars are set) ──────────────────────────

let redisClient = null;
let Ratelimit = null;

const USE_REDIS = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

if (USE_REDIS) {
    try {
        const redisMod = await import('@upstash/redis');
        const ratelimitMod = await import('@upstash/ratelimit');
        Ratelimit = ratelimitMod.Ratelimit;
        redisClient = new redisMod.Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        console.log('[rate-limit] Redis backend active (Upstash)');
    } catch (err) {
        console.warn('[rate-limit] Failed to load Redis modules, falling back to in-memory:', err.message);
    }
}

/**
 * Creates an Upstash Ratelimit instance with sliding window algorithm.
 * Falls back to null if Redis isn't available.
 */
function createRedisLimiter(maxRequests, windowMs) {
    if (!Ratelimit || !redisClient) return null;
    return new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(maxRequests, `${windowMs} ms`),
        analytics: false,
        prefix: 'rbl', // rate-limit
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

// Chat session limiter: 20 requests per minute per session ID
const CHAT_WINDOW_MS = 60_000;
const CHAT_MAX = 20;
const chatRedis = createRedisLimiter(CHAT_MAX, CHAT_WINDOW_MS);
const chatMemory = createInMemoryLimiter(CHAT_MAX, CHAT_WINDOW_MS);

// Login limiter: 5 attempts per 15 minutes per IP
const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX = 5;
const loginRedis = createRedisLimiter(LOGIN_MAX, LOGIN_WINDOW_MS);
const loginMemory = createInMemoryLimiter(LOGIN_MAX, LOGIN_WINDOW_MS);

// Booking limiter: 5 requests per minute per IP
const BOOKING_WINDOW_MS = 60_000;
const BOOKING_MAX = 5;
const bookingRedis = createRedisLimiter(BOOKING_MAX, BOOKING_WINDOW_MS);
const bookingMemory = createInMemoryLimiter(BOOKING_MAX, BOOKING_WINDOW_MS);

// Chat IP backstop: 30 requests per minute per IP
const CHAT_IP_WINDOW_MS = 60_000;
const CHAT_IP_MAX = 30;
const chatIpRedis = createRedisLimiter(CHAT_IP_MAX, CHAT_IP_WINDOW_MS);
const chatIpMemory = createInMemoryLimiter(CHAT_IP_MAX, CHAT_IP_WINDOW_MS);

// Webhook limiter: 60 requests per minute per IP
const WEBHOOK_WINDOW_MS = 60_000;
const WEBHOOK_MAX = 60;
const webhookRedis = createRedisLimiter(WEBHOOK_MAX, WEBHOOK_WINDOW_MS);
const webhookMemory = createInMemoryLimiter(WEBHOOK_MAX, WEBHOOK_WINDOW_MS);

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Chat session rate limiter: 20 requests per minute per session.
 * Returns null if allowed, { retryAfterMs, retryAfterSec } if blocked.
 */
export async function checkRateLimit(sessionId) {
    if (chatRedis) {
        const result = await chatRedis.limit(sessionId);
        return upstashResult(result, CHAT_WINDOW_MS);
    }
    return chatMemory.check(sessionId);
}

/**
 * Login rate limiter: 5 attempts per 15 minutes per IP.
 */
export async function checkLoginRateLimit(ip) {
    if (loginRedis) {
        const result = await loginRedis.limit(ip);
        return upstashResult(result, LOGIN_WINDOW_MS);
    }
    return loginMemory.check(ip);
}

/**
 * Booking rate limiter: 5 requests per minute per IP.
 */
export async function checkBookingRateLimit(ip) {
    if (bookingRedis) {
        const result = await bookingRedis.limit(ip);
        return upstashResult(result, BOOKING_WINDOW_MS);
    }
    return bookingMemory.check(ip);
}

/**
 * Chat IP backstop: 30 requests per minute per IP.
 * Catches attackers who bypass session limiter by generating new session IDs.
 */
export async function checkChatIpRateLimit(ip) {
    if (chatIpRedis) {
        const result = await chatIpRedis.limit(ip);
        return upstashResult(result, CHAT_IP_WINDOW_MS);
    }
    return chatIpMemory.check(ip);
}

/**
 * Webhook rate limiter: 60 requests per minute per IP.
 * For external webhooks (Meta, Google, Jobber) that send delivery receipts.
 */
export async function checkWebhookRateLimit(ip) {
    if (webhookRedis) {
        const result = await webhookRedis.limit(ip);
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
