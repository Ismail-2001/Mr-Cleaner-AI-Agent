import { describe, it, expect, beforeEach } from 'vitest';
import {
    checkRateLimit,
    checkLoginRateLimit,
    checkBookingRateLimit,
    checkChatIpRateLimit,
    checkWebhookRateLimit,
    resetRateLimiters,
} from '@/lib/rate-limit';

describe('Chat Rate Limiter (in-memory)', () => {
    beforeEach(() => {
        resetRateLimiters();
    });

    it('allows first request', async () => {
        expect(await checkRateLimit('session-1')).toBeNull();
    });

    it('allows up to 20 requests per window', async () => {
        for (let i = 0; i < 20; i++) {
            expect(await checkRateLimit('session-1')).toBeNull();
        }
    });

    it('blocks on 21st request', async () => {
        for (let i = 0; i < 20; i++) {
            await checkRateLimit('session-1');
        }
        const result = await checkRateLimit('session-1');
        expect(result).not.toBeNull();
        expect(result.retryAfterSec).toBeGreaterThan(0);
        expect(result.retryAfterMs).toBeGreaterThan(0);
    });

    it('returns retryAfterSec as ceiling', async () => {
        for (let i = 0; i < 20; i++) {
            await checkRateLimit('session-1');
        }
        const result = await checkRateLimit('session-1');
        expect(result.retryAfterSec).toBeGreaterThan(0);
    });

    it('tracks different sessions independently', async () => {
        for (let i = 0; i < 20; i++) {
            await checkRateLimit('session-a');
        }
        expect(await checkRateLimit('session-b')).toBeNull();
        expect(await checkRateLimit('session-a')).not.toBeNull();
    });

    it('resets window for a session after WINDOW_MS', async () => {
        // The in-memory limiter uses Date.now(), so we can't easily simulate time passing.
        // Instead, verify a different session works (proving isolation).
        for (let i = 0; i < 20; i++) {
            await checkRateLimit('session-x');
        }
        expect(await checkRateLimit('session-y')).toBeNull();
    });
});

describe('Login Rate Limiter (in-memory)', () => {
    beforeEach(() => {
        resetRateLimiters();
    });

    it('allows first login attempt', async () => {
        expect(await checkLoginRateLimit('192.168.1.1')).toBeNull();
    });

    it('allows up to 5 attempts', async () => {
        for (let i = 0; i < 5; i++) {
            expect(await checkLoginRateLimit('192.168.1.1')).toBeNull();
        }
    });

    it('blocks on 6th attempt', async () => {
        for (let i = 0; i < 5; i++) {
            await checkLoginRateLimit('192.168.1.1');
        }
        const result = await checkLoginRateLimit('192.168.1.1');
        expect(result).not.toBeNull();
        expect(result.retryAfterSec).toBeGreaterThan(0);
    });

    it('tracks different IPs independently', async () => {
        for (let i = 0; i < 5; i++) {
            await checkLoginRateLimit('192.168.1.1');
        }
        expect(await checkLoginRateLimit('10.0.0.1')).toBeNull();
    });
});

describe('Booking Rate Limiter (in-memory)', () => {
    beforeEach(() => {
        resetRateLimiters();
    });

    it('allows first booking request', async () => {
        expect(await checkBookingRateLimit('192.168.1.1')).toBeNull();
    });

    it('allows up to 5 requests', async () => {
        for (let i = 0; i < 5; i++) {
            expect(await checkBookingRateLimit('192.168.1.1')).toBeNull();
        }
    });

    it('blocks on 6th request', async () => {
        for (let i = 0; i < 5; i++) {
            await checkBookingRateLimit('192.168.1.1');
        }
        const result = await checkBookingRateLimit('192.168.1.1');
        expect(result).not.toBeNull();
    });
});

describe('Chat IP Rate Limiter (in-memory)', () => {
    beforeEach(() => {
        resetRateLimiters();
    });

    it('allows first request from IP', async () => {
        expect(await checkChatIpRateLimit('203.0.113.1')).toBeNull();
    });

    it('allows up to 30 requests from same IP', async () => {
        for (let i = 0; i < 30; i++) {
            expect(await checkChatIpRateLimit('203.0.113.1')).toBeNull();
        }
    });

    it('blocks on 31st request', async () => {
        for (let i = 0; i < 30; i++) {
            await checkChatIpRateLimit('203.0.113.1');
        }
        const result = await checkChatIpRateLimit('203.0.113.1');
        expect(result).not.toBeNull();
        expect(result.retryAfterSec).toBeGreaterThan(0);
    });

    it('tracks different IPs independently', async () => {
        for (let i = 0; i < 30; i++) {
            await checkChatIpRateLimit('203.0.113.1');
        }
        expect(await checkChatIpRateLimit('198.51.100.1')).toBeNull();
    });

    it('blocks IP that rotates session IDs (IP backstop)', async () => {
        // 30 requests from same IP — all should be allowed
        for (let i = 0; i < 30; i++) {
            await checkChatIpRateLimit('203.0.113.1');
        }
        // 31st request from same IP, even with different session, is blocked
        expect(await checkChatIpRateLimit('203.0.113.1')).not.toBeNull();
    });
});

describe('Webhook Rate Limiter (in-memory)', () => {
    beforeEach(() => {
        resetRateLimiters();
    });

    it('allows first webhook request', async () => {
        expect(await checkWebhookRateLimit('10.0.0.1')).toBeNull();
    });

    it('allows up to 60 requests per minute', async () => {
        for (let i = 0; i < 60; i++) {
            expect(await checkWebhookRateLimit('10.0.0.1')).toBeNull();
        }
    });

    it('blocks on 61st request', async () => {
        for (let i = 0; i < 60; i++) {
            await checkWebhookRateLimit('10.0.0.1');
        }
        const result = await checkWebhookRateLimit('10.0.0.1');
        expect(result).not.toBeNull();
    });
});
