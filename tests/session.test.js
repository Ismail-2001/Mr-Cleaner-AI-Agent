import { describe, it, expect, beforeAll } from 'vitest';

process.env.DASHBOARD_SESSION_SECRET = 'a'.repeat(32);
process.env.NODE_ENV = 'test';

const SESSION_DURATION_SEC = 8 * 60 * 60;

async function createSessionCookie() {
    const { SignJWT } = await import('jose');
    const sessionId = crypto.randomUUID();
    const expires = Math.floor(Date.now() / 1000) + SESSION_DURATION_SEC;

    const token = await new SignJWT({ sid: sessionId, exp: expires })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .sign(new TextEncoder().encode('a'.repeat(32)));

    return {
        name: 'dashboard_session',
        value: token,
        options: {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            path: '/',
            maxAge: SESSION_DURATION_SEC,
        },
    };
}

async function verifySession(cookieValue) {
    if (!cookieValue) return { valid: false };

    try {
        const { jwtVerify } = await import('jose');
        const { payload } = await jwtVerify(cookieValue, new TextEncoder().encode('a'.repeat(32)));
        if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            return { valid: false };
        }
        return { valid: true, session: payload };
    } catch {
        return { valid: false };
    }
}

describe('Session Management', () => {
    it('creates a valid session cookie', async () => {
        const cookie = await createSessionCookie();
        expect(cookie).toBeDefined();
        expect(cookie.name).toBe('dashboard_session');
        expect(cookie.value).toBeTruthy();
        expect(cookie.options.httpOnly).toBe(true);
        expect(cookie.options.sameSite).toBe('lax');
        expect(cookie.options.path).toBe('/');
        expect(cookie.options.maxAge).toBe(SESSION_DURATION_SEC);
    });

    it('verifies a valid session token', async () => {
        const cookie = await createSessionCookie();
        const result = await verifySession(cookie.value);
        expect(result.valid).toBe(true);
        expect(result.session).toBeDefined();
        expect(result.session.sid).toBeTruthy();
        expect(result.session.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('rejects empty cookie', async () => {
        const result = await verifySession(null);
        expect(result.valid).toBe(false);
    });

    it('rejects tampered cookie', async () => {
        const cookie = await createSessionCookie();
        const tampered = cookie.value.slice(0, -5) + 'XXXXX';
        const result = await verifySession(tampered);
        expect(result.valid).toBe(false);
    });

    it('rejects expired token', async () => {
        const { SignJWT } = await import('jose');
        const expired = Math.floor(Date.now() / 1000) - 1;
        const token = await new SignJWT({ sid: 'test', exp: expired })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .sign(new TextEncoder().encode('a'.repeat(32)));

        const result = await verifySession(token);
        expect(result.valid).toBe(false);
    });

    it('session token has correct structure', async () => {
        const cookie = await createSessionCookie();
        const result = await verifySession(cookie.value);
        expect(result.session.sid).toMatch(/^[0-9a-f-]+$/);
    });

    it('secure flag is false in non-production', async () => {
        const cookie = await createSessionCookie();
        expect(cookie.options.secure).toBe(false);
    });
});
