import { describe, it, expect, beforeEach, vi } from 'vitest';

const CRITICAL_VARS = [
    { name: 'DASHBOARD_PASSWORD', description: 'Dashboard login password' },
    { name: 'DASHBOARD_SESSION_SECRET', description: 'JWT signing secret (min 32 chars)' },
    { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anon key' },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key (server only)' },
];

const OPTIONAL_VARS = [
    { name: 'GEMINI_API_KEY', description: 'Gemini API key' },
    { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key' },
];

function validateEnv(env) {
    const missing = [];
    const warnings = [];

    for (const v of CRITICAL_VARS) {
        if (!env[v.name]) {
            missing.push(`MISSING: ${v.name} — ${v.description}`);
        }
    }

    for (const v of OPTIONAL_VARS) {
        if (!env[v.name]) {
            warnings.push(`NOT SET: ${v.name} — ${v.description}`);
        }
    }

    const secret = env.DASHBOARD_SESSION_SECRET;
    if (secret && secret.length < 32) {
        warnings.push(`WARNING: DASHBOARD_SESSION_SECRET is only ${secret.length} chars.`);
    }

    return { missing, warnings };
}

describe('Environment Validation', () => {
    it('passes when all required vars are set', () => {
        const env = {
            DASHBOARD_PASSWORD: 'secret',
            DASHBOARD_SESSION_SECRET: 'a'.repeat(32),
            NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
            SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        };
        const result = validateEnv(env);
        expect(result.missing).toHaveLength(0);
    });

    it('reports missing required vars', () => {
        const result = validateEnv({});
        expect(result.missing.length).toBe(CRITICAL_VARS.length);
        expect(result.missing[0]).toContain('MISSING');
    });

    it('reports warnings for optional vars', () => {
        const result = validateEnv({
            DASHBOARD_PASSWORD: 'secret',
            DASHBOARD_SESSION_SECRET: 'a'.repeat(32),
            NEXT_PUBLIC_SUPABASE_URL: 'url',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
            SUPABASE_SERVICE_ROLE_KEY: 'key',
        });
        expect(result.warnings.length).toBe(OPTIONAL_VARS.length);
        expect(result.warnings[0]).toContain('NOT SET');
    });

    it('warns about short session secret', () => {
        const env = {
            DASHBOARD_PASSWORD: 'secret',
            DASHBOARD_SESSION_SECRET: 'short',
            NEXT_PUBLIC_SUPABASE_URL: 'url',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: 'key',
            SUPABASE_SERVICE_ROLE_KEY: 'key',
        };
        const result = validateEnv(env);
        expect(result.warnings.some(w => w.includes('WARNING'))).toBe(true);
    });

    it('accepts exactly 32 char secret', () => {
        const env = {
            DASHBOARD_PASSWORD: 'secret',
            DASHBOARD_SESSION_SECRET: 'a'.repeat(32),
        };
        const result = validateEnv(env);
        expect(result.warnings.some(w => w.includes('WARNING'))).toBe(false);
    });
});
