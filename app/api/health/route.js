import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET() {
    const checks = {};

    // Supabase
    try {
        if (supabaseAdmin) {
            const { error } = await supabaseAdmin.from('bookings').select('id').limit(1);
            checks.supabase = error ? 'degraded' : 'connected';
        } else {
            checks.supabase = 'not_configured';
        }
    } catch {
        checks.supabase = 'unhealthy';
    }

    // AI
    const hasGemini = !!process.env.GEMINI_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    checks.ai = hasGemini || hasDeepSeek || hasOpenAI ? 'connected' : 'not_configured';
    checks.gemini = hasGemini ? 'configured' : 'not_configured';
    checks.deepseek = hasDeepSeek ? 'configured' : 'not_configured';
    checks.openai = hasOpenAI ? 'configured' : 'not_configured';

    // Stripe
    checks.stripe = process.env.STRIPE_SECRET_KEY ? 'configured' : 'not_configured';

    // Dashboard auth
    checks.dashboard = (process.env.DASHBOARD_PASSWORD && process.env.DASHBOARD_SESSION_SECRET)
        ? 'configured'
        : 'not_configured';

    // Integrations
    checks.weather_api = process.env.OPENWEATHER_API_KEY ? 'configured' : 'not_configured';
    checks.twilio = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
        ? 'configured'
        : 'not_configured';
    checks.resend = process.env.RESEND_API_KEY ? 'configured' : 'not_configured';

    try {
        if (supabaseAdmin) {
            const { data: tokenData } = await supabaseAdmin
                .from('application_config')
                .select('id')
                .eq('id', 'google_tokens')
                .maybeSingle();
            checks.calendar = tokenData ? 'configured' : 'not_configured';
        } else {
            checks.calendar = 'not_configured';
        }
    } catch {
        checks.calendar = 'unhealthy';
    }

    const values = Object.values(checks);
    const status = values.includes('unhealthy') ? 'degraded' : 'ok';

    return Response.json({
        status,
        timestamp: new Date().toISOString(),
        ...checks,
    }, {
        status: status === 'ok' ? 200 : 207,
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });
}
