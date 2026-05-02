import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { parseFile, deduplicate, buildCitation } from "@/lib/parsers";

export const maxDuration = 60; // Vercel: allow up to 60s
export const dynamic = "force-dynamic";

const CHUNK_SIZE = 200; // refs inserted per DB batch

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params;

  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Parse multipart form
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return new Response("No file", { status: 400 });

  const text = await file.text();
  const { refs: parsed, format } = parseFile(file.name, text);

  if (!parsed.length) {
    return new Response(
      JSON.stringify({ error: "No references found in file. Check the format." }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // Fetch existing refs for dedup (only doi/pmid/title — lightweight)
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("refs")
    .select("doi, pmid, title")
    .eq("review_id", reviewId);

  const { unique, duplicates } = deduplicate(existing || [], parsed);

  // Get current max ref_number
  const { data: maxRow } = await admin
    .from("refs")
    .select("ref_number")
    .eq("review_id", reviewId)
    .order("ref_number", { ascending: false })
    .limit(1)
    .single();

  const startNum = (maxRow?.ref_number ?? 0) + 1;

  // Create import batch record
  const { data: batch } = await admin.from("import_batches").insert({
    review_id: reviewId,
    user_id: user.id,
    file_name: file.name,
    format,
    total_parsed: parsed.length,
    imported: unique.length,
    duplicates_removed: duplicates.length,
  }).select().single();

  // ── Streaming SSE response ─────────────────────────────────────────────────
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: "start", total: unique.length, duplicates: duplicates.length, format });

      let inserted = 0;

      for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
        const chunk = unique.slice(i, i + CHUNK_SIZE);

        const rows = chunk.map((ref, j) => ({
          review_id:   reviewId,
          ref_number:  startNum + i + j,
          title:       ref.title,
          authors:     ref.authors,
          abstract:    ref.abstract || null,
          journal:     ref.journal || null,
          year:        ref.year || null,
          volume:      ref.volume || null,
          issue:       ref.issue || null,
          pages:       ref.pages || null,
          doi:         ref.doi || null,
          pmid:        ref.pmid || null,
          issn:        ref.issn || null,
          publisher:   ref.publisher || null,
          keywords:    ref.keywords,
          url:         ref.url || null,
          raw_data:    ref.raw,
          status:      "pending",
          import_batch: batch?.id || null,
        }));

        const { data: insertedRefs, error } = await admin
          .from("refs")
          .insert(rows)
          .select("id");

        if (error) {
          send({ type: "error", message: error.message });
          controller.close();
          return;
        }

        // Bulk insert history records
        if (insertedRefs?.length) {
          await admin.from("ref_history").insert(
            insertedRefs.map((r: { id: string }) => ({
              ref_id: r.id,
              user_id: user.id,
              action: "Imported",
              metadata: { batch_id: batch?.id, format },
            }))
          );
        }

        inserted += chunk.length;
        send({ type: "progress", inserted, total: unique.length, percent: Math.round((inserted / unique.length) * 100) });

        // Small yield to avoid blocking
        await new Promise(r => setTimeout(r, 10));
      }

      send({ type: "complete", inserted, duplicates: duplicates.length, batchId: batch?.id });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
