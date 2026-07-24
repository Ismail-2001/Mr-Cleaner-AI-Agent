/**
 * Meta Webhook — Messenger + Instagram DMs
 *
 * GET  /api/webhook/meta — Webhook verification (challenge-response)
 * POST /api/webhook/meta — Incoming messages from Messenger/Instagram
 *
 * SECURITY:
 * - HMAC-SHA256 signature verification (X-Hub-Signature-256)
 * - Rate limiting: 60 requests/min per IP
 * - Idempotency: deduplicate by message ID
 * - Business resolution: maps Page ID → business UUID
 *
 * SETUP:
 * 1. Set env vars: META_WEBHOOK_VERIFY_TOKEN, META_APP_SECRET, META_ACCESS_TOKEN
 * 2. In Meta Developer Portal, subscribe webhook with verify token
 * 3. Subscribe to 'messages' field for Messenger, 'messages' for Instagram
 */

import * as Sentry from '@sentry/nextjs';
import { verifyMetaSignature, handleWebhookVerification, parseWebhookMessages, sendMetaMessage } from '@/lib/meta';
import { orchestrateMaya } from '@/lib/maestro';
import { resolveBusinessByMetaId } from '@/lib/meta';
import { checkWebhookRateLimit } from '@/lib/rate-limit';

// Dedup: track processed message IDs to prevent re-processing
const processedMessages = new Map(); // messageId -> timestamp
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

function isDuplicate(messageId) {
    if (!messageId) return false;
    if (processedMessages.has(messageId)) return true;
    processedMessages.set(messageId, Date.now());
    // Cleanup old entries
    if (processedMessages.size > 10000) {
        const cutoff = Date.now() - DEDUP_TTL_MS;
        for (const [id, ts] of processedMessages) {
            if (ts < cutoff) processedMessages.delete(id);
        }
    }
    return false;
}

// ─── GET: Webhook Verification ───────────────────────────────────────────────

export async function GET(req) {
    return handleWebhookVerification(new URL(req.url));
}

// ─── POST: Message Handler ───────────────────────────────────────────────────

export async function POST(req) {
    const requestId = crypto.randomUUID();

    // RATE LIMITING: 60 requests/min per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || '127.0.0.1';

    const rateLimit = await checkWebhookRateLimit(ip);
    if (rateLimit) {
        console.log(`[${requestId}] Meta webhook rate limited ip=${ip}`);
        return Response.json({ status: 'rate_limited' }, {
            status: 429,
            headers: { 'Retry-After': String(rateLimit.retryAfterSec) },
        });
    }

    try {
        // Read raw body for signature verification
        const rawBody = await req.text();
        const signature = req.headers.get('x-hub-signature-256');

        // SIGNATURE VERIFICATION: Ensure request is from Meta
        if (!verifyMetaSignature(rawBody, signature)) {
            console.warn(`[${requestId}] Invalid Meta webhook signature from ip=${ip}`);
            Sentry.captureMessage('Invalid Meta webhook signature', {
                level: 'warning',
                tags: { module: 'meta-webhook', requestId },
                extra: { ip },
            });
            return Response.json({ error: { code: 'FORBIDDEN', message: 'Invalid signature' } }, { status: 403 });
        }

        // Parse the body
        let body;
        try {
            body = JSON.parse(rawBody);
        } catch (e) {
            console.error(`[${requestId}] Failed to parse webhook body:`, e.message);
            return Response.json({ status: 'error', message: 'Invalid JSON' }, { status: 400 });
        }

        // Verify it's a page event
        if (body.object !== 'page' && body.object !== 'instagram') {
            console.log(`[${requestId}] Ignoring non-page event: ${body.object}`);
            return Response.json({ status: 'ok' });
        }

        // Extract messages from webhook payload
        const messages = parseWebhookMessages(body);

        if (messages.length === 0) {
            // No text messages — could be a delivery receipt, read receipt, etc.
            return Response.json({ status: 'ok' });
        }

        console.log(`[${requestId}] Received ${messages.length} message(s) from ${messages[0].platform}`);

        // Process each message
        const responses = [];
        for (const msg of messages) {
            // IDEMPOTENCY: Skip already-processed messages
            if (isDuplicate(msg.messageId)) {
                console.log(`[${requestId}] Skipping duplicate message ${msg.messageId}`);
                continue;
            }

            // Skip bot messages (prevent infinite loops)
            // In Messenger, the bot's own messages have sender.id matching the page ID
            // We detect this by checking if senderId == recipientId (bot sending to itself)
            if (msg.senderId === msg.recipientId) {
                console.log(`[${requestId}] Skipping bot self-message`);
                continue;
            }

            try {
                // Resolve which business this message belongs to
                const businessId = await resolveBusinessByMetaId(msg.senderId, msg.platform)
                    || await resolveBusinessByMetaId(msg.recipientId, msg.platform)
                    || '00000000-0000-0000-0000-000000000001';

                // Create a session ID from the sender's Meta ID
                // This ensures each user gets their own conversation thread
                const sessionId = `meta_${msg.platform}_${msg.senderId}`.slice(0, 100);

                // Run Maya orchestration
                const result = await orchestrateMaya({
                    messages: [{ role: 'user', content: msg.text }],
                    sessionId,
                    requestId,
                    source: msg.platform,
                    businessId,
                });

                // Send reply back to the user
                if (result.content) {
                    const sendResult = await sendMetaMessage(msg.senderId, result.content, msg.platform);
                    responses.push({
                        senderId: msg.senderId?.slice(-4),
                        platform: msg.platform,
                        ...sendResult,
                    });
                }
            } catch (error) {
                console.error(`[${requestId}] Error processing message from ${msg.senderId?.slice(-4)}:`, error.message);
                Sentry.captureException(error, {
                    tags: { module: 'meta-webhook', requestId, platform: msg.platform },
                });
                responses.push({
                    senderId: msg.senderId?.slice(-4),
                    platform: msg.platform,
                    success: false,
                    error: error.message,
                });
            }
        }

        return Response.json({ status: 'ok', processed: responses.length, responses });
    } catch (error) {
        console.error(`[${requestId}] Meta webhook critical error:`, error.message);
        Sentry.captureException(error, {
            tags: { module: 'meta-webhook', code: 'CRITICAL', requestId },
        });
        return Response.json({ status: 'ok' }); // Always return 200 to Meta to prevent retries
    }
}
