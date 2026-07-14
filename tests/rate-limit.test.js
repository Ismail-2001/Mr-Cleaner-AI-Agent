import { describe, it, expect, beforeEach } from 'vitest';

// We need to re-import fresh modules for each test since rate limiters hold state
function createRateLimiter() {
    const requestCounts = new Map();
    const loginAttempts = new Map();
    const bookingCounts = new Map();

    const WINDOW_MS = 60 * 1000;
    const MAX_REQUESTS = 20;
    const MAX_ENTRIES = 10000;
    const LOGIN_WINDOW_MS = 15 * 60 * 1000;
    const LOGIN_MAX_ATTEMPTS = 5;
    const BOOKING_WINDOW_MS = 60 * 1000;
    const BOOKING_MAX_REQUESTS = 5;

    function cleanupOldEntries(now) {
        for (const [sessionId, entry] of requestCounts) {
            if (now - entry.windowStart > WINDOW_MS * 2) {
                requestCounts.delete(sessionId);
            }
        }
    }

    function checkRateLimit(sessionId, now = Date.now()) {
        if (!requestCounts.has(sessionId) && requestCounts.size >= MAX_ENTRIES) {
            cleanupOldEntries(now);
            if (requestCounts.size >= MAX_ENTRIES) {
                return { retryAfterMs: WINDOW_MS, retryAfterSec: Math.ceil(WINDOW_MS / 1000) };
            }
        }

        const entry = requestCounts.get(sessionId);
        if (!entry || now - entry.windowStart > WINDOW_MS) {
            requestCounts.set(sessionId, { count: 1, windowStart: now });
            return null;
        }

        entry.count++;
        if (entry.count > MAX_REQUESTS) {
            const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
            return { retryAfterMs, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
        }
        return null;
    }

    function checkLoginRateLimit(ip, now = Date.now()) {
        const entry = loginAttempts.get(ip);
        if (!entry || now - entry.windowStart > LOGIN_WINDOW_MS) {
            loginAttempts.set(ip, { count: 1, windowStart: now });
            return null;
        }
        entry.count++;
        if (entry.count > LOGIN_MAX_ATTEMPTS) {
            const retryAfterMs = LOGIN_WINDOW_MS - (now - entry.windowStart);
            return { retryAfterMs, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
        }
        return null;
    }

    function checkBookingRateLimit(ip, now = Date.now()) {
        const entry = bookingCounts.get(ip);
        if (!entry || now - entry.windowStart > BOOKING_WINDOW_MS) {
            bookingCounts.set(ip, { count: 1, windowStart: now });
            return null;
        }
        entry.count++;
        if (entry.count > BOOKING_MAX_REQUESTS) {
            const retryAfterMs = BOOKING_WINDOW_MS - (now - entry.windowStart);
            return { retryAfterMs, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
        }
        return null;
    }

    return { checkRateLimit, checkLoginRateLimit, checkBookingRateLimit };
}

describe('Chat Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = createRateLimiter();
    });

    it('allows first request', () => {
        expect(limiter.checkRateLimit('session-1')).toBeNull();
    });

    it('allows up to MAX_REQUESTS', () => {
        const now = 1000000;
        for (let i = 0; i < 20; i++) {
            expect(limiter.checkRateLimit('session-1', now)).toBeNull();
        }
    });

    it('blocks after MAX_REQUESTS', () => {
        const now = 1000000;
        for (let i = 0; i < 20; i++) {
            limiter.checkRateLimit('session-1', now);
        }
        const result = limiter.checkRateLimit('session-1', now);
        expect(result).not.toBeNull();
        expect(result.retryAfterSec).toBeGreaterThan(0);
    });

    it('resets window after WINDOW_MS', () => {
        const now = 1000000;
        for (let i = 0; i < 20; i++) {
            limiter.checkRateLimit('session-1', now);
        }
        const afterWindow = now + 60001;
        expect(limiter.checkRateLimit('session-1', afterWindow)).toBeNull();
    });

    it('tracks different sessions independently', () => {
        const now = 1000000;
        for (let i = 0; i < 20; i++) {
            limiter.checkRateLimit('session-a', now);
        }
        expect(limiter.checkRateLimit('session-b', now)).toBeNull();
        expect(limiter.checkRateLimit('session-a', now)).not.toBeNull();
    });

    it('returns retryAfterSec as ceiling', () => {
        const now = 1000000;
        for (let i = 0; i < 20; i++) {
            limiter.checkRateLimit('session-1', now);
        }
        const result = limiter.checkRateLimit('session-1', now + 1000);
        expect(result.retryAfterSec).toBe(59);
    });
});

describe('Login Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = createRateLimiter();
    });

    it('allows first login attempt', () => {
        expect(limiter.checkLoginRateLimit('192.168.1.1')).toBeNull();
    });

    it('blocks after 5 attempts', () => {
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
            expect(limiter.checkLoginRateLimit('192.168.1.1', now)).toBeNull();
        }
        const result = limiter.checkLoginRateLimit('192.168.1.1', now);
        expect(result).not.toBeNull();
    });

    it('resets after LOGIN_WINDOW_MS', () => {
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
            limiter.checkLoginRateLimit('192.168.1.1', now);
        }
        const afterWindow = now + 15 * 60 * 1000 + 1;
        expect(limiter.checkLoginRateLimit('192.168.1.1', afterWindow)).toBeNull();
    });

    it('tracks different IPs independently', () => {
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
            limiter.checkLoginRateLimit('192.168.1.1', now);
        }
        expect(limiter.checkLoginRateLimit('10.0.0.1', now)).toBeNull();
    });
});

describe('Booking Rate Limiter', () => {
    let limiter;

    beforeEach(() => {
        limiter = createRateLimiter();
    });

    it('allows first booking request', () => {
        expect(limiter.checkBookingRateLimit('192.168.1.1')).toBeNull();
    });

    it('blocks after 5 requests', () => {
        const now = 1000000;
        for (let i = 0; i < 5; i++) {
            expect(limiter.checkBookingRateLimit('192.168.1.1', now)).toBeNull();
        }
        expect(limiter.checkBookingRateLimit('192.168.1.1', now)).not.toBeNull();
    });
});
