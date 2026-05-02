import Link from "next/link";
import { getReviews } from "@/lib/actions/reviews";
import { Plus, BookOpen, ChevronRight } from "lucide-react";

export default async function ReviewsPage() {
  const reviews = await getReviews();

  const grouped = reviews.reduce((acc, r) => {
    const g = "My Reviews";
    if (!acc[g]) acc[g] = [];
    acc[g].push(r);
    return acc;
  }, {} as Record<string, typeof reviews>);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{color:"#1A2744"}}>Your reviews</h1>
        <Link href="/reviews/new" className="btn-primary">
          <Plus size={16} /> Start a new review
        </Link>
      </div>

      <div className="flex gap-6 border-b border-gray-200 mb-6">
        {["Current reviews","Archived reviews"].map((t,i) => (
          <button key={t} className={`pb-2.5 text-sm border-b-2 -mb-px ${
            i===0 ? "border-teal-500 text-teal-500 font-semibold" : "border-transparent text-gray-400"
          }`}>{t}</button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="card p-16 text-center">
          <BookOpen size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-600 mb-2">No reviews yet</h3>
          <p className="text-gray-400 text-sm mb-6">Start your first systematic review to begin screening references.</p>
          <Link href="/reviews/new" className="btn-primary inline-flex"><Plus size={15}/>Start a review</Link>
        </div>
      ) : (
        Object.entries(grouped).map(([group, revs]) => (
          <div key={group} className="card mb-4">
            <div className="px-6 py-3 border-b border-gray-100">
              <span className="font-bold text-sm" style={{color:"#1A2744"}}>{group}</span>
            </div>
            {revs.map((rev, i) => (
              <Link key={rev.id} href={`/reviews/${rev.id}`}
                className={`flex items-center px-6 py-4 hover:bg-teal-50 transition-colors group ${
                  i < revs.length-1 ? "border-b border-gray-100" : ""
                }`}>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-400 mb-1">{new Date(rev.created_at).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}</div>
                  <div className="text-sm font-medium text-teal-600 group-hover:text-teal-700">{rev.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">{rev.type}</span>
                    {(rev.ref_count ?? 0) > 0 && (
                      <>
                        <span className="text-gray-200">·</span>
                        <span className="text-xs text-gray-400">{rev.ref_count} refs</span>
                        <span className="text-xs text-green-600">{rev.relevant_count} included</span>
                        <span className="text-xs text-red-500">{rev.irrelevant_count} excluded</span>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-teal-400 transition-colors" />
              </Link>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
