"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle, AlertCircle, ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props { params: Promise<{reviewId:string}> }

interface StreamEvent {
  type: "start"|"progress"|"complete"|"error";
  total?: number;
  inserted?: number;
  duplicates?: number;
  percent?: number;
  format?: string;
  message?: string;
  batchId?: string;
}

const FORMATS = [
  { name:"PubMed / MEDLINE", exts:".nbib  .txt", color:"#2563EB", bg:"#EFF6FF", icon:"🔬",
    desc:"PubMed → Save → Format: PubMed → Create file (.nbib or .txt)" },
  { name:"RIS", exts:".ris", color:"#7C3AED", bg:"#F5F3FF", icon:"📄",
    desc:"From Zotero, Mendeley, Web of Science, Scopus, Embase, Ovid, Cochrane Library" },
  { name:"EndNote XML", exts:".xml  .enx", color:"#D97706", bg:"#FFFBEB", icon:"📋",
    desc:"EndNote → File → Export → XML format (.xml or .enx)" },
];

export default function ImportPage({ params }: Props) {
  const router = useRouter();
  const [reviewId, setReviewId] = useState<string|null>(null);
  const [phase, setPhase] = useState<"upload"|"importing"|"done">("upload");
  const [progress, setProgress] = useState<StreamEvent|null>(null);
  const [error, setError] = useState("");
  const readerRef = useRef<ReadableStreamDefaultReader|null>(null);

  // Resolve params
  useState(() => { params.then(p => setReviewId(p.reviewId)); });

  const processFile = useCallback(async (file: File) => {
    if (!reviewId) return;
    setError(""); setPhase("importing"); setProgress(null);

    const formData = new FormData();
    formData.append("file", file);

    const resp = await fetch(`/api/reviews/${reviewId}/import`, {
      method: "POST", body: formData,
    });

    if (!resp.ok || !resp.body) {
      const data = await resp.json().catch(() => ({}));
      setError(data.error || "Upload failed"); setPhase("upload"); return;
    }

    const reader = resp.body.getReader();
    readerRef.current = reader;
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        try {
          const evt = JSON.parse(line.slice(5)) as StreamEvent;
          setProgress(evt);
          if (evt.type === "complete") setPhase("done");
          if (evt.type === "error") { setError(evt.message||"Import failed"); setPhase("upload"); }
        } catch {}
      }
    }
  }, [reviewId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => { if (files[0]) processFile(files[0]); },
    accept: { "text/plain":[".ris",".txt",".nbib"], "application/xml":[".xml"], "text/xml":[".enx",".xml"] },
    multiple: false,
  });

  if (!reviewId) return null;

  if (phase === "done" && progress) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <CheckCircle size={52} className="mx-auto mb-4 text-teal-500" />
        <h2 className="text-2xl font-bold mb-2" style={{color:"#1A2744"}}>Import complete!</h2>
        <p className="text-gray-500 mb-2">
          <span className="font-semibold text-teal-600">{progress.inserted}</span> references added to screening queue.
        </p>
        {(progress.duplicates||0) > 0 && (
          <p className="text-gray-400 text-sm mb-6">
            {progress.duplicates} duplicate{progress.duplicates!==1?"s":""} removed automatically.
          </p>
        )}
        <div className="flex gap-3 justify-center">
          <Link href={`/reviews/${reviewId}/screening`} className="btn-primary">
            Go to screening <ChevronRight size={15}/>
          </Link>
          <button className="btn-secondary" onClick={() => { setPhase("upload"); setProgress(null); }}>
            Import another file
          </button>
          <Link href={`/reviews/${reviewId}`} className="btn-secondary">Dashboard</Link>
        </div>
      </div>
    );
  }

  if (phase === "importing" && progress) {
    const pct = progress.percent || 0;
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center">
        <div className="card p-10">
          <div className="text-4xl mb-4">⏳</div>
          <h2 className="text-lg font-bold mb-1" style={{color:"#1A2744"}}>Importing references…</h2>
          <p className="text-sm text-gray-500 mb-6">
            {progress.inserted} / {progress.total} · {pct}% complete
          </p>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-4">
            <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{width:`${pct}%`}}/>
          </div>
          {progress.format && (
            <p className="text-xs text-gray-400">Format detected: {progress.format.toUpperCase()}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Import references</h1>
      </div>

      {/* Drop zone */}
      <div {...getRootProps()} className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all mb-6 ${
        isDragActive ? "border-teal-500 bg-teal-50" : "border-gray-300 hover:border-gray-400 bg-white"
      }`}>
        <input {...getInputProps()}/>
        <Upload size={36} className={`mx-auto mb-3 ${isDragActive ? "text-teal-500" : "text-gray-300"}`}/>
        <p className="font-semibold text-gray-700 mb-1">
          {isDragActive ? "Drop it here!" : "Drop your reference file here"}
        </p>
        <p className="text-sm text-gray-400 mb-4">or click to browse</p>
        <button className="btn-primary" type="button">Choose file</button>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
          <AlertCircle size={18} className="text-red-500 mt-0.5 flex-shrink-0"/>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Format guide */}
      <h3 className="font-bold text-sm mb-3" style={{color:"#1A2744"}}>Supported formats</h3>
      <div className="space-y-3 mb-6">
        {FORMATS.map(f => (
          <div key={f.name} className="card flex gap-4 p-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
              style={{background:f.bg}}>
              {f.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm">{f.name}</span>
                <code className="text-xs px-2 py-0.5 rounded font-mono" style={{background:f.bg, color:f.color}}>{f.exts}</code>
              </div>
              <p className="text-xs text-gray-500">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* How-to */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="font-semibold text-xs text-blue-700 mb-2">💡 Export guides by database</p>
        <div className="text-xs text-blue-600 space-y-1 leading-relaxed">
          <p><strong>PubMed:</strong> Search → Save → Format: PubMed → Create file</p>
          <p><strong>Web of Science:</strong> Export → Other file formats → Format: RIS → Full record + cited refs</p>
          <p><strong>Scopus:</strong> Select all → Export → RIS format → Include Abstract & Keywords</p>
          <p><strong>Embase / Ovid:</strong> Export → Reprint/Medlars → Format: RIS</p>
          <p><strong>Cochrane Library:</strong> Search → Select all → Export → RIS</p>
          <p><strong>Zotero:</strong> File → Export Library → Format: RIS</p>
        </div>
      </div>
    </div>
  );
}
