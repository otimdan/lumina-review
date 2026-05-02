"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import type { Review } from "@/types";

export async function getReviews() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Get review IDs this user is a member of
  const { data: memberships } = await admin
    .from("review_members")
    .select("review_id")
    .eq("user_id", user.id);

  const reviewIds = (memberships || []).map((m) => m.review_id);

  // Also get reviews created by this user
  const { data: createdReviews } = await admin
    .from("reviews")
    .select("id")
    .eq("created_by", user.id);

  const createdIds = (createdReviews || []).map((r) => r.id);
  const allIds = [...new Set([...reviewIds, ...createdIds])];

  if (!allIds.length) return [] as Review[];

  const { data, error } = await admin
    .from("reviews")
    .select("*, refs(status)")
    .in("id", allIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data || []).map((r) => ({
    ...r,
    ref_count: (r.refs as { status: string }[]).length,
    pending_count: (r.refs as { status: string }[]).filter(
      (x) => x.status === "pending",
    ).length,
    irrelevant_count: (r.refs as { status: string }[]).filter(
      (x) => x.status === "irrelevant",
    ).length,
    relevant_count: (r.refs as { status: string }[]).filter(
      (x) => x.status === "relevant",
    ).length,
  })) as Review[];
}

export async function getReview(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("reviews")
    .select(
      `
      *,
      review_members(
        user_id,
        role,
        profiles(id, full_name, email)
      )
    `,
    )
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as Review & {
    review_members: Array<{
      user_id: string;
      role: string;
      profiles: { id: string; full_name: string; email: string };
    }>;
  };
}

// export async function createReview(formData: {
//   name: string;
//   type: string;
//   question_type?: string;
//   area?: string;
//   is_cochrane?: boolean;
//   main_purpose?: string;
//   primary_purpose?: string;
// }) {
//   // 1. Verify user is authenticated via regular client (respects auth)
//   const supabase = await createClient();
//   const {
//     data: { user },
//   } = await supabase.auth.getUser();
//   if (!user) redirect("/login");

//   // 2. Write with admin client — bypasses RLS, user already verified above
//   const admin = createAdminClient();

//   const { data: review, error } = await admin
//     .from("reviews")
//     .insert({ ...formData, created_by: user.id })
//     .select()
//     .single();

//   if (error) throw new Error(error.message);

//   // 3. Auto-add creator as admin member
//   await admin.from("review_members").insert({
//     review_id: review.id,
//     user_id: user.id,
//     role: "admin",
//   });

//   revalidatePath("/reviews");
//   return review as Review;
// }
export async function createReview(formData: {
  name: string;
  type: string;
  question_type?: string;
  area?: string;
  is_cochrane?: boolean;
  main_purpose?: string;
  primary_purpose?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  // Ensure profile exists before inserting review (handles missing trigger)
  await admin.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      full_name:
        user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User",
    },
    { onConflict: "id" },
  );

  const { data: review, error } = await admin
    .from("reviews")
    .insert({ ...formData, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  await admin.from("review_members").insert({
    review_id: review.id,
    user_id: user.id,
    role: "admin",
  });

  revalidatePath("/reviews");
  return review as Review;
}
export async function inviteMember(reviewId: string, email: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!profile) {
    throw new Error("No user found with that email. They must sign up first.");
  }

  const { error } = await admin.from("review_members").insert({
    review_id: reviewId,
    user_id: profile.id,
    role: "reviewer",
  });

  if (error?.code === "23505")
    throw new Error("This person is already a member.");
  if (error) throw new Error(error.message);

  revalidatePath(`/reviews/${reviewId}`);
}

export async function getReviewStats(reviewId: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("refs")
    .select("status")
    .eq("review_id", reviewId);

  const all = data || [];
  return {
    total: all.length,
    pending: all.filter((r) => r.status === "pending").length,
    relevant: all.filter((r) => r.status === "relevant").length,
    irrelevant: all.filter((r) => r.status === "irrelevant").length,
  };
}
