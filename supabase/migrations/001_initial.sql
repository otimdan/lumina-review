-- ============================================================
-- Lumina Review — Initial Schema
-- Run via: supabase db push  OR paste into the SQL Editor
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── PROFILES ────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile on sign-up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── REVIEWS ─────────────────────────────────────────────────
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  type            TEXT,                  -- Systematic review, Scoping review, etc.
  question_type   TEXT,
  area            TEXT,
  is_cochrane     BOOLEAN DEFAULT FALSE,
  main_purpose    TEXT,
  primary_purpose TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── REVIEW MEMBERS (team) ───────────────────────────────────
CREATE TABLE review_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id   UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role        TEXT DEFAULT 'reviewer' CHECK (role IN ('admin','reviewer')),
  joined_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (review_id, user_id)
);

-- ─── REFERENCES ──────────────────────────────────────────────
CREATE TABLE refs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id    UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  ref_number   INTEGER,
  title        TEXT NOT NULL,
  authors      TEXT[]  DEFAULT '{}',
  abstract     TEXT,
  journal      TEXT,
  year         TEXT,
  volume       TEXT,
  issue        TEXT,
  pages        TEXT,
  doi          TEXT,
  pmid         TEXT,
  issn         TEXT,
  publisher    TEXT,
  keywords     TEXT[]  DEFAULT '{}',
  url          TEXT,
  raw_data     JSONB   DEFAULT '{}',   -- full original parsed record
  status       TEXT    DEFAULT 'pending'
               CHECK (status IN ('pending','relevant','irrelevant')),
  import_batch UUID,                    -- links to import_batches.id
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX refs_review_id_idx  ON refs(review_id);
CREATE INDEX refs_status_idx     ON refs(review_id, status);
CREATE INDEX refs_doi_idx        ON refs(review_id, doi) WHERE doi IS NOT NULL;
CREATE INDEX refs_pmid_idx       ON refs(review_id, pmid) WHERE pmid IS NOT NULL;

-- ─── SCREENING VOTES ─────────────────────────────────────────
CREATE TABLE votes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id       UUID REFERENCES refs(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  decision     TEXT CHECK (decision IN ('include','exclude','maybe')) NOT NULL,
  stage        TEXT DEFAULT 'title_abstract'
               CHECK (stage IN ('title_abstract','full_text')),
  reason       TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (ref_id, user_id, stage)
);

CREATE INDEX votes_ref_id_idx ON votes(ref_id);

-- ─── NOTES ───────────────────────────────────────────────────
CREATE TABLE notes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id     UUID REFERENCES refs(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── REFERENCE HISTORY ───────────────────────────────────────
CREATE TABLE ref_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_id     UUID REFERENCES refs(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX ref_history_ref_id_idx ON ref_history(ref_id);

-- ─── IMPORT BATCHES ──────────────────────────────────────────
CREATE TABLE import_batches (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id          UUID REFERENCES reviews(id) ON DELETE CASCADE NOT NULL,
  user_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name          TEXT,
  format             TEXT,    -- ris | pubmed | endnote_xml
  total_parsed       INTEGER DEFAULT 0,
  imported           INTEGER DEFAULT 0,
  duplicates_removed INTEGER DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER refs_updated_at BEFORE UPDATE ON refs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER votes_updated_at BEFORE UPDATE ON votes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews        ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE refs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ref_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

-- Profiles: users see/edit only their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Reviews: members can see reviews they belong to
CREATE POLICY "reviews_select" ON reviews FOR SELECT
  USING (
    id IN (SELECT review_id FROM review_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );
CREATE POLICY "reviews_insert" ON reviews FOR INSERT
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "reviews_update" ON reviews FOR UPDATE
  USING (created_by = auth.uid());
CREATE POLICY "reviews_delete" ON reviews FOR DELETE
  USING (created_by = auth.uid());

-- Review members
CREATE POLICY "members_select" ON review_members FOR SELECT
  USING (
    review_id IN (SELECT review_id FROM review_members WHERE user_id = auth.uid())
  );
CREATE POLICY "members_insert" ON review_members FOR INSERT
  WITH CHECK (
    review_id IN (SELECT id FROM reviews WHERE created_by = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "members_delete" ON review_members FOR DELETE
  USING (user_id = auth.uid()
    OR review_id IN (SELECT id FROM reviews WHERE created_by = auth.uid())
  );

-- Helper: check if user is member of the review that owns a ref
CREATE OR REPLACE FUNCTION is_review_member(p_review_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM review_members
    WHERE review_id = p_review_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM reviews
    WHERE id = p_review_id AND created_by = auth.uid()
  );
$$;

-- Refs policies
CREATE POLICY "refs_select" ON refs FOR SELECT
  USING (is_review_member(review_id));
CREATE POLICY "refs_insert" ON refs FOR INSERT
  WITH CHECK (is_review_member(review_id));
CREATE POLICY "refs_update" ON refs FOR UPDATE
  USING (is_review_member(review_id));
CREATE POLICY "refs_delete" ON refs FOR DELETE
  USING (is_review_member(review_id));

-- Votes
CREATE POLICY "votes_select" ON votes FOR SELECT
  USING (ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));
CREATE POLICY "votes_insert" ON votes FOR INSERT
  WITH CHECK (user_id = auth.uid()
    AND ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));
CREATE POLICY "votes_update" ON votes FOR UPDATE
  USING (user_id = auth.uid());

-- Notes
CREATE POLICY "notes_select" ON notes FOR SELECT
  USING (ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));
CREATE POLICY "notes_insert" ON notes FOR INSERT
  WITH CHECK (user_id = auth.uid()
    AND ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));
CREATE POLICY "notes_update" ON notes FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notes_delete" ON notes FOR DELETE USING (user_id = auth.uid());

-- History
CREATE POLICY "history_select" ON ref_history FOR SELECT
  USING (ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));
CREATE POLICY "history_insert" ON ref_history FOR INSERT
  WITH CHECK (ref_id IN (SELECT id FROM refs WHERE is_review_member(review_id)));

-- Import batches
CREATE POLICY "batches_select" ON import_batches FOR SELECT
  USING (is_review_member(review_id));
CREATE POLICY "batches_insert" ON import_batches FOR INSERT
  WITH CHECK (is_review_member(review_id));

-- ─── REALTIME ────────────────────────────────────────────────
-- Enable realtime on key tables so collaborators see live updates
ALTER PUBLICATION supabase_realtime ADD TABLE refs;
ALTER PUBLICATION supabase_realtime ADD TABLE votes;
ALTER PUBLICATION supabase_realtime ADD TABLE notes;
ALTER PUBLICATION supabase_realtime ADD TABLE ref_history;
