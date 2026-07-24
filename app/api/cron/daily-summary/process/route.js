/**
 * QStash Processing Endpoint — Daily Summary
 *
 * POST /api/cron/daily-summary/process
 *
 * Receives dispatched businesses from QStash and sends daily summaries.
 * QStash retries this endpoint up to 3 times on failure.
 *
 * SECURITY: Verify QStash signature if QSTASH_SIGNING_KEY is set.
 */

import * as Sentry from '@sentry/nextjs';
import { sendDailySummary } from '@/lib/twilio';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req) {
    const requestId = crypto.randomUUID();

    try {
        const qstashSigningKey = process.env.QSTASH_SIGNING_KEY;
        if (qstashSigningKey) {
            const signature = req.headers.get('upstash-signature');
            if (!signature) {
                console.warn(`[${requestId}] Missing QStash signature`);
                return Response.json({ error: 'Missing signature' }, { status: 403 });
            }
            try {
                const { verify } = await import('@upstash/qstash');
                const rawBody = await req.text();
                const isValid = await verify({ body: rawBody, signature, signingKey: qstashSigningKey });
                if (!isValid) {
                    console.warn(`[${requestId}] Invalid QStash signature`);
                    return Response.json({ error: 'Invalid signature' }, { status: 403 });
                }
            } catch (verifyErr) {
                console.error(`[${requestId}] QStash verification error:`, verifyErr.message);
                return Response.json({ error: 'Verification failed' }, { status: 403 });
            }
        }

        const body = await req.json();
        const { businesses } = body;

        if (!businesses || !Array.isArray(businesses) || businesses.length === 0) {
            return Response.json({ status: 'ok', processed: 0 });
        }

        console.log(`[${requestId}] QStash: processing daily summary for ${businesses.length} business(es)`);

        const results = [];
        for (const biz of businesses) {
            const result = await sendDailySummary(biz.id);
            results.push({ business: biz.slug, ...result });

            if (supabaseAdmin) {
                const today = new Date().toISOString().split('T')[0];
                await supabaseAdmin.from('daily_summaries').upsert({
                    business_id: biz.id,
                    summary_date: today,
                    booking_count: result.count || 0,
                    total_revenue: result.revenue || 0,
                    sent_via: result.method || result.reason || 'unknown',
                }, { onConflict: 'business_id,summary_date' });
            }
        }

        console.log(`[${requestId}] QStash: daily summary completed`, results);
        return Response.json({ status: 'ok', processed: results.length, results });
    } catch (error) {
        console.error(`[${requestId}] QStash daily summary process error:`, error.message);
        Sentry.captureException(error, { tags: { module: 'daily-summary-qstash-process', requestId } });
        return Response.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
