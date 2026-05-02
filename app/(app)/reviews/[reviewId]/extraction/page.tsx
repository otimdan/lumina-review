"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getExtractionSchema, saveExtractionSchema, saveExtractionData } from "@/lib/actions/extraction";
import type { ExtractionSchema, ExtractionField, FieldType } from "@/lib/actions/extraction";
import type { Ref } from "@/types";
import { Plus, Trash2, GripVertical, Settings, Database, Save, ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props { params: Promise<{reviewId:string}> }

const FIELD_TYPES: {value:FieldType; label:string}[] = [
  {value:"text",        label:"Short text"},
  {value:"textarea",    label:"Long text"},
  {value:"number",      label:"Number"},
  {value:"select",      label:"Dropdown (single)"},
  {value:"multiselect", label:"Dropdown (multi)"},
  {value:"checkbox",    label:"Checkbox"},
  {value:"date",        label:"Date"},
  {value:"scale",       label:"Numerical scale"},
];

const DEFAULT_SCHEMA: ExtractionSchema = {
  sections: ["Study characteristics","Population","Intervention","Outcomes","Quality"],
  fields: [
    {id:"f1", label:"Study design",     type:"select",   required:true,  section:"Study characteristics", options:["RCT","Cohort","Case-control","Cross-sectional","Qualitative","Other"]},
    {id:"f2", label:"Country",          type:"text",     required:true,  section:"Study characteristics", placeholder:"e.g. Uganda"},
    {id:"f3", label:"Year of study",    type:"number",   required:false, section:"Study characteristics"},
    {id:"f4", label:"Sample size (N)",  type:"number",   required:true,  section:"Population"},
    {id:"f5", label:"Age range",        type:"text",     required:false, section:"Population", placeholder:"e.g. 18–45 years"},
    {id:"f6", label:"% female",         type:"number",   required:false, section:"Population"},
    {id:"f7", label:"Primary outcome",  type:"textarea", required:true,  section:"Outcomes", placeholder:"Describe the primary outcome measured"},
    {id:"f8", label:"Risk of bias",     type:"select",   required:false, section:"Quality", options:["Low","Moderate","High","Unclear"]},
  ],
};

export default function ExtractionPage({ params }: Props) {
  const [reviewId, setReviewId] = useState("");
  const [mode, setMode] = useState<"builder"|"data">("data");
  const [schema, setSchema] = useState<ExtractionSchema>(DEFAULT_SCHEMA);
  const [refs, setRefs] = useState<Ref[]>([]);
  const [selectedRef, setSelectedRef] = useState<Ref|null>(null);
  const [formValues, setFormValues] = useState<Record<string,unknown>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  // Builder state
  const [editingField, setEditingField] = useState<ExtractionField|null>(null);
  const [newSection, setNewSection] = useState("");

  useEffect(() => { params.then(p => setReviewId(p.reviewId)); }, []);

  useEffect(() => {
    if (!reviewId) return;
    const load = async () => {
      setLoading(true);
      const [s, supabase] = [await getExtractionSchema(reviewId), createClient()];
      if (s) setSchema(s);
      const { data } = await supabase.from("refs").select("*")
        .eq("review_id", reviewId).eq("status","relevant").order("ref_number");
      setRefs((data||[]) as Ref[]);
      setLoading(false);
    };
    load();
  }, [reviewId]);

  const handleSaveSchema = async () => {
    setSaving(true);
    await saveExtractionSchema(reviewId, schema);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveData = async () => {
    if (!selectedRef) return;
    setSaving(true);
    await saveExtractionData(reviewId, selectedRef.id, formValues);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addField = (section: string) => {
    const newField: ExtractionField = {
      id: "f" + Date.now(), label: "New field", type: "text",
      required: false, section,
    };
    setSchema(s => ({...s, fields:[...s.fields, newField]}));
    setEditingField(newField);
  };

  const updateField = (id: string, updates: Partial<ExtractionField>) => {
    setSchema(s => ({...s, fields: s.fields.map(f => f.id===id ? {...f,...updates} : f)}));
    if (editingField?.id === id) setEditingField(f => f ? {...f,...updates} : f);
  };

  const removeField = (id: string) => {
    setSchema(s => ({...s, fields: s.fields.filter(f => f.id !== id)}));
    if (editingField?.id === id) setEditingField(null);
  };

  const addSection = () => {
    if (!newSection.trim()) return;
    setSchema(s => ({...s, sections:[...s.sections, newSection.trim()]}));
    setNewSection("");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Link href={`/reviews/${reviewId}`} className="text-gray-400 hover:text-gray-600 text-xl leading-none">←</Link>
          <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Data extraction</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setMode(m => m==="builder"?"data":"builder")}
            className={mode==="builder" ? "btn-primary text-xs" : "btn-secondary text-xs"}>
            {mode==="builder" ? <><Database size={13}/> Switch to data entry</> : <><Settings size={13}/> Form builder</>}
          </button>
          {mode === "builder" && (
            <button className="btn-primary text-xs" onClick={handleSaveSchema} disabled={saving}>
              <Save size={13}/> {saving?"Saving…":saved?"Saved ✓":"Save schema"}
            </button>
          )}
        </div>
      </div>

      {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

      {!loading && mode === "builder" && (
        <div className="grid grid-cols-[1fr_340px] gap-6">
          {/* Schema editor */}
          <div className="space-y-4">
            {schema.sections.map(section => (
              <div key={section} className="card overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <span className="font-bold text-sm" style={{color:"#1A2744"}}>{section}</span>
                  <button className="text-teal-500 hover:text-teal-600 text-xs flex items-center gap-1 font-medium"
                    onClick={() => addField(section)}>
                    <Plus size={12}/> Add field
                  </button>
                </div>
                <div className="divide-y divide-gray-50">
                  {schema.fields.filter(f => f.section === section).map(field => (
                    <div key={field.id}
                      className={`flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${editingField?.id===field.id ? "bg-teal-50" : ""}`}
                      onClick={() => setEditingField(field)}>
                      <GripVertical size={14} className="text-gray-300 flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{field.label}</span>
                        {field.required && <span className="text-red-400 ml-1 text-xs">*</span>}
                        <span className="ml-2 text-xs text-gray-400">{FIELD_TYPES.find(t=>t.value===field.type)?.label}</span>
                      </div>
                      <button className="text-gray-300 hover:text-red-400 transition-colors"
                        onClick={e => { e.stopPropagation(); removeField(field.id); }}>
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  ))}
                  {schema.fields.filter(f=>f.section===section).length === 0 && (
                    <div className="px-5 py-4 text-xs text-gray-400 italic">No fields yet. Click "Add field".</div>
                  )}
                </div>
              </div>
            ))}

            {/* Add section */}
            <div className="flex gap-2">
              <input className="input text-sm" placeholder="New section name…" value={newSection}
                onChange={e => setNewSection(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSection()}/>
              <button className="btn-secondary text-sm whitespace-nowrap" onClick={addSection}>
                <Plus size={14}/> Add section
              </button>
            </div>
          </div>

          {/* Field editor */}
          <div className="card p-5 h-fit sticky top-4">
            {!editingField ? (
              <div className="text-center py-8 text-gray-400">
                <Settings size={28} className="mx-auto mb-2 text-gray-200"/>
                <p className="text-sm">Click a field to edit its properties</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-sm">Edit field</h3>
                <div>
                  <label className="label">Label</label>
                  <input className="input text-sm" value={editingField.label}
                    onChange={e => { updateField(editingField.id,{label:e.target.value}); }}/>
                </div>
                <div>
                  <label className="label">Field type</label>
                  <select className="input text-sm" value={editingField.type}
                    onChange={e => updateField(editingField.id,{type:e.target.value as FieldType})}>
                    {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                {(editingField.type==="select"||editingField.type==="multiselect") && (
                  <div>
                    <label className="label">Options (one per line)</label>
                    <textarea className="input text-sm resize-none" rows={4}
                      value={(editingField.options||[]).join("\n")}
                      onChange={e => updateField(editingField.id,{options:e.target.value.split("\n").filter(Boolean)})}/>
                  </div>
                )}
                {editingField.type==="scale" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="label">Min</label>
                      <input className="input text-sm" type="number" value={editingField.min||1}
                        onChange={e => updateField(editingField.id,{min:+e.target.value})}/></div>
                    <div><label className="label">Max</label>
                      <input className="input text-sm" type="number" value={editingField.max||10}
                        onChange={e => updateField(editingField.id,{max:+e.target.value})}/></div>
                  </div>
                )}
                <div>
                  <label className="label">Placeholder text</label>
                  <input className="input text-sm" value={editingField.placeholder||""}
                    onChange={e => updateField(editingField.id,{placeholder:e.target.value})}/>
                </div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editingField.required}
                    onChange={e => updateField(editingField.id,{required:e.target.checked})}
                    className="accent-teal-500"/>
                  Required field
                </label>
                <div>
                  <label className="label">Section</label>
                  <select className="input text-sm" value={editingField.section}
                    onChange={e => updateField(editingField.id,{section:e.target.value})}>
                    {schema.sections.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && mode === "data" && (
        <div className="grid grid-cols-[280px_1fr] gap-6">
          {/* Study list */}
          <div className="card overflow-hidden h-fit sticky top-4">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="font-bold text-sm" style={{color:"#1A2744"}}>Included studies ({refs.length})</p>
            </div>
            {refs.length === 0 && (
              <div className="p-6 text-xs text-gray-400 text-center">
                No included studies yet. Complete full text review first.
              </div>
            )}
            {refs.map(ref => (
              <button key={ref.id} onClick={() => { setSelectedRef(ref); setFormValues({}); }}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-teal-50 transition-colors ${selectedRef?.id===ref.id?"bg-teal-50":""}`}>
                <p className="text-xs text-gray-400 mb-0.5">#{ref.ref_number}</p>
                <p className="text-sm font-medium leading-snug line-clamp-2" style={{color:"#1A2744"}}>{ref.title}</p>
                <p className="text-xs text-gray-400 mt-1 truncate">{(ref.authors||[]).slice(0,2).join(", ")}</p>
              </button>
            ))}
          </div>

          {/* Extraction form */}
          <div>
            {!selectedRef ? (
              <div className="card p-16 text-center text-gray-400">
                <ChevronRight size={32} className="mx-auto mb-3 text-gray-200"/>
                <p className="font-medium">Select a study to extract data</p>
              </div>
            ) : (
              <div className="card p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="font-bold text-sm mb-0.5" style={{color:"#1A2744"}}>{selectedRef.title}</p>
                    <p className="text-xs text-gray-500">{(selectedRef.authors||[]).join(", ")} · {selectedRef.year}</p>
                  </div>
                  <button className="btn-primary text-xs" onClick={handleSaveData} disabled={saving}>
                    <Save size={12}/> {saving?"Saving…":saved?"Saved ✓":"Save data"}
                  </button>
                </div>

                {schema.sections.map(section => {
                  const fields = schema.fields.filter(f => f.section === section);
                  if (!fields.length) return null;
                  return (
                    <div key={section} className="mb-8">
                      <h3 className="font-bold text-sm mb-4 pb-2 border-b border-gray-100" style={{color:"#1A2744"}}>{section}</h3>
                      <div className="grid grid-cols-2 gap-4">
                        {fields.map(field => (
                          <div key={field.id} className={field.type==="textarea"?"col-span-2":""}>
                            <label className="label">
                              {field.label}
                              {field.required && <span className="text-red-400 ml-0.5">*</span>}
                            </label>
                            <ExtractionInput field={field}
                              value={formValues[field.id]}
                              onChange={v => setFormValues(fv => ({...fv,[field.id]:v}))}/>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ExtractionInput({ field, value, onChange }: {
  field: ExtractionField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const str = (v: unknown) => (v == null ? "" : String(v));

  if (field.type === "textarea")
    return <textarea className="input resize-none text-sm" rows={3}
      placeholder={field.placeholder} value={str(value)} onChange={e => onChange(e.target.value)}/>;

  if (field.type === "number")
    return <input className="input text-sm" type="number" placeholder={field.placeholder}
      value={str(value)} onChange={e => onChange(e.target.valueAsNumber)}/>;

  if (field.type === "date")
    return <input className="input text-sm" type="date"
      value={str(value)} onChange={e => onChange(e.target.value)}/>;

  if (field.type === "checkbox")
    return <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)}
        className="accent-teal-500"/> {field.label}
    </label>;

  if (field.type === "select")
    return <select className="input text-sm" value={str(value)} onChange={e => onChange(e.target.value)}>
      <option value="">Select…</option>
      {(field.options||[]).map(o => <option key={o}>{o}</option>)}
    </select>;

  if (field.type === "multiselect")
    return <div className="space-y-1.5">
      {(field.options||[]).map(o => (
        <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="accent-teal-500"
            checked={Array.isArray(value) && (value as string[]).includes(o)}
            onChange={e => {
              const curr = Array.isArray(value) ? (value as string[]) : [];
              onChange(e.target.checked ? [...curr,o] : curr.filter(x=>x!==o));
            }}/> {o}
        </label>
      ))}
    </div>;

  if (field.type === "scale")
    return <div className="flex items-center gap-3">
      <input type="range" min={field.min||1} max={field.max||10}
        value={Number(value)||field.min||1}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 accent-teal-500"/>
      <span className="text-sm font-semibold text-teal-600 w-6">{str(value)||field.min||1}</span>
    </div>;

  return <input className="input text-sm" type="text"
    placeholder={field.placeholder} value={str(value)} onChange={e => onChange(e.target.value)}/>;
}
