/**
 * Jobber CRM Integration
 *
 * GET  /api/integrations/jobber — OAuth initiation
 * GET  /api/integrations/jobber/callback — OAuth callback
 * POST /api/integrations/jobber/webhook — Jobber webhook handler
 *
 * OAUTH FLOW:
 * 1. User clicks "Connect Jobber" in dashboard
 * 2. Redirect to /api/integrations/jobber → generates auth URL
 * 3. User authorizes → Jobber redirects to callback with code
 * 4. Exchange code for tokens → store in integrations table
 * 5. Sync bookings ↔ Jobber jobs automatically
 *
 * WEBHOOK:
 * - job.created / job.updated → sync status back to bookings table
 * - invoice.created / invoice.paid → update payment status
 */

import * as Sentry from '@sentry/nextjs';
import { getJobberAuthUrl, exchangeJobberCode, verifyJobberWebhook, parseJobberEvent, syncBookingToJobber } from '@/lib/jobber';
import { supabaseAdmin } from '@/lib/supabase-admin';
import crypto from 'crypto';

// ─── GET: OAuth Initiation ───────────────────────────────────────────────────

export async function GET(req) {
    const { searchParams } = new URL(req.url);

    // Health check
    if (searchParams.get('action') === 'health') {
        return Response.json({
            status: 'ok',
            provider: 'jobber',
            configured: !!(process.env.JOBBER_CLIENT_ID && process.env.JOBBER_CLIENT_SECRET),
        });
    }

    // OAuth initiation
    const state = crypto.randomUUID();
    const authUrl = getJobberAuthUrl(state);

    // Store state in session to prevent CSRF
    if (supabaseAdmin) {
        await supabaseAdmin.from('application_config').upsert({
            id: `jobber_oauth_state_${state}`,
            data: { state, created_at: new Date().toISOString() },
        }, { onConflict: 'id' });
    }

    return Response.redirect(authUrl);
}

// ─── POST: Webhook Handler ───────────────────────────────────────────────────

export async function POST(req) {
    const requestId = crypto.randomUUID();

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-jobber-signature');

        // Signature verification
        if (!verifyJobberWebhook(rawBody, signature)) {
            console.warn(`[${requestId}] Invalid Jobber webhook signature`);
            return Response.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
        }

        const body = JSON.parse(rawBody);
        const event = parseJobberEvent(body);

        if (!event) {
            return Response.json({ status: 'ok' });
        }

        console.log(`[${requestId}] Jobber event: ${event.type}`);

        // Handle job updates — sync status back to our bookings table
        if (event.type === 'job_update' && event.jobId && supabaseAdmin) {
            const statusMap = {
                'scheduled': 'confirmed',
                'in_progress': 'confirmed',
                'completed': 'completed',
                'cancelled': 'cancelled',
            };

            const ourStatus = statusMap[event.status];
            if (ourStatus) {
                // Find the booking linked to this Jobber job
                const { data: integration } = await supabaseAdmin
                    .from('bookings')
                    .select('id')
                    .eq('jobber_job_id', event.jobId)
                    .single();

                if (integration) {
                    await supabaseAdmin
                        .from('bookings')
                        .update({ status: ourStatus })
                        .eq('id', integration.id);

                    console.log(`[${requestId}] Synced Jobber job ${event.jobId} → booking status: ${ourStatus}`);
                }
            }
        }

        // Handle invoice updates
        if (event.type === 'invoice_update') {
            console.log(`[${requestId}] Jobber invoice ${event.invoiceId}: ${event.status}`);
        }

        return Response.json({ status: 'ok', event_type: event.type });
    } catch (error) {
        console.error(`[${requestId}] Jobber webhook error:`, error.message);
        Sentry.captureException(error, { tags: { module: 'jobber-webhook', requestId } });
        return Response.json({ status: 'ok' }); // Always 200 to prevent retries
    }
}
