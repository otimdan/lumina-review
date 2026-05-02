# Lumina Review

A full-stack systematic review management platform built with **Next.js 15**, **Supabase**, and **TypeScript**.  
Covers the complete Covidence-style pipeline: import → deduplication → title/abstract screening → full-text review → data extraction → PRISMA diagram → export.

---

## Feature checklist

| Feature | Status |
|---|---|
| Auth (email/password via Supabase) | ✅ |
| Row-level security — per review team | ✅ |
| RIS parser (Zotero, Scopus, WoS, Embase) | ✅ |
| PubMed/MEDLINE `.nbib` / `.txt` parser | ✅ |
| EndNote XML `.xml` / `.enx` parser | ✅ |
| Streaming server-side import (10k+ refs via SSE) | ✅ |
| Auto deduplication (DOI + PMID + title) | ✅ |
| Title & abstract screening with voting | ✅ |
| Real-time collaboration (Supabase Realtime) | ✅ |
| Conflict detection (disagreeing votes) | ✅ |
| Full-text PDF upload + in-browser preview | ✅ |
| Full-text review stage | ✅ |
| Data extraction form builder (drag & drop fields) | ✅ |
| Data extraction entry per study | ✅ |
| PRISMA 2020 flow diagram (SVG, downloadable) | ✅ |
| RIS + CSV export | ✅ |
| Team member invite | ✅ |
| Ref notes + history log | ✅ |

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Realtime | Supabase Realtime (postgres_changes) |
| Storage | Supabase Storage (PDF bucket) |
| Styling | Tailwind CSS |
| File parsing | Client-side (RIS/PubMed) + `fast-xml-parser` (EndNote XML) |
| Deploy | Vercel (frontend) + Supabase cloud |

---

## Setup — step by step

### 1. Clone and install

```bash
git clone <your-repo-url> lumina-review
cd lumina-review
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to your users (e.g. **eu-west-1** for Africa)
3. Note your **Project URL** and **anon key** from Settings → API

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...   # Settings → API → service_role
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the database migrations

Option A — Supabase CLI (recommended):
```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Option B — paste manually:
1. Supabase Dashboard → SQL Editor
2. Paste and run `supabase/migrations/001_initial.sql`
3. Then `supabase/migrations/002_extraction.sql`

### 5. Create the PDF storage bucket

In Supabase Dashboard → Storage → New bucket:
- **Name:** `fulltext-pdfs`
- **Public:** ❌ No (private — access via signed URLs)

Then add storage policies (Dashboard → Storage → Policies → New policy):

**INSERT (upload):**
```sql
((storage.foldername(name))[1] IN (
  SELECT review_id::text FROM review_members WHERE user_id = auth.uid()
))
```

**SELECT (download/preview):**
```sql
((storage.foldername(name))[1] IN (
  SELECT review_id::text FROM review_members WHERE user_id = auth.uid()
))
```

### 6. Run locally

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) → register → create a review → import a file.

---

## Deployment to Vercel

```bash
npm install -g vercel
vercel
```

Set the same environment variables in Vercel Dashboard → Project → Settings → Environment Variables.

For the streaming import route to work on Vercel, ensure your plan supports functions up to 60s (Pro plan or Edge runtime). The route already has `export const maxDuration = 60`.

---

## Importing references — format guide

| Database | How to export |
|---|---|
| **PubMed** | Search → Save → Format: **PubMed** → Create file (`.nbib` or `.txt`) |
| **Web of Science** | Export → Other file formats → Format: **RIS** → Full record |
| **Scopus** | Select all → Export → **RIS** format → Include Abstract + Keywords |
| **Embase (Ovid)** | Export → Reprint/Medlars → **RIS** format |
| **Cochrane Library** | Search → Select all → Export → **RIS** |
| **Zotero** | File → Export Library → **RIS** format |
| **Mendeley** | File → Export → **RIS** format |
| **EndNote** | File → Export → **XML** format |

The import endpoint (`POST /api/reviews/[reviewId]/import`) streams progress via SSE so the UI shows a live progress bar even for 10,000+ references.

---

## Collaboration model

Every review has a **team** (`review_members` table). Members can be:

- **admin** — created the review, can invite others, override decisions
- **reviewer** — can vote, add notes, upload PDFs, extract data

Real-time sync is powered by Supabase Realtime `postgres_changes` subscriptions on `refs`, `votes`, `notes`, and `extraction_data`. When reviewer A excludes a reference, reviewer B sees it update live without refreshing.

**Conflict detection:** if two reviewers vote differently (one includes, one excludes), the reference automatically moves to the **Conflicts** tab for resolution.

---

## Data extraction form builder

Navigate to a review → **Extraction** → click **Form builder**.

- Add/remove sections (e.g. "Study characteristics", "Population", "Outcomes")
- Add fields of type: short text, long text, number, dropdown, multi-select, checkbox, date, numerical scale
- Set required fields
- Save schema — it applies to all studies in the review
- Switch to **Data entry** mode to fill in extracted data per included study

---

## PRISMA 2020 diagram

Navigate to a review → **PRISMA**.  
Numbers are auto-populated from your screening data. Click **Edit counts** to manually adjust any value (e.g. number of records from registers, exclusion reasons).  
Click **Download SVG** to get a publication-ready vector file.

---

## Project structure

```
lumina-review/
├── app/
│   ├── (auth)/              # Login, Register — no nav wrapper
│   │   ├── login/
│   │   └── register/
│   ├── (app)/               # Protected app — NavBar wrapper
│   │   └── reviews/
│   │       ├── page.tsx              # Reviews list
│   │       ├── new/page.tsx          # New review form
│   │       └── [reviewId]/
│   │           ├── page.tsx          # Dashboard / summary
│   │           ├── import/           # File import + streaming progress
│   │           ├── screening/        # T&A screening (realtime)
│   │           ├── fulltext/         # Full-text review + PDF upload
│   │           ├── extraction/       # Form builder + data entry
│   │           ├── prisma/           # PRISMA 2020 diagram
│   │           └── export/           # RIS / CSV export
│   ├── api/
│   │   └── reviews/[reviewId]/
│   │       ├── import/route.ts       # Streaming SSE import handler
│   │       └── export/route.ts       # RIS / CSV download
│   ├── layout.tsx
│   ├── page.tsx                      # → redirect /reviews
│   └── globals.css
├── components/
│   ├── nav/NavBar.tsx
│   └── ui/InviteMemberForm.tsx
├── hooks/
│   └── useRealtime.ts                # Supabase Realtime + Presence
├── lib/
│   ├── actions/
│   │   ├── reviews.ts                # Server Actions — review CRUD
│   │   ├── refs.ts                   # Server Actions — refs, votes, notes, PDF
│   │   └── extraction.ts             # Server Actions — schema + data
│   ├── parsers/
│   │   └── index.ts                  # RIS / PubMed / EndNote XML parsers
│   └── supabase/
│       ├── client.ts                 # Browser client
│       └── server.ts                 # Server + admin clients
├── supabase/migrations/
│   ├── 001_initial.sql               # Full schema + RLS + Realtime
│   └── 002_extraction.sql            # Extraction tables + storage note
├── types/index.ts
├── middleware.ts                     # Session refresh + route protection
├── .env.local.example
└── package.json
```

---

## Customisation tips

**Add institutional branding:**  
Change `APP = "Lumina Review"` in `NavBar.tsx` and update colours in `tailwind.config.ts`.

**Multi-reviewer consensus rule:**  
Edit `resolveRefStatus()` in `lib/actions/refs.ts` — currently resolves on first unanimous vote. Change `decisions.length >= 1` to `>= 2` to require two votes before resolving.

**Add PICO screening criteria:**  
Store as JSONB on the review, render in a sidebar during screening. The schema already has a `raw_data` column on refs and `extraction_schema` on reviews for extension.

**Scale to large teams:**  
Enable Supabase connection pooling (PgBouncer) in project settings. The import route uses the admin client which bypasses RLS for bulk inserts — already optimised for high volume.

---

## License

MIT — build on it freely.
