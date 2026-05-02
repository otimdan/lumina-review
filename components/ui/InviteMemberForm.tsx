"use client";
import { useState } from "react";
import { inviteMember } from "@/lib/actions/reviews";
import { UserPlus } from "lucide-react";

export default function InviteMemberForm({ reviewId }: { reviewId: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle"|"loading"|"success"|"error">("idle");
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    try {
      await inviteMember(reviewId, email.trim());
      setStatus("success"); setMsg(`${email} added to the review.`); setEmail("");
      setTimeout(() => setStatus("idle"), 3000);
    } catch (err) {
      setStatus("error"); setMsg((err as Error).message);
    }
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Invite collaborator</p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input className="input text-sm py-1.5 flex-1" type="email"
          placeholder="colleague@example.com" value={email}
          onChange={e => { setEmail(e.target.value); setStatus("idle"); }}/>
        <button type="submit" className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
          disabled={status === "loading"}>
          <UserPlus size={13}/> {status === "loading" ? "Inviting…" : "Invite"}
        </button>
      </form>
      {status === "success" && <p className="text-xs text-green-600 mt-1.5">✓ {msg}</p>}
      {status === "error"   && <p className="text-xs text-red-500 mt-1.5">✕ {msg}</p>}
      <p className="text-xs text-gray-400 mt-1.5">
        The person must already have a Lumina Review account.
      </p>
    </div>
  );
}
