"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// ─── Extraction schema ────────────────────────────────────────────────────────
// Stored in a JSONB column on reviews table (added via migration below)

export type FieldType =
  | "text" | "textarea" | "number" | "select"
  | "multiselect" | "checkbox" | "date" | "scale";

export interface ExtractionField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];   // for select/multiselect
  min?: number;         // for scale/number
  max?: number;
  placeholder?: string;
  section: string;
}

export interface ExtractionSchema {
  sections: string[];
  fields: ExtractionField[];
}

export async function getExtractionSchema(reviewId: string): Promise<ExtractionSchema | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("extraction_schema")
    .eq("id", reviewId)
    .single();
  return (data?.extraction_schema as ExtractionSchema) || null;
}

export async function saveExtractionSchema(reviewId: string, schema: ExtractionSchema) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ extraction_schema: schema })
    .eq("id", reviewId);
  if (error) throw new Error(error.message);
  revalidatePath(`/reviews/${reviewId}/extraction`);
}

// ─── Extraction data (per ref) ────────────────────────────────────────────────

export interface ExtractionEntry {
  id?: string;
  review_id: string;
  ref_id: string;
  user_id?: string;
  data: Record<string, unknown>;
  is_consensus?: boolean;
  created_at?: string;
  updated_at?: string;
}

export async function getExtractionData(reviewId: string, refId?: string) {
  const supabase = await createClient();
  let query = supabase
    .from("extraction_data")
    .select("*, profiles(full_name)")
    .eq("review_id", reviewId);
  if (refId) query = query.eq("ref_id", refId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as ExtractionEntry[];
}

export async function saveExtractionData(
  reviewId: string,
  refId: string,
  extractedData: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("extraction_data")
    .upsert(
      { review_id: reviewId, ref_id: refId, user_id: user.id, data: extractedData },
      { onConflict: "review_id,ref_id,user_id" }
    );
  if (error) throw new Error(error.message);

  revalidatePath(`/reviews/${reviewId}/extraction`);
}
