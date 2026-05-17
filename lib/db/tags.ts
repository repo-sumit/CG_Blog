import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TagRow } from "@/lib/db/types";

export async function listTags(): Promise<TagRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });
  if (error) {
    console.error("[listTags]", error);
    return [];
  }
  return (data ?? []) as unknown as TagRow[];
}
