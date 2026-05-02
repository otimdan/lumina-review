import Link from "next/link";
import { getReview, getReviewStats } from "@/lib/actions/reviews";
import { ArrowLeft, Upload, Settings, BarChart2, Download, Users } from "lucide-react";
import NavBar from "@/components/nav/NavBar";
import InviteMemberForm from "@/components/ui/InviteMemberForm";
import { createClient } from "@/lib/supabase/server";

export default async function ReviewDashboard({ params }: { params: Promise<{reviewId:string}> }) {
  const { reviewId } = await params;
  const [review, stats] = await Promise.all([getReview(reviewId), getReviewStats(reviewId)]);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("full_name,email").eq("id", user!.id).single();

  const screened = stats.relevant + stats.irrelevant;
  const pct = stats.total ? Math.round((screened / stats.total) * 100) : 0;

  return (
    <>
      <NavBar user={{name:profile?.full_name||"User",email:profile?.email||""}} reviewName={review.name} reviewId={reviewId}/>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/reviews" className="text-gray-400 hover:text-gray-600"><ArrowLeft size={18}/></Link>
            <h1 className="text-xl font-bold" style={{color:"#1A2744"}}>Review Summary</h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/reviews/${reviewId}/prisma`} className="btn-secondary"><BarChart2 size={14}/> PRISMA</Link>
            <Link href={`/reviews/${reviewId}/export`} className="btn-primary"><Download size={14}/> Export</Link>
          </div>
        </div>

        {/* Pipeline cards */}
        <div className="card mb-4">
          {/* Import */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-[15px]" style={{color:"#1A2744"}}>Import references</p>
              {stats.total > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {stats.total} references · deduplication applied on import
                </p>
              )}
            </div>
            <Link href={`/reviews/${reviewId}/import`} className="btn-primary text-xs"><Upload size={13}/> Import</Link>
          </div>

          {/* T&A screening */}
          <Link href={`/reviews/${reviewId}/screening`}
            className="flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-teal-50 transition-colors group">
            <div>
              <p className="font-semibold text-[15px]" style={{color:"#1A2744"}}>Title and abstract screening</p>
              {stats.total > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="w-32 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full transition-all" style={{width:`${pct}%`}}/>
                  </div>
                  <span className="text-xs text-gray-400">{pct}% screened</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-red-500">{stats.irrelevant} irrelevant</span>
              <span className="text-sm text-teal-500">{stats.pending} to screen</span>
              <span className="text-gray-300 group-hover:text-teal-400">›</span>
            </div>
          </Link>

          {/* Full text */}
          <Link href={`/reviews/${reviewId}/fulltext`}
            className="flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-teal-50 transition-colors group">
            <p className="font-semibold text-[15px]" style={{color:"#1A2744"}}>Full text review</p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">0 excluded</span>
              <span className="text-sm text-teal-500">{stats.relevant} to review</span>
              <span className="text-gray-300 group-hover:text-teal-400">›</span>
            </div>
          </Link>

          {/* Extraction */}
          <Link href={`/reviews/${reviewId}/extraction`}
            className="flex items-center justify-between px-6 py-4 hover:bg-teal-50 transition-colors group">
            <p className="font-semibold text-[15px]" style={{color:"#1A2744"}}>Data extraction</p>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">0 extracted</span>
              <span className="text-sm text-teal-500">0 to extract</span>
              <span className="text-gray-300 group-hover:text-teal-400">›</span>
            </div>
          </Link>
        </div>

        {/* Team */}
        <div className="card p-6 mb-4">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} className="text-gray-400"/>
            <h2 className="font-semibold text-sm">Team members</h2>
          </div>
          <div className="space-y-2 mb-4">
            {review.review_members?.map(m => (
              <div key={m.user_id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center">
                  {m.profiles.full_name?.slice(0,2).toUpperCase() || "?"}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.profiles.full_name}</p>
                  <p className="text-xs text-gray-400">{m.profiles.email} · {m.role}</p>
                </div>
              </div>
            ))}
          </div>
          <InviteMemberForm reviewId={reviewId}/>
        </div>
      </div>
    </>
  );
}
