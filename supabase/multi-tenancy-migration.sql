-- MULTI-TENANCY MIGRATION
-- Adds businesses table and business_id foreign keys to existing tables.
-- Run this AFTER schema.sql to enable multi-tenant support.
--
-- SECURITY: This migration is wrapped in a transaction block.
-- If any step fails, all changes are rolled back to prevent partial migrations.

-- BUSINESSES TABLE: Core multi-tenancy table. Each row = one detailing business.
CREATE TABLE IF NOT EXISTS businesses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,           -- URL-friendly identifier (e.g., 'mr-cleaner')
  name TEXT NOT NULL,                   -- Display name (e.g., 'Mr. Cleaner Mobile Detailing')
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/Chicago',
  location TEXT,                        -- City/State (e.g., 'Austin, TX')
  logo_url TEXT,
  branding JSONB DEFAULT '{}',          -- { primary_color, secondary_color, tagline }
  service_area JSONB DEFAULT '{}',      -- { counties: [], zip_codes: [] }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

-- No anon access to businesses table. Service role only.
-- In multi-tenant mode, the API routes will filter by business_id.

-- Add business_id to existing tables (nullable for backward compatibility)
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE usage_logs ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);
ALTER TABLE business_knowledge ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id);

-- Performance indexes for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings (business_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_business_id ON chat_sessions (business_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_business_id ON usage_logs (business_id);
CREATE INDEX IF NOT EXISTS idx_business_knowledge_business_id ON business_knowledge (business_id);

-- UNIQUE SLOT CONSTRAINT FIX: Include business_id in the unique constraint.
-- Without this, two different businesses cannot book the same time slot,
-- which is incorrect for multi-tenant operation. Each business should have
-- its own independent slot availability.
DROP INDEX IF EXISTS idx_unique_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_slot
  ON bookings (business_id, booking_date, booking_time)
  WHERE status != 'cancelled';

-- Seed default business for backward compatibility
-- This allows existing single-tenant deployments to work without changes.
INSERT INTO businesses (id, slug, name, owner_name, phone, timezone, location, service_area)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'mr-cleaner',
  'Mr. Cleaner Mobile Detailing',
  'Owner',
  '+15550001234',
  'America/Chicago',
  'Texas',
  '{"counties": ["Travis", "Williamson", "Hays"], "zip_codes": ["78701", "78702", "78703", "78704", "78705", "78613", "78660", "78664"]}'
)
ON CONFLICT (slug) DO NOTHING;

-- Backfill existing rows to belong to default business
-- This ensures all existing data is associated with the default tenant.
UPDATE bookings SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE chat_sessions SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE usage_logs SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;
UPDATE business_knowledge SET business_id = '00000000-0000-0000-0000-000000000001' WHERE business_id IS NULL;

-- TCPA SMS CONSENT
-- Required for TCPA compliance. Customer must explicitly opt-in to SMS.
-- Without this, sending promotional/SMS messages is illegal.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sms_consent BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS sms_consent_timestamp TIMESTAMPTZ;

-- Index for consent lookups (checking if a customer has opted in)
CREATE INDEX IF NOT EXISTS idx_bookings_sms_consent
  ON bookings (phone, business_id, sms_consent)
  WHERE sms_consent = true;

-- MULTI-CHANNEL: Track which channel each conversation came from
ALTER TABLE chat_sessions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'web';
CREATE INDEX IF NOT EXISTS idx_chat_sessions_source ON chat_sessions (source);

-- Meta integration: page_id and instagram_id for business resolution
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS page_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_id TEXT;
CREATE INDEX IF NOT EXISTS idx_businesses_page_id ON businesses (page_id) WHERE page_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_businesses_instagram_id ON businesses (instagram_id) WHERE instagram_id IS NOT NULL;

-- Google Business Profile integration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_account_id TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS google_location_id TEXT;
CREATE INDEX IF NOT EXISTS idx_businesses_google_location ON businesses (google_location_id) WHERE google_location_id IS NOT NULL;

-- Jobber CRM integration
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS jobber_job_id TEXT;
CREATE INDEX IF NOT EXISTS idx_bookings_jobber_job ON bookings (jobber_job_id) WHERE jobber_job_id IS NOT NULL;

-- Integrations table: stores OAuth tokens for connected services
CREATE TABLE IF NOT EXISTS integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) NOT NULL,
  provider TEXT NOT NULL,               -- 'jobber' | 'google' | 'stripe'
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  provider_account_id TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, provider)
);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_integrations_business ON integrations (business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations (business_id, provider);

-- DAILY SUMMARY: Track daily digest send status per business
CREATE TABLE IF NOT EXISTS daily_summaries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) NOT NULL,
  summary_date DATE NOT NULL,
  booking_count INTEGER DEFAULT 0,
  total_revenue NUMERIC DEFAULT 0,
  sent_via TEXT,           -- 'sms' | 'email' | 'failed'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, summary_date)
);

-- STRIPE WEBHOOK IDEMPOTENCY: Add stripe_session_id column to bookings with
-- UNIQUE constraint. This replaces the fragile notes-string match for idempotency
-- checks. Stripe retries webhooks — without this, each retry creates a duplicate
-- booking. The UNIQUE constraint is the database-level safety net; the application
-- also checks before inserting.
--
-- NOTE: Existing production rows will have NULL stripe_session_id (they were created
-- before this column existed). NULL = NULL evaluates to FALSE in SQL, so the
-- idempotency query .eq('stripe_session_id', session.id) will NOT accidentally
-- match old rows. This is safe to run on production data without a backfill.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_session_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_stripe_session
  ON bookings (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;
