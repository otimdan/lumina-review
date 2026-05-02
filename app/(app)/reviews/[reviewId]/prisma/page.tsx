"use client";
import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";

interface Props { params: Promise<{reviewId:string}> }

interface PRISMAData {
  // Identification
  dbRecords: number;
  registerRecords: number;
  otherRecords: number;
  // Screening
  duplicatesRemoved: number;
  automatedExclusions: number;
  recordsScreened: number;
  recordsExcluded: number;
  // Eligibility
  fullTextSought: number;
  fullTextNotRetrieved: number;
  fullTextAssessed: number;
  fullTextExcluded: number;
  exclusionReasons: { reason: string; n: number }[];
  // Included
  studiesIncluded: number;
  reportsIncluded: number;
}

export default function PRISMAPage({ params }: Props) {
  const [reviewId, setReviewId] = useState("");
  const [reviewName, setReviewName] = useState("");
  const [data, setData] = useState<PRISMAData>({
    dbRecords: 0, registerRecords: 0, otherRecords: 0,
    duplicatesRemoved: 0, automatedExclusions: 0,
    recordsScreened: 0, recordsExcluded: 0,
    fullTextSought: 0, fullTextNotRetrieved: 0,
    fullTextAssessed: 0, fullTextExcluded: 0,
    exclusionReasons: [
      { reason: "Wrong population", n: 0 },
      { reason: "Wrong intervention", n: 0 },
      { reason: "Wrong outcome", n: 0 },
      { reason: "Wrong study design", n: 0 },
    ],
    studiesIncluded: 0, reportsIncluded: 0,
  });
  const [editing, setEditing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => { params.then(p => setReviewId(p.reviewId)); }, []);

  useEffect(() => {
    if (!reviewId) return;
    const load = async () => {
      const supabase = createClient();
      const [{ data: review }, { data: refs }, { data: batches }] = await Promise.all([
        supabase.from("reviews").select("name").eq("id", reviewId).single(),
        supabase.from("refs").select("status").eq("review_id", reviewId),
        supabase.from("import_batches").select("imported,duplicates_removed").eq("review_id", reviewId),
      ]);

      if (review) setReviewName(review.name);
      const allRefs = refs || [];
      const totalDups = (batches||[]).reduce((s,b) => s + (b.duplicates_removed||0), 0);
      const totalImported = (batches||[]).reduce((s,b) => s + (b.imported||0), 0);
      const irrelevant = allRefs.filter(r => r.status === "irrelevant").length;
      const relevant   = allRefs.filter(r => r.status === "relevant").length;
      const pending    = allRefs.filter(r => r.status === "pending").length;

      setData(d => ({
        ...d,
        dbRecords:          totalImported + totalDups,
        duplicatesRemoved:  totalDups,
        recordsScreened:    totalImported,
        recordsExcluded:    irrelevant,
        fullTextSought:     relevant + pending,
        fullTextAssessed:   relevant + pending,
        studiesIncluded:    relevant,
        reportsIncluded:    relevant,
      }));
    };
    load();
  }, [reviewId]);

  const totalIdentified = data.dbRecords + data.registerRecords + data.otherRecords;
  const afterDedupe = totalIdentified - data.duplicatesRemoved - data.automatedExclusions;

  const downloadSVG = () => {
    if (!svgRef.current) return;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `PRISMA-${reviewName.replace(/\s+/g,"-")}.svg`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── SVG layout constants ──────────────────────────────────────────────────
  const W = 760; const H = 920;
  const bw = 200; const bh = 52; const by = 16;
  const midX = W / 2;
  const col1 = 120; const col3 = W - 120;

  type Box = { x:number; y:number; w:number; h:number; label:string; sub?:string; color?:string };

  const boxes: Record<string, Box> = {
    // Row 1 — Identification
    dbRecs:   { x: midX-bw-10, y: 60,  w: bw, h: bh, label: `Records from databases/registers`, sub: `(n = ${data.dbRecords})`, color: "#EFF6FF" },
    otherRecs:{ x: midX+10,    y: 60,  w: bw, h: bh, label: `Records from other sources`,       sub: `(n = ${data.otherRecords})`, color: "#EFF6FF" },
    // Row 2 — after dedup
    afterDedup:{ x: midX-bw/2, y: 175, w: bw, h: bh, label: "Records after deduplication",      sub: `(n = ${afterDedupe})`, color: "#F0FAF7" },
    // Dedup removed (right side)
    dedupRm:  { x: col3-bw/2,  y: 175, w: bw, h: bh, label: "Duplicates removed",               sub: `(n = ${data.duplicatesRemoved})`, color: "#FEF3C7" },
    // Row 3 — screened
    screened: { x: midX-bw/2,  y: 290, w: bw, h: bh, label: "Records screened",                 sub: `(n = ${data.recordsScreened})`, color: "#F0FAF7" },
    excTitle: { x: col3-bw/2,  y: 290, w: bw, h: bh, label: "Records excluded",                 sub: `(n = ${data.recordsExcluded})`, color: "#FEF2F2" },
    // Row 4 — full text sought
    ftSought: { x: midX-bw/2,  y: 405, w: bw, h: bh, label: "Full-text articles sought",        sub: `(n = ${data.fullTextSought})`, color: "#F0FAF7" },
    ftNotRet: { x: col3-bw/2,  y: 405, w: bw, h: bh, label: "Full-text not retrieved",          sub: `(n = ${data.fullTextNotRetrieved})`, color: "#FEF2F2" },
    // Row 5 — full text assessed
    ftAssess: { x: midX-bw/2,  y: 510, w: bw, h: bh, label: "Full-text articles assessed",      sub: `(n = ${data.fullTextAssessed})`, color: "#F0FAF7" },
    // Exclusion reasons
    ftExcBox: { x: col3-bw/2,  y: 490, w: bw, h: bh + data.exclusionReasons.length * 20, label: "Articles excluded", sub: `(n = ${data.fullTextExcluded})`, color: "#FEF2F2" },
    // Row 6 — included
    included: { x: midX-bw/2,  y: 680, w: bw, h: bh, label: "Studies included in synthesis",    sub: `(n = ${data.studiesIncluded})`, color: "#DCFCE7" },
  };

  const renderBox = (key: string) => {
    const b = boxes[key];
    return (
      <g key={key}>
        <rect x={b.x} y={b.y} width={b.w} height={b.h}
          rx="6" fill={b.color||"#fff"} stroke="#D1D5DB" strokeWidth="1.2"/>
        <text x={b.x+b.w/2} y={b.y+b.h/2-6} textAnchor="middle"
          fontSize="10.5" fontFamily="system-ui,sans-serif" fill="#1A2744" fontWeight="500">
          {b.label}
        </text>
        {b.sub && (
          <text x={b.x+b.w/2} y={b.y+b.h/2+10} textAnchor="middle"
            fontSize="10" fontFamily="system-ui,sans-serif" fill="#6B7280">
            {b.sub}
          </text>
        )}
        {/* exclusion reasons inline */}
        {key === "ftExcBox" && data.exclusionReasons.map((r,i) => (
          <text key={i} x={b.x+8} y={b.y+bh+6+i*20}
            fontSize="9" fontFamily="system-ui,sans-serif" fill="#6B7280">
            • {r.reason} (n={r.n})
          </text>
        ))}
      </g>
    );
  };

  const arrow = (x1:number,y1:number,x2:number,y2:number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9CA3AF" strokeWidth="1.4"
      markerEnd="url(#arrowhead)"/>
  );
  const hArrow = (fromBox:Box, toBox:Box) => {
    const y = fromBox.y + fromBox.h/2;
    return <line x1={fromBox.x+fromBox.w} y1={y} x2={toBox.x} y2={y}
      stroke="#9CA3AF" strokeWidth="1.4" markerEnd="url(#arrowhead)"/>;
  };

  // Phase labels
  const phases = [
    { label: "Identification", y: 60 + bh/2 },
    { label: "Screening",      y: 290 + bh/2 },
    { label: "Eligibility",    y: 510 + bh/2 },
    { label: "Included",       y: 680 + bh/2 },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></Link>
          <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>PRISMA 2020 Flow Diagram</h1>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary text-xs" onClick={() => setEditing(e => !e)}>
            {editing ? "Hide editor" : "✏️ Edit counts"}
          </button>
          <button className="btn-primary text-xs" onClick={downloadSVG}>
            <Download size={13}/> Download SVG
          </button>
        </div>
      </div>

      {editing && (
        <div className="card p-5 mb-5 grid grid-cols-3 gap-4 text-sm">
          {[
            {label:"Database records",   key:"dbRecords"},
            {label:"Register records",   key:"registerRecords"},
            {label:"Other sources",      key:"otherRecords"},
            {label:"Duplicates removed", key:"duplicatesRemoved"},
            {label:"Auto-excluded",      key:"automatedExclusions"},
            {label:"Full-text not retrieved", key:"fullTextNotRetrieved"},
            {label:"Full-text excluded", key:"fullTextExcluded"},
            {label:"Reports included",   key:"reportsIncluded"},
          ].map(f => (
            <div key={f.key}>
              <label className="label text-xs">{f.label}</label>
              <input type="number" className="input text-sm"
                value={(data as unknown as Record<string,number>)[f.key]||0}
                onChange={e => setData(d => ({...d, [f.key]:+e.target.value}))}/>
            </div>
          ))}
          <div className="col-span-3">
            <label className="label text-xs">Exclusion reasons</label>
            {data.exclusionReasons.map((r,i) => (
              <div key={i} className="flex gap-2 mb-1">
                <input className="input text-xs flex-1" value={r.reason}
                  onChange={e => setData(d => ({...d, exclusionReasons:d.exclusionReasons.map((x,j)=>j===i?{...x,reason:e.target.value}:x)}))}/>
                <input type="number" className="input text-xs w-16" value={r.n}
                  onChange={e => setData(d => ({...d, exclusionReasons:d.exclusionReasons.map((x,j)=>j===i?{...x,n:+e.target.value}:x)}))}/>
                <button className="text-red-400 hover:text-red-600 px-1" onClick={() => setData(d=>({...d,exclusionReasons:d.exclusionReasons.filter((_,j)=>j!==i)}))}>✕</button>
              </div>
            ))}
            <button className="btn-ghost text-xs mt-1" onClick={() => setData(d=>({...d,exclusionReasons:[...d.exclusionReasons,{reason:"New reason",n:0}]}))}>
              + Add reason
            </button>
          </div>
        </div>
      )}

      {/* SVG diagram */}
      <div className="card p-4 overflow-auto">
        <svg ref={svgRef} width={W} height={H} viewBox={`0 0 ${W} ${H}`}
          style={{fontFamily:"system-ui,sans-serif",maxWidth:"100%"}}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#9CA3AF"/>
            </marker>
          </defs>

          {/* Background phase bands */}
          {[
            {y:40, h:120, color:"#F9FAFB", label:"Identification"},
            {y:165,h:220, color:"#F0FAF7", label:"Screening"},
            {y:390,h:245, color:"#FFF7ED", label:"Eligibility"},
            {y:640,h:130, color:"#F0FDF4", label:"Included"},
          ].map((band,i) => (
            <g key={i}>
              <rect x={0} y={band.y} width={W} height={band.h} fill={band.color} rx="0"/>
              <text x={22} y={band.y+band.h/2+5} fontSize="11" fontWeight="700"
                textAnchor="middle" transform={`rotate(-90,22,${band.y+band.h/2})`}
                fill="#9CA3AF" letterSpacing="1">
                {band.label.toUpperCase()}
              </text>
              <line x1={44} y1={band.y} x2={44} y2={band.y+band.h} stroke="#E5E7EB" strokeWidth="1"/>
            </g>
          ))}

          {/* Title */}
          <text x={midX} y={22} textAnchor="middle" fontSize="13" fontWeight="700" fill="#1A2744">
            PRISMA 2020 Flow Diagram — {reviewName}
          </text>

          {/* Boxes */}
          {Object.keys(boxes).map(renderBox)}

          {/* Arrows — vertical main flow */}
          {arrow(midX, boxes.dbRecs.y+bh,   midX, boxes.afterDedup.y)}
          {arrow(midX, boxes.afterDedup.y+bh, midX, boxes.screened.y)}
          {arrow(midX, boxes.screened.y+bh,  midX, boxes.ftSought.y)}
          {arrow(midX, boxes.ftSought.y+bh,  midX, boxes.ftAssess.y)}
          {arrow(midX, boxes.ftAssess.y+bh,  midX, boxes.included.y)}

          {/* Arrows — horizontal to exclusion boxes */}
          {hArrow(boxes.afterDedup, boxes.dedupRm)}
          {hArrow(boxes.screened,   boxes.excTitle)}
          {hArrow(boxes.ftSought,   boxes.ftNotRet)}
          {hArrow(boxes.ftAssess,   boxes.ftExcBox)}

          {/* Vertical merge line for identification */}
          <line x1={boxes.dbRecs.x+bw/2} y1={boxes.dbRecs.y+bh}
                x2={boxes.dbRecs.x+bw/2} y2={boxes.afterDedup.y-20}
                stroke="#9CA3AF" strokeWidth="1.4"/>
          <line x1={boxes.otherRecs.x+bw/2} y1={boxes.otherRecs.y+bh}
                x2={boxes.otherRecs.x+bw/2} y2={boxes.afterDedup.y-20}
                stroke="#9CA3AF" strokeWidth="1.4"/>
          <line x1={boxes.dbRecs.x+bw/2} y1={boxes.afterDedup.y-20}
                x2={boxes.otherRecs.x+bw/2} y2={boxes.afterDedup.y-20}
                stroke="#9CA3AF" strokeWidth="1.4"/>
          {arrow(midX, boxes.afterDedup.y-20, midX, boxes.afterDedup.y)}

          {/* Footer */}
          <text x={midX} y={H-12} textAnchor="middle" fontSize="9" fill="#D1D5DB">
            Generated by Lumina Review · PRISMA 2020 · Page Moher et al. 2021
          </text>
        </svg>
      </div>
    </div>
  );
}
