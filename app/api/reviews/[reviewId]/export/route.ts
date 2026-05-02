import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import type { Ref } from "@/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const { reviewId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "ris";
  const status = searchParams.get("status") || "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  let query = admin.from("refs").select("*").eq("review_id", reviewId);
  if (status !== "all") query = query.eq("status", status);
  const { data: refs, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (format === "ris") {
    const content = (refs as Ref[]).map(toRIS).join("\n");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/x-research-info-systems",
        "Content-Disposition": `attachment; filename="lumina-export-${status}.ris"`,
      },
    });
  }

  if (format === "csv") {
    const content = toCSV(refs as Ref[]);
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="lumina-export-${status}.csv"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown format" }, { status: 400 });
}

function toRIS(ref: Ref): string {
  const lines = ["TY  - JOUR"];
  if (ref.title)   lines.push(`TI  - ${ref.title}`);
  (ref.authors||[]).forEach(a => lines.push(`AU  - ${a}`));
  if (ref.abstract) lines.push(`AB  - ${ref.abstract}`);
  if (ref.journal)  lines.push(`JO  - ${ref.journal}`);
  if (ref.year)     lines.push(`PY  - ${ref.year}`);
  if (ref.volume)   lines.push(`VL  - ${ref.volume}`);
  if (ref.issue)    lines.push(`IS  - ${ref.issue}`);
  if (ref.pages)    lines.push(`SP  - ${ref.pages}`);
  if (ref.doi)      lines.push(`DO  - ${ref.doi}`);
  if (ref.issn)     lines.push(`SN  - ${ref.issn}`);
  (ref.keywords||[]).forEach(k => lines.push(`KW  - ${k}`));
  lines.push("ER  - ");
  return lines.join("\n");
}

function toCSV(refs: Ref[]): string {
  const headers = ["#","Title","Authors","Journal","Year","Volume","Issue","Pages","DOI","PMID","Abstract","Status"];
  const rows = refs.map(r => [
    r.ref_number,
    csvCell(r.title),
    csvCell((r.authors||[]).join("; ")),
    csvCell(r.journal||""),
    r.year||"",
    r.volume||"",
    r.issue||"",
    r.pages||"",
    r.doi||"",
    r.pmid||"",
    csvCell(r.abstract||""),
    r.status,
  ]);
  return [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
}

const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;
