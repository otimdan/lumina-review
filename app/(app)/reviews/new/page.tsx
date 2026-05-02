"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createReview } from "@/lib/actions/reviews";

const REVIEW_TYPES = ["Systematic review","Scoping review","Rapid review","Umbrella review","Literature review","Other"];
const Q_TYPES = ["Prevalence","Intervention","Diagnosis","Prognosis","Aetiology","Prevention","Qualitative"];
const AREAS = ["Medicine","Nursing","Public health","Psychology","Pharmacy","Dentistry","Veterinary","Other"];
const PURPOSES = ["PhD thesis","Master's thesis","Undergraduate coursework","Grant application","Journal publication","Teaching","Other"];

export default function NewReviewPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name:"", type:"", question_type:"", area:"",
    main_purpose:"", primary_purpose:"", is_cochrane:false,
  });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const e: Record<string,string> = {};
    if (!form.name.trim()) e.name = "Review name is required";
    if (!form.type) e.type = "Please select a review type";
    setErrors(e);
    return !Object.keys(e).length;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const rev = await createReview(form);
      router.push(`/reviews/${rev.id}`);
    } catch (err) {
      setErrors({ submit: (err as Error).message });
      setLoading(false);
    }
  };

  const F = ({ label, error, children }: { label:string; error?:string; children:React.ReactNode }) => (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/reviews" className="text-gray-400 hover:text-gray-600 transition-colors"><ArrowLeft size={18}/></Link>
        <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Start a new review</h1>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card p-8 space-y-6">
          {/* Cochrane */}
          <div>
            <p className="font-semibold text-sm text-gray-800 mb-3">Are you creating a Cochrane review?</p>
            <div className="flex gap-6">
              {[true, false].map(v => (
                <label key={String(v)} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" checked={form.is_cochrane === v}
                    onChange={() => setForm({...form, is_cochrane:v})}
                    className="accent-teal-500"/>
                  {v ? "Yes" : "No"}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-4">
            <p className="font-semibold text-sm text-gray-800">About your review</p>
            <F label="Review name" error={errors.name}>
              <input className={`input ${errors.name ? "border-red-400" : ""}`}
                placeholder="e.g. KAP on AMR among medical students in East Africa"
                value={form.name} onChange={e => setForm({...form, name:e.target.value})}/>
              <p className="text-xs text-gray-400 mt-1">Use your full working title. You can change this later.</p>
            </F>
            <F label="Review type" error={errors.type}>
              <select className={`input ${errors.type ? "border-red-400" : ""}`}
                value={form.type} onChange={e => setForm({...form, type:e.target.value})}>
                <option value="">Select…</option>
                {REVIEW_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </F>
            <div className="grid grid-cols-2 gap-4">
              <F label="Question type">
                <select className="input" value={form.question_type}
                  onChange={e => setForm({...form, question_type:e.target.value})}>
                  <option value="">Select…</option>
                  {Q_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </F>
              <F label="Area of research">
                <select className="input" value={form.area}
                  onChange={e => setForm({...form, area:e.target.value})}>
                  <option value="">Select…</option>
                  {AREAS.map(t => <option key={t}>{t}</option>)}
                </select>
              </F>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6 space-y-4">
            <p className="font-semibold text-sm text-gray-800">Purpose of review</p>
            <div className="grid grid-cols-2 gap-4">
              <F label="Main or practice review?">
                <select className="input" value={form.main_purpose}
                  onChange={e => setForm({...form, main_purpose:e.target.value})}>
                  <option value="">Select…</option>
                  <option>Main review</option>
                  <option>Practice review</option>
                </select>
              </F>
              <F label="Primary purpose">
                <select className="input" value={form.primary_purpose}
                  onChange={e => setForm({...form, primary_purpose:e.target.value})}>
                  <option value="">Select…</option>
                  {PURPOSES.map(t => <option key={t}>{t}</option>)}
                </select>
              </F>
            </div>
          </div>

          {errors.submit && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{errors.submit}</p>}

          <div className="flex gap-3 pt-2">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Creating…" : "Create Review"}
            </button>
            <Link href="/reviews" className="btn-secondary">Cancel</Link>
          </div>
        </div>
      </form>
    </div>
  );
}
