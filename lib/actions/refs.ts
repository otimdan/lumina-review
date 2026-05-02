"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Ref, VoteDecision, ScreeningStage } from "@/types";

// ─── Refs ─────────────────────────────────────────────────────────────────────

export async function getRefs(
  reviewId: string,
  opts: {
    status?: string;
    stage?: ScreeningStage;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}
) {
  const supabase = await createClient();

  let query = supabase
    .from("refs")
    .select(`
      *,
      votes(id, user_id, decision, stage, profiles(full_name)),
      notes(id, user_id, content, created_at, profiles(full_name)),
      ref_history(id, action, created_at, user_id, profiles(full_name))
    `)
    .eq("review_id", reviewId)
    .order("ref_number", { ascending: true });

  if (opts.status) query = query.eq("status", opts.status);
  if (opts.search) {
    query = query.or(`title.ilike.%${opts.search}%,abstract.ilike.%${opts.search}%`);
  }
  if (opts.limit) query = query.limit(opts.limit);
  if (opts.offset) query = query.range(opts.offset, opts.offset + (opts.limit || 50) - 1);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []) as unknown as Ref[];
}

export async function castVote(
  refId: string,
  reviewId: string,
  decision: VoteDecision,
  stage: ScreeningStage = "title_abstract",
  reason?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert vote
  const { error: voteError } = await supabase.from("votes").upsert(
    { ref_id: refId, user_id: user.id, decision, stage, reason: reason || null },
    { onConflict: "ref_id,user_id,stage" }
  );
  if (voteError) throw new Error(voteError.message);

  // Log history
  await supabase.from("ref_history").insert({
    ref_id: refId,
    user_id: user.id,
    action: decision === "include" ? "Included" : decision === "exclude" ? "Excluded" : "Maybe",
    metadata: { stage, decision },
  });

  // Auto-resolve status based on votes
  await resolveRefStatus(refId, reviewId, stage);

  revalidatePath(`/reviews/${reviewId}/screening`);
}

async function resolveRefStatus(refId: string, reviewId: string, stage: ScreeningStage) {
  const supabase = await createClient();

  const { data: votes } = await supabase
    .from("votes")
    .select("decision")
    .eq("ref_id", refId)
    .eq("stage", stage);

  if (!votes?.length) return;

  const decisions = votes.map(v => v.decision);
  const allExclude = decisions.every(d => d === "exclude");
  const allInclude = decisions.every(d => d === "include");

  let newStatus: string | null = null;
  if (allExclude && decisions.length >= 1) newStatus = "irrelevant";
  else if (allInclude && decisions.length >= 1) newStatus = "relevant";
  // Conflict: mixed votes — stays pending, appears in conflicts tab

  if (newStatus) {
    await supabase.from("refs").update({ status: newStatus }).eq("id", refId);
    await supabase.from("ref_history").insert({
      ref_id: refId,
      user_id: null,
      action: `Status set to ${newStatus}`,
      metadata: { auto: true },
    });
  }
}

export async function overrideRefStatus(
  refId: string,
  reviewId: string,
  status: "pending" | "relevant" | "irrelevant"
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await supabase.from("refs").update({ status }).eq("id", refId);
  await supabase.from("ref_history").insert({
    ref_id: refId,
    user_id: user.id,
    action: `Manually set to ${status}`,
    metadata: { override: true },
  });

  revalidatePath(`/reviews/${reviewId}/screening`);
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export async function addNote(refId: string, reviewId: string, content: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("notes").insert({
    ref_id: refId,
    user_id: user.id,
    content,
  });
  if (error) throw new Error(error.message);

  await supabase.from("ref_history").insert({
    ref_id: refId,
    user_id: user.id,
    action: "Note added",
    metadata: {},
  });

  revalidatePath(`/reviews/${reviewId}/screening`);
}

export async function deleteNote(noteId: string, reviewId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/reviews/${reviewId}/screening`);
}

// ─── PDF upload ───────────────────────────────────────────────────────────────

export async function uploadFullText(refId: string, reviewId: string, file: File) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const path = `${reviewId}/${refId}/${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("fulltext-pdfs")
    .upload(path, file, { contentType: "application/pdf", upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  // Store the path on the ref
  await supabase.from("refs").update({ url: path }).eq("id", refId);
  await supabase.from("ref_history").insert({
    ref_id: refId,
    user_id: user.id,
    action: "Full text uploaded",
    metadata: { file_name: file.name, path },
  });

  revalidatePath(`/reviews/${reviewId}/fulltext`);
  return path;
}

export async function getFullTextUrl(storagePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage
    .from("fulltext-pdfs")
    .getPublicUrl(storagePath);
  return data.publicUrl;
}
