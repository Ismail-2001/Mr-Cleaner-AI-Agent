-- Vehicle Photo Storage
-- Supabase Storage bucket for chat-uploaded vehicle condition photos.
--
-- SETUP: Run this migration, then create the bucket in Supabase Dashboard > Storage
-- or via the Supabase CLI: supabase storage create vehicle-photos

-- Create the storage bucket (Supabase CLI or Dashboard required)
-- supabase storage create vehicle-photos --public false

-- RLS policies for storage.objects
-- Anon can upload to vehicle-photos/ (chat flow)
CREATE POLICY "Anon can upload vehicle photos" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'vehicle-photos');

-- Anon can read their own uploads (for chat display)
CREATE POLICY "Anon can read vehicle photos" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'vehicle-photos');

-- Service role has full access (for admin/processing)
CREATE POLICY "Service role full access vehicle photos" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'vehicle-photos');

-- Photo metadata table: tracks uploads for analytics and cleanup
CREATE TABLE IF NOT EXISTS vehicle_photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  business_id UUID REFERENCES businesses(id),
  storage_path TEXT NOT NULL,         -- Supabase Storage path
  original_name TEXT,                 -- Original filename
  file_size_bytes INTEGER,
  mime_type TEXT,
  width INTEGER,                      -- Processed width
  height INTEGER,                     -- Processed height
  analysis_result JSONB,              -- AI vision analysis output
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vehicle_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert vehicle photos" ON vehicle_photos
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Anon can read own vehicle photos" ON vehicle_photos
  FOR SELECT TO anon
  USING (true);

CREATE INDEX IF NOT EXISTS idx_vehicle_photos_session ON vehicle_photos (session_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_photos_business ON vehicle_photos (business_id) WHERE business_id IS NOT NULL;
