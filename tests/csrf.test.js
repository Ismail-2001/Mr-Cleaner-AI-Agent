import { describe, it, expect, beforeAll } from 'vitest';

process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

const ALLOWED_ORIGINS = [
    'https://example.com',
    'http://localhost:3000',
    'http://localhost:3001',
].filter(Boolean);

function validateCsrf(request) {
    const url = new URL(request.url);
    if (url.pathname === '/api/stripe/webhook') return null;
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
        return null;
    }

    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');

    if (origin) {
        try {
            const originUrl = new URL(origin);
            const isAllowed = ALLOWED_ORIGINS.some(allowed => {
                const allowedUrl = new URL(allowed);
                return originUrl.hostname === allowedUrl.hostname;
            });
            if (!isAllowed) {
                return { status: 403, code: 'CSRF_REJECTED' };
            }
            return null;
        } catch {
            return { status: 403, code: 'CSRF_REJECTED' };
        }
    }

    if (referer) {
        try {
            const refererUrl = new URL(referer);
            const isAllowed = ALLOWED_ORIGINS.some(allowed => {
                const allowedUrl = new URL(allowed);
                return refererUrl.hostname === allowedUrl.hostname;
            });
            if (!isAllowed) {
                return { status: 403, code: 'CSRF_REJECTED' };
            }
            return null;
        } catch {
            return { status: 403, code: 'CSRF_REJECTED' };
        }
    }

    return null;
}

function makeRequest(method, pathname, origin, referer) {
    const headers = new Map();
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    return {
        method,
        url: `https://example.com${pathname}`,
        headers: {
            get: (name) => headers.get(name),
        },
    };
}

describe('CSRF Protection', () => {
    it('allows GET requests without origin check', () => {
        const req = makeRequest('GET', '/api/bookings');
        expect(validateCsrf(req)).toBeNull();
    });

    it('allows HEAD requests', () => {
        const req = makeRequest('HEAD', '/api/bookings');
        expect(validateCsrf(req)).toBeNull();
    });

    it('allows OPTIONS requests', () => {
        const req = makeRequest('OPTIONS', '/api/bookings');
        expect(validateCsrf(req)).toBeNull();
    });

    it('allows POST from allowed origin', () => {
        const req = makeRequest('POST', '/api/bookings', 'https://example.com');
        expect(validateCsrf(req)).toBeNull();
    });

    it('rejects POST from unknown origin', () => {
        const req = makeRequest('POST', '/api/bookings', 'https://evil.com');
        const result = validateCsrf(req);
        expect(result).not.toBeNull();
        expect(result.status).toBe(403);
    });

    it('allows POST from localhost:3000', () => {
        const req = makeRequest('POST', '/api/bookings', 'http://localhost:3000');
        expect(validateCsrf(req)).toBeNull();
    });

    it('allows POST from localhost:3001', () => {
        const req = makeRequest('POST', '/api/bookings', 'http://localhost:3001');
        expect(validateCsrf(req)).toBeNull();
    });

    it('allows POST from localhost:3002 (hostname matches allowed origins)', () => {
        const req = makeRequest('POST', '/api/bookings', 'http://localhost:3002');
        expect(validateCsrf(req)).toBeNull();
    });

    it('falls back to Referer when Origin is missing', () => {
        const req = makeRequest('POST', '/api/bookings', null, 'https://example.com/login');
        expect(validateCsrf(req)).toBeNull();
    });

    it('rejects bad Referer', () => {
        const req = makeRequest('POST', '/api/bookings', null, 'https://evil.com');
        const result = validateCsrf(req);
        expect(result).not.toBeNull();
    });

    it('allows POST when no Origin or Referer (direct API call)', () => {
        const req = makeRequest('POST', '/api/bookings');
        expect(validateCsrf(req)).toBeNull();
    });

    it('skips CSRF for Stripe webhook', () => {
        const req = makeRequest('POST', '/api/stripe/webhook', 'https://evil.com');
        expect(validateCsrf(req)).toBeNull();
    });

    it('compares hostname only, not full URL', () => {
        const req = makeRequest('POST', '/api/bookings', 'https://example.com:3000');
        expect(validateCsrf(req)).toBeNull();
    });
});
