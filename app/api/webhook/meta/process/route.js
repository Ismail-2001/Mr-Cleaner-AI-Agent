/**
 * QStash Processing Endpoint — Meta Messages
 *
 * POST /api/webhook/meta/process
 *
 * Receives dispatched messages from QStash and processes them via orchestrateMaya.
 * QStash retries this endpoint up to3 times on failure.
 *
 * SECURITY: Only accepts requests from QStash (signature verification via QSTASH_SIGNING_KEY).
 * In production, verify the QStash request signature before processing.
 */

import * as Sentry from '@sentry/nextjs';
import { orchestrateMaya } from '@/lib/maestro';
import { resolveBusinessByMetaId, sendMetaMessage } from '@/lib/meta';

export async function POST(req) {
    const requestId = crypto.randomUUID();

    try {
        // Verify QStash signature (if QSTASH_SIGNING_KEY is set)
        const qstashSigningKey = process.env.QSTASH_SIGNING_KEY;
        if (qstashSigningKey) {
            const signature = req.headers.get('upstash-signature');
            if (!signature) {
                console.warn(`[${requestId}] Missing QStash signature`);
                return Response.json({ error: 'Missing signature' }, { status: 403 });
            }
            // QStash signature verification via @upstash/qstash
            try {
                const { verify } = await import('@upstash/qstash');
                const rawBody = await req.text();
                const isValid = await verify({
                    body: rawBody,
                    signature,
                    signingKey: qstashSigningKey,
                });
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
        const { requestId: originalRequestId, messages } = body;

        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            return Response.json({ status: 'ok', processed: 0 });
        }

        console.log(`[${requestId}] QStash: processing ${messages.length} message(s) from ${originalRequestId}`);

        const responses = [];
        for (const msg of messages) {
            try {
                const businessId = await resolveBusinessByMetaId(msg.senderId, msg.platform)
                    || await resolveBusinessByMetaId(msg.recipientId, msg.platform)
                    || '00000000-0000-0000-0000-000000000001';

                const sessionId = `meta_${msg.platform}_${msg.senderId}`.slice(0, 100);

                const result = await orchestrateMaya({
                    messages: [{ role: 'user', content: msg.text }],
                    sessionId,
                    requestId: originalRequestId || requestId,
                    source: msg.platform,
                    businessId,
                });

                if (result.content) {
                    const sendResult = await sendMetaMessage(msg.senderId, result.content, msg.platform);
                    responses.push({ senderId: msg.senderId?.slice(-4), platform: msg.platform, ...sendResult });
                }
            } catch (error) {
                console.error(`[${requestId}] Error processing message from ${msg.senderId?.slice(-4)}:`, error.message);
                Sentry.captureException(error, {
                    tags: { module: 'meta-qstash-process', requestId, platform: msg.platform },
                });
                responses.push({ senderId: msg.senderId?.slice(-4), platform: msg.platform, success: false, error: error.message });
            }
        }

        return Response.json({ status: 'ok', processed: responses.length, responses });
    } catch (error) {
        console.error(`[${requestId}] QStash process endpoint critical error:`, error.message);
        Sentry.captureException(error, {
            tags: { module: 'meta-qstash-process', code: 'CRITICAL', requestId },
        });
        return Response.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
