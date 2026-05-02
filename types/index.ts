// ─── Core domain types ───────────────────────────────────────────────────────

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface Review {
  id: string;
  name: string;
  type: string | null;
  question_type: string | null;
  area: string | null;
  is_cochrane: boolean;
  main_purpose: string | null;
  primary_purpose: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // joined from review_members + refs
  member_count?: number;
  ref_count?: number;
  irrelevant_count?: number;
  pending_count?: number;
  relevant_count?: number;
  duplicate_count?: number;
}

export interface ReviewMember {
  id: string;
  review_id: string;
  user_id: string;
  role: "admin" | "reviewer";
  joined_at: string;
  profile?: Profile;
}

export type RefStatus = "pending" | "relevant" | "irrelevant";

export interface Ref {
  id: string;
  review_id: string;
  ref_number: number;
  title: string;
  authors: string[];
  abstract: string | null;
  journal: string | null;
  year: string | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  pmid: string | null;
  issn: string | null;
  publisher: string | null;
  keywords: string[];
  url: string | null;
  raw_data: Record<string, unknown>;
  status: RefStatus;
  import_batch: string | null;
  created_at: string;
  updated_at: string;
  // joined
  votes?: Vote[];
  notes?: Note[];
  history?: RefHistory[];
  my_vote?: Vote | null;
}

export type VoteDecision = "include" | "exclude" | "maybe";
export type ScreeningStage = "title_abstract" | "full_text";

export interface Vote {
  id: string;
  ref_id: string;
  user_id: string;
  decision: VoteDecision;
  stage: ScreeningStage;
  reason: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Note {
  id: string;
  ref_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface RefHistory {
  id: string;
  ref_id: string;
  user_id: string | null;
  action: string;
  metadata: Record<string, unknown>;
  created_at: string;
  profile?: Profile;
}

export interface ImportBatch {
  id: string;
  review_id: string;
  user_id: string;
  file_name: string;
  format: "ris" | "pubmed" | "endnote_xml" | "unknown";
  total_parsed: number;
  imported: number;
  duplicates_removed: number;
  created_at: string;
}

// ─── Parser types ────────────────────────────────────────────────────────────

export interface ParsedRef {
  title: string;
  authors: string[];
  abstract: string;
  journal: string;
  year: string;
  volume: string;
  issue: string;
  pages: string;
  doi: string;
  pmid: string;
  issn: string;
  publisher: string;
  keywords: string[];
  url: string;
  raw: Record<string, unknown>;
}

export type ParseFormat = "ris" | "pubmed" | "endnote_xml";

export interface ImportPreview {
  format: ParseFormat;
  parsed: ParsedRef[];
  duplicates: ParsedRef[];
  fileName: string;
}

// ─── Screening tabs ──────────────────────────────────────────────────────────

export type ScreeningTab =
  | "screen"
  | "conflicts"
  | "awaiting"
  | "irrelevant"
  | "relevant";
