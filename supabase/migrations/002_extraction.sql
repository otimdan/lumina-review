-- ============================================================
-- Migration 002 — Extraction + storage bucket
-- ============================================================

-- Add extraction_schema JSONB column to reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS extraction_schema JSONB DEFAULT NULL;

-- ─── EXTRACTION DATA ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extraction_data (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  ref_id      UUID REFERENCES refs(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  is_consensus BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (review_id, ref_id, user_id)
);

CREATE INDEX extraction_review_idx ON extraction_data(review_id);
CREATE INDEX extraction_ref_idx    ON extraction_data(ref_id);

CREATE TRIGGER extraction_updated_at BEFORE UPDATE ON extraction_data
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE extraction_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "extraction_select" ON extraction_data FOR SELECT
  USING (is_review_member(review_id));
CREATE POLICY "extraction_insert" ON extraction_data FOR INSERT
  WITH CHECK (is_review_member(review_id) AND user_id = auth.uid());
CREATE POLICY "extraction_update" ON extraction_data FOR UPDATE
  USING (is_review_member(review_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE extraction_data;

-- ─── STORAGE BUCKET ──────────────────────────────────────────
-- Run this in the Supabase Dashboard → Storage → New Bucket
-- Name: fulltext-pdfs, Private bucket (access controlled by signed URLs)
-- OR run via the management API / CLI:
--
-- supabase storage create fulltext-pdfs --public=false
--
-- Then add storage policies via Dashboard → Storage → Policies:

-- Allow members to upload PDFs for their reviews
-- INSERT policy: ((storage.foldername(name))[1] IN (
--   SELECT review_id::text FROM review_members WHERE user_id = auth.uid()
-- ))
--
-- SELECT / download policy: ((storage.foldername(name))[1] IN (
--   SELECT review_id::text FROM review_members WHERE user_id = auth.uid()
-- ))
