import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Current user's profile (points + USD data), kept fresh via realtime
 * subscription (offerwall postbacks credit points server-side) and polling.
 */
export function useProfile() {
  const queryClient = useQueryClient();

  const query = useQuery<Profile | null>({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 30_000,
  });

  const userId = query.data?.id;

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-live-${userId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  return query;
}

export const POINTS_PER_USD = 1000;
