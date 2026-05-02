"use client";
import { createBrowserClient } from "@supabase/ssr";

// Singleton for the browser — safe to call in Client Components
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
