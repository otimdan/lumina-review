"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { castVote, uploadFullText } from "@/lib/actions/refs";
import type { Ref } from "@/types";
import { Upload, FileText, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import Link from "next/link";

interface Props { params: Promise<{reviewId:string}> }

export default function FullTextPage({ params }: Props) {
  const [reviewId, setReviewId] = useState("");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string|null>(null);
  const [pdfUrls, setPdfUrls] = useState<Record<string,string>>({});
  const [selected, setSelected] = useState<Ref|null>(null);

  useEffect(() => { params.then(p => setReviewId(p.reviewId)); }, []);

  const loadRefs = useCallback(async (rid: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("refs").select(`*, votes(*, profiles(full_name)), notes(*,profiles(full_name))`)
      .eq("review_id", rid).eq("status","relevant").order("ref_number");
    setRefs((data||[]) as unknown as Ref[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (reviewId) loadRefs(reviewId); }, [reviewId]);

  const handlePdfUpload = async (ref: Ref, file: File) => {
    setUploading(ref.id);
    try {
      const path = await uploadFullText(ref.id, reviewId, file);
      // Get signed URL for preview
      const supabase = createClient();
      const { data } = await supabase.storage.from("fulltext-pdfs").createSignedUrl(path, 3600);
      if (data?.signedUrl) setPdfUrls(p => ({...p, [ref.id]: data.signedUrl}));
      loadRefs(reviewId);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
        <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Full text review</h1>
        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{refs.length} studies</span>
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

      {!loading && refs.length === 0 && (
        <div className="card p-16 text-center text-gray-400">
          <FileText size={36} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium">No included studies yet</p>
          <p className="text-sm mt-1">Include references during title & abstract screening first.</p>
          <Link href={`/reviews/${reviewId}/screening`} className="btn-primary inline-flex mt-4">Go to screening</Link>
        </div>
      )}

      <div className={`grid gap-4 ${selected ? "grid-cols-[1fr_1.5fr]" : "grid-cols-1"}`}>
        <div className="space-y-3">
          {refs.map(ref => (
            <div key={ref.id}
              className={`card p-4 cursor-pointer transition-all ${selected?.id===ref.id ? "ring-2 ring-teal-500" : "hover:border-teal-200"}`}
              onClick={() => setSelected(ref)}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm mb-1 leading-snug" style={{color:"#1A2744"}}>{ref.title}</p>
                  <p className="text-xs text-gray-500 mb-2">{(ref.authors||[]).join(", ")}</p>

                  {/* PDF upload zone */}
                  <label className="block cursor-pointer">
                    <input type="file" accept="application/pdf" className="hidden"
                      onChange={e => { if(e.target.files?.[0]) handlePdfUpload(ref, e.target.files[0]); }}/>
                    <div className={`flex items-center gap-2 text-xs py-2 px-3 rounded-lg border border-dashed transition-colors ${
                      ref.url ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 hover:border-teal-400 text-gray-400"
                    }`}>
                      {uploading === ref.id ? (
                        <span className="animate-pulse">Uploading…</span>
                      ) : ref.url ? (
                        <><CheckCircle size={12}/> PDF uploaded — click to replace</>
                      ) : (
                        <><Upload size={12}/> Upload full text PDF</>
                      )}
                    </div>
                  </label>

                  {ref.url && pdfUrls[ref.id] && (
                    <a href={pdfUrls[ref.id]} target="_blank" className="btn-ghost text-xs mt-1 py-1">
                      <ExternalLink size={11}/> Open PDF
                    </a>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button className="text-xs py-1 px-2.5 rounded-md bg-green-50 text-green-700 hover:bg-green-100 font-medium flex items-center gap-1"
                    onClick={e => { e.stopPropagation(); castVote(ref.id, reviewId, "include", "full_text"); loadRefs(reviewId); }}>
                    <CheckCircle size={11}/> Include
                  </button>
                  <button className="text-xs py-1 px-2.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 font-medium flex items-center gap-1"
                    onClick={e => { e.stopPropagation(); castVote(ref.id, reviewId, "exclude", "full_text"); loadRefs(reviewId); }}>
                    <XCircle size={11}/> Exclude
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* PDF preview panel */}
        {selected && (
          <div className="card overflow-hidden sticky top-4 h-[calc(100vh-120px)]">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold truncate flex-1">{selected.title}</p>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
            </div>
            {pdfUrls[selected.id] ? (
              <iframe src={pdfUrls[selected.id]} className="w-full h-full border-0" title="Full text PDF"/>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={40} className="mb-3 text-gray-200"/>
                <p className="text-sm font-medium">No PDF uploaded yet</p>
                <p className="text-xs mt-1">Upload the full text to preview it here</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
