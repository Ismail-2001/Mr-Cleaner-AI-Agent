import { checkAvailability } from '@/lib/calendar';
import { checkBookingRateLimit } from '@/lib/rate-limit';
import { resolveBusinessId } from '@/lib/tenant';

export async function GET(req) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rateLimit = await checkBookingRateLimit(ip);
    if (rateLimit) {
        return Response.json(
            { error: { code: 'RATE_LIMITED', message: `Try again in ${rateLimit.retryAfterSec}s.` } },
            { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSec) } }
        );
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date) {
        return Response.json({ error: "Date parameter required" }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return Response.json({ error: "Invalid date format. Use YYYY-MM-DD." }, { status: 400 });
    }

    // MULTI-TENANT: Resolve business for scoped availability check.
    const businessId = await resolveBusinessId(req);

    const slots = await checkAvailability(date, 120, businessId);
    return Response.json(slots, {
        headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    });
}
