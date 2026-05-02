"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email: form.email, password: form.password,
      options: { data: { full_name: form.name } },
    });
    if (error) { setError(error.message); setLoading(false); return; }
    router.push("/reviews");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold" style={{color:"#1A2744"}}>Lumina Review</h1>
          <p className="text-gray-500 mt-2 text-sm">Create your free account</p>
        </div>
        <div className="card p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Create account</h2>
          <form onSubmit={handleRegister} className="space-y-4">
            {[
              { label:"Full name", key:"name", type:"text", placeholder:"Dr. Jane Nakibuuka" },
              { label:"Email", key:"email", type:"email", placeholder:"you@example.com" },
              { label:"Password", key:"password", type:"password", placeholder:"Min. 8 characters" },
            ].map(f => (
              <div key={f.key}>
                <label className="label">{f.label}</label>
                <input className="input" type={f.type} placeholder={f.placeholder}
                  value={(form as Record<string,string>)[f.key]}
                  onChange={e => setForm({...form, [f.key]: e.target.value})} required />
              </div>
            ))}
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center py-2.5" disabled={loading}>
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>
          <p className="text-sm text-gray-500 text-center mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-teal-500 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
