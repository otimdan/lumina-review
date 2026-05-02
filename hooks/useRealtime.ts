"use client";
import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

type TableName = "refs" | "votes" | "notes" | "ref_history" | "extraction_data";

interface UseRealtimeOptions {
  reviewId: string;
  tables: TableName[];
  onUpdate: (table: TableName, eventType: "INSERT" | "UPDATE" | "DELETE", payload: Record<string, unknown>) => void;
}

export function useRealtime({ reviewId, tables, onUpdate }: UseRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`review:${reviewId}`);

    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as Parameters<typeof channel.on>[0],
        {
          event: "*",
          schema: "public",
          table,
          filter: table === "refs" ? `review_id=eq.${reviewId}` : undefined,
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          onUpdateRef.current(
            table,
            payload.eventType as "INSERT" | "UPDATE" | "DELETE",
            payload.new || payload.old
          );
        }
      );
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reviewId, tables.join(",")]); // eslint-disable-line
}

// ─── Presence — show who else is viewing the same review ──────────────────────
interface Presence {
  userId: string;
  name: string;
  page: string;
  color: string;
}

const COLORS = ["#0D9470","#2563EB","#D97706","#DC2626","#7C3AED","#DB2777"];

export function usePresence(reviewId: string, myName: string, myId: string, page: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const track = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.track({
      userId: myId,
      name: myName,
      page,
      color: COLORS[Math.abs(myId.charCodeAt(0)) % COLORS.length],
    } as Presence);
  }, [myId, myName, page]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`presence:${reviewId}`, {
      config: { presence: { key: myId } },
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") track();
    });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [reviewId, myId]);

  return { track };
}
