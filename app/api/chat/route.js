import { checkRateLimit, checkChatIpRateLimit } from '@/lib/rate-limit';
import { validateBody, ChatRequestSchema } from '@/lib/api-validation';
import { orchestrateMaya } from '@/lib/maestro';

const SESSION_COOKIE_NAME = 'chat_session_id';
const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{1,100}$/;

export async function POST(req) {
    const requestId = crypto.randomUUID();

    const cookieSessionId = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const headerSessionId = req.headers.get('x-session-id');
    const rawSessionId = cookieSessionId || headerSessionId || 'anonymous';

    let sessionId;
    let isNewSession = false;

    if (rawSessionId === 'anonymous' || !rawSessionId) {
        sessionId = crypto.randomUUID().replace(/-/g, '').slice(0, 32);
        isNewSession = true;
    } else {
        sessionId = SESSION_ID_REGEX.test(rawSessionId) ? rawSessionId : 'anonymous';
    }

    const rateLimit = await checkRateLimit(sessionId);
    if (rateLimit) {
        console.log(`[${requestId}] Rate limited session=${sessionId}`);
        return Response.json(
            { error: { code: 'RATE_LIMITED', message: `Try again in ${rateLimit.retryAfterSec}s.` } },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
        );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '127.0.0.1';
    const ipRateLimit = await checkChatIpRateLimit(ip);
    if (ipRateLimit) {
        console.log(`[${requestId}] IP rate limited ip=${ip}`);
        return Response.json(
            { error: { code: 'IP_RATE_LIMITED', message: `Too many requests from this IP. Try again in ${ipRateLimit.retryAfterSec}s.` } },
            { status: 429, headers: { 'Retry-After': String(ipRateLimit.retryAfterSec) } }
        );
    }

    try {
        const body = await req.json();
        const validation = validateBody(ChatRequestSchema, body);
        if (!validation.success) {
            console.log(`[${requestId}] Validation failed:`, validation.data || 'invalid body');
            return validation.response;
        }
        const { messages: currentMessages } = validation.data;

        const result = await orchestrateMaya({
            messages: currentMessages,
            sessionId,
            requestId,
            source: 'web',
            req,
        });

        const isProduction = process.env.NODE_ENV === 'production';
        const cookieParts = [
            `${SESSION_COOKIE_NAME}=${sessionId}`,
            'Path=/',
            'HttpOnly',
            'SameSite=Lax',
            'Max-Age=2592000',
        ];
        if (isProduction) cookieParts.push('Secure');

        return Response.json(result, {
            headers: { 'Set-Cookie': cookieParts.join('; ') },
        });
    } catch (error) {
        console.error(`[${requestId}] Critical Orchestrator Error:`, JSON.stringify({
            error: error.message,
            sessionId,
            requestId,
            timestamp: new Date().toISOString()
        }));
        return Response.json({
            role: 'assistant',
            content: "I'm having a little trouble orchestrating my tools. Please try again or reach out to us directly!",
            error: { code: 'ORCHESTRATOR_ERROR', request_id: requestId }
        }, { status: 500 });
    }
}
