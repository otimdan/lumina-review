"use client";
import { useState, useEffect, useTransition, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { castVote, overrideRefStatus, addNote, deleteNote } from "@/lib/actions/refs";
import type { Ref, ScreeningTab, Vote } from "@/types";
import { MessageCircle, Clock, CheckCircle, XCircle, ChevronDown, ChevronUp, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

interface Props { params: Promise<{reviewId:string}> }

const TABS: {key:ScreeningTab; label:string}[] = [
  {key:"screen",    label:"Screen"},
  {key:"conflicts", label:"Conflicts"},
  {key:"awaiting",  label:"Awaiting reviewer"},
  {key:"irrelevant",label:"Irrelevant"},
  {key:"relevant",  label:"Included"},
];

export default function ScreeningPage({ params }: Props) {
  const [reviewId, setReviewId] = useState("");
  const [tab, setTab] = useState<ScreeningTab>("screen");
  const [refs, setRefs] = useState<Ref[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAbstracts, setShowAbstracts] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [noteModal, setNoteModal] = useState<{ref:Ref}|null>(null);
  const [historyModal, setHistoryModal] = useState<{ref:Ref}|null>(null);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [userId, setUserId] = useState("");

  useEffect(() => { params.then(p => setReviewId(p.reviewId)); }, []);

  const loadRefs = useCallback(async (rid: string) => {
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);

    const { data } = await supabase
      .from("refs")
      .select(`*, votes(*, profiles(full_name)), notes(*, profiles(full_name)), ref_history(*, profiles(full_name))`)
      .eq("review_id", rid)
      .order("ref_number");
    setRefs((data || []) as unknown as Ref[]);
    setLoading(false);
  }, []);

  useEffect(() => { if (reviewId) loadRefs(reviewId); }, [reviewId]);

  // Realtime subscription
  useEffect(() => {
    if (!reviewId) return;
    const supabase = createClient();
    const channel = supabase.channel(`review:${reviewId}`)
      .on("postgres_changes", { event:"*", schema:"public", table:"refs", filter:`review_id=eq.${reviewId}` },
        () => loadRefs(reviewId))
      .on("postgres_changes", { event:"*", schema:"public", table:"votes" },
        () => loadRefs(reviewId))
      .on("postgres_changes", { event:"*", schema:"public", table:"notes" },
        () => loadRefs(reviewId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reviewId, loadRefs]);

  // Tab bucketing
  const myVotes = (r: Ref) => r.votes?.find(v => v.user_id === userId && v.stage === "title_abstract");
  const hasConflict = (r: Ref) => {
    const votes = r.votes?.filter(v => v.stage === "title_abstract") || [];
    if (votes.length < 2) return false;
    const decisions = new Set(votes.map(v => v.decision));
    return decisions.size > 1;
  };

  const buckets: Record<ScreeningTab, Ref[]> = {
    screen:     refs.filter(r => r.status === "pending" && !myVotes(r) && !hasConflict(r)),
    conflicts:  refs.filter(r => r.status === "pending" && hasConflict(r)),
    awaiting:   refs.filter(r => r.status === "pending" && myVotes(r) && !hasConflict(r)),
    irrelevant: refs.filter(r => r.status === "irrelevant"),
    relevant:   refs.filter(r => r.status === "relevant"),
  };

  const filtered = (buckets[tab] || []).filter(r =>
    !search || (r.title + (r.abstract||"")).toLowerCase().includes(search.toLowerCase())
  );

  const handleVote = (ref: Ref, decision: "include"|"exclude") => {
    startTransition(async () => {
      await castVote(ref.id, reviewId, decision, "title_abstract");
      await loadRefs(reviewId);
    });
  };

  const handleNote = async () => {
    if (!noteText.trim() || !noteModal) return;
    await addNote(noteModal.ref.id, reviewId, noteText);
    setNoteText(""); setNoteModal(null);
    loadRefs(reviewId);
  };

  const toggleExpanded = (id: string) => {
    setExpanded(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-5">
        <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
        <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Title and abstract screening</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-shrink-0 pb-2.5 px-0 mr-6 text-sm border-b-2 -mb-px transition-colors ${
              tab === t.key ? "border-teal-500 text-teal-500 font-semibold" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}>
            {t.label}
            <span className={`ml-1.5 text-xs ${tab === t.key ? "text-teal-400" : "text-gray-300"}`}>
              {buckets[t.key].length}
            </span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex gap-2 mb-4 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input className="input pl-9 text-sm py-1.5" placeholder="Search references…"
            value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer select-none">
          <input type="checkbox" checked={showAbstracts} onChange={e => setShowAbstracts(e.target.checked)}
            className="accent-teal-500"/>
          Show abstracts
        </label>
        <div className="flex-1"/>
        <span className="text-xs text-gray-400">{filtered.length} reference{filtered.length!==1?"s":""}</span>
      </div>

      {loading && (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-3/4 mb-2"/>
              <div className="h-3 bg-gray-100 rounded w-1/2"/>
            </div>
          ))}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="card p-16 text-center text-gray-400">
          <CheckCircle size={36} className="mx-auto mb-3 text-gray-200"/>
          <p className="font-medium text-gray-500">
            {search ? `No results for "${search}"` : "Nothing here yet"}
          </p>
          {tab === "screen" && !search && (
            <p className="text-sm mt-1">Import references to start screening</p>
          )}
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(ref => {
          const myVote = myVotes(ref);
          const isExpanded = expanded.has(ref.id) || showAbstracts;

          return (
            <div key={ref.id} className="card overflow-hidden">
              <div className="p-4">
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-xs text-gray-400">#{ref.ref_number}</span>
                      <span className={`badge-${ref.status}`}>{ref.status}</span>
                      {ref.pmid && <span className="text-xs text-gray-300">PMID:{ref.pmid}</span>}
                      {(ref.votes||[]).length > 0 && (
                        <div className="flex items-center gap-1 ml-1">
                          {(ref.votes||[]).filter(v => v.stage === "title_abstract").map(v => (
                            <span key={v.id} className="text-xs" title={`${(v as Vote & {profiles?:{full_name:string}}).profiles?.full_name}: ${v.decision}`}>
                              {v.decision === "include" ? "✓" : v.decision === "exclude" ? "✕" : "?"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <p className="font-semibold text-sm leading-snug mb-1" style={{color:"#1A2744"}}>{ref.title}</p>
                    <p className="text-xs text-gray-500 mb-1">{(ref.authors||[]).join(", ")}</p>
                    <p className="text-xs text-gray-400">
                      {[ref.journal, ref.year, ref.volume && `${ref.volume}${ref.issue?`(${ref.issue})`:""}`, ref.pages].filter(Boolean).join(" · ")}
                      {ref.doi && <> · <a href={`https://doi.org/${ref.doi}`} target="_blank" className="text-teal-500 hover:underline">DOI↗</a></>}
                    </p>

                    {isExpanded && ref.abstract && (
                      <p className="mt-3 text-xs text-gray-600 leading-relaxed bg-gray-50 rounded-lg p-3">{ref.abstract}</p>
                    )}

                    {ref.abstract && (
                      <button className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
                        onClick={() => toggleExpanded(ref.id)}>
                        {isExpanded ? <><ChevronUp size={12}/>Hide abstract</> : <><ChevronDown size={12}/>Show abstract</>}
                      </button>
                    )}

                    {(ref.notes||[]).map(n => (
                      <div key={n.id} className="mt-2 text-xs bg-amber-50 border-l-2 border-amber-400 rounded px-3 py-2 flex items-start gap-2">
                        <span className="text-amber-600 font-semibold flex-shrink-0">Note:</span>
                        <span className="text-amber-800">{n.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="px-4 pb-3 pt-0 flex gap-1 flex-wrap border-t border-gray-50">
                {tab === "screen" && (
                  <>
                    <button className="btn-primary text-xs py-1 px-3 bg-green-600 hover:bg-green-700"
                      onClick={() => handleVote(ref,"include")} disabled={isPending}>
                      <CheckCircle size={12}/> Include
                    </button>
                    <button className="btn-danger text-xs py-1 px-3"
                      onClick={() => handleVote(ref,"exclude")} disabled={isPending}>
                      <XCircle size={12}/> Exclude
                    </button>
                  </>
                )}
                {(tab === "irrelevant" || tab === "relevant") && (
                  <button className="btn-ghost text-xs py-1"
                    onClick={() => startTransition(async () => {
                      await overrideRefStatus(ref.id, reviewId, "pending");
                      loadRefs(reviewId);
                    })}>
                    ↩ Move to screening
                  </button>
                )}
                <button className="btn-ghost text-xs py-1" onClick={() => { setNoteModal({ref}); setNoteText(""); }}>
                  <MessageCircle size={12}/> Note
                </button>
                <button className="btn-ghost text-xs py-1" onClick={() => setHistoryModal({ref})}>
                  <Clock size={12}/> History
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Note modal */}
      {noteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setNoteModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-7" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-2">
              <h3 className="font-bold text-base">Notes</h3>
              <button onClick={() => setNoteModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm font-semibold mb-4 leading-snug" style={{color:"#1A2744"}}>{noteModal.ref.title}</p>
            {(noteModal.ref.notes||[]).map(n => (
              <div key={n.id} className="mb-3 p-3 bg-gray-50 rounded-xl text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-xs">{(n as {profiles?:{full_name:string}}).profiles?.full_name || "Unknown"}</span>
                  <span className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</span>
                </div>
                <p className="text-gray-700">{n.content}</p>
              </div>
            ))}
            <label className="label mt-3">Add a note</label>
            <textarea className="input resize-none" rows={3} placeholder="Note for your team…"
              value={noteText} onChange={e => setNoteText(e.target.value)}/>
            <div className="flex gap-2 justify-end mt-3">
              <button className="btn-secondary text-xs" onClick={() => setNoteModal(null)}>Cancel</button>
              <button className="btn-primary text-xs" onClick={handleNote}>Add note</button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setHistoryModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-7 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between mb-2">
              <h3 className="font-bold text-base">History</h3>
              <button onClick={() => setHistoryModal(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <p className="text-sm font-semibold mb-4 leading-snug" style={{color:"#1A2744"}}>{historyModal.ref.title}</p>
            <div className="space-y-0">
              {(historyModal.ref.history||[]).map((h, i) => (
                <div key={h.id} className={`flex items-start gap-3 py-2.5 ${i<(historyModal.ref.history||[]).length-1?"border-b border-gray-100":""}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                    h.action.includes("Import") ? "bg-teal-100 text-teal-700" :
                    h.action.includes("Excluded")||h.action.includes("irrelevant") ? "bg-red-100 text-red-600" :
                    h.action.includes("Included")||h.action.includes("relevant") ? "bg-green-100 text-green-700" :
                    "bg-gray-100 text-gray-500"
                  }`}>
                    {h.action.includes("Import")?"↓":h.action.includes("Excluded")?"✕":h.action.includes("Included")?"✓":h.action.includes("Note")?"✎":"·"}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{h.action}</p>
                    {(h as {profiles?:{full_name:string}}).profiles?.full_name && (
                      <p className="text-xs text-gray-400">by {(h as {profiles?:{full_name:string}}).profiles?.full_name}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{new Date(h.created_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
