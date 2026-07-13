import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/health — Health check endpoint for monitoring.
 * Returns the status of critical dependencies: Supabase, AI keys, Stripe.
 */
export async function GET() {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        checks: {},
    };

    // Supabase
    try {
        if (supabaseAdmin) {
            const { error } = await supabaseAdmin.from('bookings').select('id').limit(1);
            health.checks.supabase = error ? 'degraded' : 'healthy';
        } else {
            health.checks.supabase = 'not_configured';
        }
    } catch {
        health.checks.supabase = 'unhealthy';
    }

    // AI Keys
    health.checks.gemini = process.env.GEMINI_API_KEY ? 'configured' : 'not_configured';
    health.checks.deepseek = process.env.DEEPSEEK_API_KEY ? 'configured' : 'not_configured';
    health.checks.openai = process.env.OPENAI_API_KEY ? 'configured' : 'not_configured';
    health.checks.hasAI = !!(process.env.GEMINI_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY);

    // Stripe
    health.checks.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured';

    // Dashboard auth
    health.checks.dashboard = (process.env.DASHBOARD_PASSWORD && process.env.DASHBOARD_SESSION_SECRET)
        ? 'configured'
        : 'not_configured';

    // Integrations
    health.checks.weather_api = process.env.OPENWEATHER_API_KEY ? 'configured' : 'not_configured';
    try {
        if (supabaseAdmin) {
            const { data: tokenData } = await supabaseAdmin
                .from('application_config')
                .select('id')
                .eq('id', 'google_tokens')
                .maybeSingle();
            health.checks.google_calendar = tokenData ? 'configured' : 'not_configured';
        } else {
            health.checks.google_calendar = 'not_configured';
        }
    } catch {
        health.checks.google_calendar = 'unhealthy';
    }

    // Overall status
    const values = Object.values(health.checks);
    if (values.includes('unhealthy')) {
        health.status = 'degraded';
    }

    return Response.json(health, {
        status: health.status === 'ok' ? 200 : 207,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
}
