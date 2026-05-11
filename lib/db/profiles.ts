import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/db/types";

export async function listTeam(): Promise<ProfileRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .in("role", ["author", "manager"])
    .order("weekly_post_day", { ascending: true, nullsFirst: false })
    .order("full_name", { ascending: true });
  if (error) {
    console.error("[listTeam]", error);
    return [];
  }
  return (data ?? []) as unknown as ProfileRow[];
}

export async function listAllProfiles(): Promise<ProfileRow[]> {
  const supabase = createSupabaseServerClient();
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
