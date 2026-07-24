# Known Issues & Client Onboarding Guide

*Transparency builds trust. This document lists every known limitation, required setup step, and post-deploy TODO so you know exactly what you're getting.*

---

## 1. Pre-Launch Checklist (Client Must Complete)

| # | Item | Owner | Time | Notes |
|---|------|-------|------|-------|
| 1 | **Google Calendar OAuth** | Client | 15 min | Create OAuth credentials in Google Cloud Console, paste IDs into env vars |
| 2 | **Stripe Account** | Client | 10 min | Create Stripe account, copy secret + webhook secret |
| 3 | **Gemini API Key** | Client | 5 min | Get free key at [aistudio.google.com](https://aistudio.google.com) — primary AI engine |
| 4 | **Twilio Phone Number** | Client | 10 min | Purchase SMS-capable number, copy Account SID + Auth Token |
| 5 | **Custom Domain** | Client | varies | Point DNS to Vercel deployment |
| 6 | **Supabase Project** | Handled | — | Included in DFY setup, but client owns the Supabase account |

## 2. Features That Work Immediately (Zero Config)

- ✅ **AI Chat (Maya)** — works with Gemini, DeepSeek, or OpenAI fallback
- ✅ **Online Booking** — full calendar availability + booking creation
- ✅ **Dashboard** — bookings table, analytics, reasoning log
- ✅ **SMS Notifications** — Twilio integration
- ✅ **WhatsApp Integration** — direct booking via WhatsApp
- ✅ **Weather API** — real-time forecast for scheduling decisions
- ✅ **Landing Page** — testimonials, stats, service menu

## 3. Missing Env Vars (Optional, Non-Blocking)

These environment variables are optional — the app runs without them but the corresponding feature is disabled:

```
STRIPE_SECRET_KEY        — Payments disabled (no Stripe account linked)
STRIPE_WEBHOOK_SECRET    — Stripe webhook verification disabled
OPENAI_API_KEY           — OpenAI fallback disabled
DEEPSEEK_API_KEY         — DeepSeek fallback disabled
GEMINI_API_KEY           — Falls back to simulation mode (Maya says "simulation mode")
GOOGLE_CALENDAR_CLIENT_ID + GOOGLE_CALENDAR_CLIENT_SECRET — Calendar sync disabled
OPENWEATHER_API_KEY      — Weather forecasts disabled
UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN — Rate limiter falls back to in-memory (cold-start unsafe)
```

## 4. Technical Limitations

- **Rate Limiting**: Chat API limited to 20 req/min per session + 30 req/min per IP (backstop); bookings POST limited to 5/min per IP; webhook endpoints 60/min per IP. When Redis is configured, limits persist across serverless cold starts.
- **CSRF Protection**: POST/PUT/DELETE requests require Origin/Referer matching
- **Session Expiry**: Dashboard sessions expire after 8 hours (configurable in `lib/session.js`)
- **File Uploads**: Not implemented (codebase uses text-only chat)
- **Multi-Tenancy**: Single-tenant install by default; multi-tenancy architecture planned but not deployed
- **Google Calendar**: Requires manual OAuth setup in Google Cloud Console (step-by-step guide below)
- **CSP**: Uses `unsafe-inline` and `unsafe-eval` required by Next.js hydration. To remove, implement nonce-based CSP with `next/script` nonce prop.
- **Rate Limiter Storage**: Hybrid — Redis (Upstash/Vercel KV) when `UPSTASH_REDIS_REST_URL` env var is set, in-memory Map fallback otherwise. In-memory mode resets on cold start and doesn't work across instances. Set Upstash env vars for production persistence.

## 5. Google Calendar Setup Guide (Required for Booking Sync)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID (Web application type)
3. Add authorized redirect URI: `https://yourdomain.com/api/auth/callback/google`
4. Copy **Client ID** and **Client Secret** into env vars:
   ```
   GOOGLE_CALENDAR_CLIENT_ID=your_client_id_here
   GOOGLE_CALENDAR_CLIENT_SECRET=your_client_secret_here
   ```
5. Enable the Google Calendar API in the same console

## 6. Security Posture

| Category | Status |
|----------|--------|
| RLS Policies | ✅ All tables have RLS enforced |
| Auth | ✅ Server-side JWT auth (no client-side password check) |
| CSRF | ✅ Origin/Referer validation on state-changing requests |
| Rate Limiting | ✅ Redis-backed (Upstash) with in-memory fallback; per-session + IP-based |
| Input Validation | ✅ Zod schemas on all API endpoints |
| Session Revocation | ✅ Logout immediately invalidates JWT |
| PII Redaction | ✅ Customer names/phones redacted from logs (args + results) |
| XSS Protection | ✅ Content-Security-Policy headers set |
| HTTPS | ✅ Enforced on Vercel production |
| API Keys | ✅ No keys exposed in client bundle |
| Model Failover | ✅ Per-request provider fallback (Gemini → DeepSeek → OpenAI) |
| Logging Resilience | ✅ Log failures don't crash customer-facing responses |

## 7. Post-Launch Monitoring

- Check Vercel dashboard for deployment logs and errors
- Monitor Supabase table `usage_logs` for API usage patterns
- Set up uptime monitoring (e.g., UptimeRobot) on the health endpoint: `https://yourdomain.com/api/health`
- Review dashboard analytics weekly for booking conversion rates
