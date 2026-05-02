"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Download, FileText, Table2, BarChart2 } from "lucide-react";

interface Props { params: Promise<{reviewId:string}> }

export default function ExportPage({ params }: Props) {
  const [reviewId, setReviewId] = useState("");
  const [stats, setStats] = useState({ total:0, relevant:0, irrelevant:0, pending:0 });
  const [loading, setLoading] = useState<string|null>(null);

  useEffect(() => { params.then(p => setReviewId(p.reviewId)); }, []);

  useEffect(() => {
    if (!reviewId) return;
    createClient().from("refs").select("status").eq("review_id", reviewId)
      .then(({ data }) => {
        const r = data||[];
        setStats({ total:r.length, relevant:r.filter(x=>x.status==="relevant").length,
          irrelevant:r.filter(x=>x.status==="irrelevant").length, pending:r.filter(x=>x.status==="pending").length });
      });
  }, [reviewId]);

  const download = async (format: string, status: string, label: string) => {
    setLoading(`${format}-${status}`);
    const res = await fetch(`/api/reviews/${reviewId}/export?format=${format}&status=${status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = label; a.click();
    URL.revokeObjectURL(url);
    setLoading(null);
  };

  const Stat = ({label, n, color}: {label:string; n:number; color:string}) => (
    <div className="text-center">
      <div className="text-2xl font-bold" style={{color}}>{n}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );

  const ExportCard = ({icon, title, desc, actions}: {
    icon: React.ReactNode; title:string; desc:string;
    actions: {label:string; format:string; status:string; filename:string}[]
  }) => (
    <div className="card p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-teal-500 flex-shrink-0">{icon}</div>
        <div>
          <h3 className="font-bold text-sm" style={{color:"#1A2744"}}>{title}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="space-y-2">
        {actions.map(a => (
          <button key={a.filename}
            className="btn-primary w-full justify-center text-xs py-2"
            disabled={loading === `${a.format}-${a.status}`}
            onClick={() => download(a.format, a.status, a.filename)}>
            <Download size={12}/>
            {loading===`${a.format}-${a.status}` ? "Preparing…" : a.label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Export</h1>
      </div>

      {/* Stats row */}
      <div className="card p-5 mb-6">
        <div className="flex justify-around">
          <Stat label="Total" n={stats.total} color="#1A2744"/>
          <Stat label="Included" n={stats.relevant} color="#16A34A"/>
          <Stat label="Excluded" n={stats.irrelevant} color="#DC2626"/>
          <Stat label="Pending" n={stats.pending} color="#6B7280"/>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ExportCard
          icon={<FileText size={18}/>}
          title="All references — RIS"
          desc="Import into Zotero, Mendeley, or any reference manager"
          actions={[
            {label:"Export all (RIS)", format:"ris", status:"all", filename:"lumina-all.ris"},
            {label:"Export included only (RIS)", format:"ris", status:"relevant", filename:"lumina-included.ris"},
            {label:"Export excluded only (RIS)", format:"ris", status:"irrelevant", filename:"lumina-excluded.ris"},
          ]}/>
        <ExportCard
          icon={<Table2 size={18}/>}
          title="Spreadsheet — CSV"
          desc="Open in Excel or Google Sheets for reporting"
          actions={[
            {label:"Export all (CSV)", format:"csv", status:"all", filename:"lumina-all.csv"},
            {label:"Export included only (CSV)", format:"csv", status:"relevant", filename:"lumina-included.csv"},
          ]}/>
        <div className="card p-5 sm:col-span-2">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
              <BarChart2 size={18}/>
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{color:"#1A2744"}}>PRISMA 2020 Flow Diagram</h3>
              <p className="text-xs text-gray-400 mt-0.5">Download as SVG or view the interactive diagram</p>
            </div>
          </div>
          <Link href={`/reviews/${reviewId}/prisma`} className="btn-secondary text-xs inline-flex">
            Open PRISMA diagram →
          </Link>
        </div>
      </div>

      <div className="card p-4 mt-4 bg-blue-50 border-blue-100">
        <p className="text-xs text-blue-700 font-semibold mb-1">💡 Recent exports</p>
        <p className="text-xs text-blue-600">No exports in the last 7 days</p>
      </div>
    </div>
  );
}
