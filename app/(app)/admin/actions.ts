"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugs";

const WeekdayInput = z.object({
  userId: z.string().uuid(),
  weekday: z.number().int().min(1).max(5).nullable(),
});

export async function setWeekday(input: z.infer<typeof WeekdayInput>) {
  WeekdayInput.parse(input);
  await requireManager();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_weekday", {
    p_user_id: input.userId,
    p_weekday: input.weekday,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/schedule");
  revalidatePath("/dashboard");
  return { ok: true };
}

const UpsertAuthorizedInput = z.object({
  email: z.string().email(),
  role: z.enum(["viewer", "author", "manager"]),
  weekday: z.number().int().min(1).max(5).nullable().optional(),
});

export async function upsertAuthorizedUser(input: z.infer<typeof UpsertAuthorizedInput>) {
  UpsertAuthorizedInput.parse(input);
  await requireManager();
  const supabase = createSupabaseServerClient();
  const email = input.email.trim().toLowerCase();
  const { error } = await supabase.from("authorized_users").upsert(
    {
      email,
      role: input.role,
      weekly_post_day: input.weekday ?? null,
    },
    { onConflict: "email" },
  );
  if (error) return { ok: false, error: error.message };

  // Also sync any existing profile.
  await supabase
    .from("profiles")
    .update({ role: input.role, weekly_post_day: input.weekday ?? null })
    .eq("email", email);

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function removeAuthorizedUser(email: string) {
  await requireManager();
  const supabase = createSupabaseServerClient();
  const clean = email.trim().toLowerCase();
  await supabase.from("authorized_users").delete().eq("email", clean);
  // Demote profile to viewer.
  await supabase
    .from("profiles")
    .update({ role: "viewer", weekly_post_day: null })
    .eq("email", clean);
  revalidatePath("/admin/users");
  return { ok: true };
}

const TagInput = z.object({ name: z.string().min(1).max(40) });

export async function createTag(input: z.infer<typeof TagInput>) {
  TagInput.parse(input);
  await requireManager();
  const supabase = createSupabaseServerClient();
  const slug = slugify(input.name);
  const { error } = await supabase.from("tags").insert({ name: input.name.trim(), slug });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tags");
  revalidatePath("/blog");
  return { ok: true };
}

export async function deleteTag(id: string) {
  await requireManager();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tags").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tags");
  return { ok: true };
}

export async function setPostStatus(postId: string, status: "draft" | "submitted" | "scheduled" | "published" | "archived") {
  await requireManager();
  const supabase = createSupabaseServerClient();
  const update: Record<string, unknown> = { status };
  if (status === "published") update.published_at = new Date().toISOString();
  if (status === "archived") update.archived_at = new Date().toISOString();
  const { error } = await supabase.from("posts").update(update).eq("id", postId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/blog");
  return { ok: true };
}
