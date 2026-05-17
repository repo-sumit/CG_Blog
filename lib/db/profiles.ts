import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/db/types";
import { teamDisplayOrderFor } from "@/lib/team";

export async function listTeam(): Promise<ProfileRow[]> {
  const supabase = await createSupabaseServerClient();
  // SQL pre-sort by weekly_post_day so the schedule view's primary grouping
  // is intact; final order is decided in JS by `TEAM_META.displayOrder` so
  // every list of teammates (admin schedule, dashboard team panel, analytics
  // page) renders in the same canonical contributor order.
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["author", "manager"])
    .order("weekly_post_day", { ascending: true, nullsFirst: false });
  if (error) {
    console.error("[listTeam]", error);
    return [];
  }
  const rows = (data ?? []) as unknown as ProfileRow[];
  return rows.slice().sort((a, b) => {
    const oa = teamDisplayOrderFor(a.email);
    const ob = teamDisplayOrderFor(b.email);
    if (oa !== ob) return oa - ob;
    return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "");
  });
}

export async function listAllProfiles(): Promise<ProfileRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listAllProfiles]", error);
    return [];
  }
  return (data ?? []) as unknown as ProfileRow[];
}
