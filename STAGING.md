# Staging Environment Setup

## Overview
Staging mirrors production with isolated data and test-mode credentials.
Never hit real Stripe charges or send real SMS from staging.

## 1. Branch & Deployment
- Create `staging` branch from `main`
- In Vercel: add staging environment → link to `staging` branch
- Production = `main` branch, Staging = `staging` branch

## 2. Supabase Isolation
- Create a SEPARATE Supabase project for staging (not shared with production)
- Run `supabase/multi-tenancy-migration.sql` on the staging project
- Staging project URL goes in staging env vars

## 3. Required Environment Variables

### Staging (set in Vercel → Settings → Environment Variables → "Staging")

```
# Supabase (staging project — NOT production)
NEXT_PUBLIC_SUPABASE_URL=https://<staging-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<staging-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<staging-service-role-key>

# Dashboard
DASHBOARD_PASSWORD=<same-as-production>
DASHBOARD_SESSION_SECRET=<same-as-production>

# AI (same keys work for both environments)
GEMINI_API_KEY=<your-gemini-key>

# Stripe — TEST MODE (never production keys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Twilio — TEST CREDENTIALS
TWILIO_ACCOUNT_SID=AC...  (test account)
TWILIO_AUTH_TOKEN=...      (test token)
TWILIO_PHONE_NUMBER=+1...  (test number from Twilio console)

# Redis (Upstash — same or separate instance)
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# App URL (staging Vercel URL)
NEXT_PUBLIC_APP_URL=https://staging-<your-project>.vercel.app

# QStash (same token works for both)
QSTASH_TOKEN=...

# Email (Resend — same key works for both)
RESEND_API_KEY=re_...

# Cron secret
CRON_SECRET=<random-string>

# Meta/Google/Jobber (test webhook endpoints)
META_APP_SECRET=<test-secret>
META_WEBHOOK_VERIFY_TOKEN=<test-token>
META_ACCESS_TOKEN=<test-token>
GBP_PUBSUB_VERIFICATION_TOKEN=<test-token>
JOBBER_CLIENT_ID=<test-client-id>
JOBBER_CLIENT_SECRET=<test-client-secret>
```

## 4. Verification Checklist
- [ ] `npm run build` passes on `staging` branch
- [ ] `/api/health` returns 200 on staging
- [ ] Chat widget connects to staging Supabase
- [ ] Stripe test payment flow works (use Stripe test card: 4242 4242 4242 4242)
- [ ] Twilio test SMS goes to verified test numbers only
- [ ] Dashboard login works with staging credentials
- [ ] No real charges or SMS sent (verify in Stripe dashboard + Twilio console)

## 5. Test Credentials References
- Stripe test cards: https://stripe.com/docs/testing
- Twilio test numbers: https://www.twilio.com/docs/usage/test-credentials
- Never commit real credentials to git
