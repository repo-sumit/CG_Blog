"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/auth/guards";
import { slugify } from "@/lib/utils/slugs";
import type { ProfileRow } from "@/lib/db/types";
import { PUBLIC_FEED_TAG } from "@/lib/db/public";

type ActionResult = { ok: boolean; error?: string };

const WeekdayInput = z.object({
  userId: z.string().uuid(),
  weekday: z.number().int().min(1).max(5).nullable(),
});

export async function setWeekday(input: z.infer<typeof WeekdayInput>): Promise<ActionResult> {
  const parsed = WeekdayInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await requireManager();
  const supabase = createSupabaseServerClient();

  // Advisory uniqueness — refuse if another active team member already owns
  // the requested weekday. Manager can clear the other person first, then assign.
  if (parsed.data.weekday !== null) {
    const { data: conflictRow } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("weekly_post_day", parsed.data.weekday)
      .neq("id", parsed.data.userId)
      .maybeSingle();
    const conflict = conflictRow as { full_name: string | null; email: string } | null;
    if (conflict) {
      return {
        ok: false,
        error: `That day is already assigned to ${conflict.full_name ?? conflict.email}. Unassign them first.`,
      };
    }
  }

  const { error } = await supabase.rpc("assign_weekday", {
    p_user_id: parsed.data.userId,
    p_weekday: parsed.data.weekday,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/schedule");
  revalidatePath("/dashboard");
  return { ok: true };
}

const UpsertAuthorizedInput = z.object({
  email: z.string().email().max(254),
  role: z.enum(["viewer", "author", "manager"]),
  weekday: z.number().int().min(1).max(5).nullable().optional(),
});

export async function upsertAuthorizedUser(
  input: z.infer<typeof UpsertAuthorizedInput>,
): Promise<ActionResult> {
  const parsed = UpsertAuthorizedInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await requireManager();
  const supabase = createSupabaseServerClient();
  const email = parsed.data.email.trim().toLowerCase();

  // Refuse non-domain emails — RLS would block their first sign-in anyway,
  // but failing here gives the manager a clear error.
  const allowed = (process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai").toLowerCase();
  if (email.split("@")[1] !== allowed) {
    return { ok: false, error: `Email must be @${allowed}.` };
  }

  const { error } = await supabase.from("authorized_users").upsert(
    {
      email,
      role: parsed.data.role,
      weekly_post_day: parsed.data.weekday ?? null,
    },
    { onConflict: "email" },
  );
  if (error) return { ok: false, error: error.message };

  // Also sync any existing profile.
  await supabase
    .from("profiles")
    .update({ role: parsed.data.role, weekly_post_day: parsed.data.weekday ?? null })
    .eq("email", email);

  revalidatePath("/admin/users");
  return { ok: true };
}

export async function removeAuthorizedUser(email: string): Promise<ActionResult> {
  const parsed = z.string().email().max(254).safeParse(email);
  if (!parsed.success) return { ok: false, error: "Invalid email." };
  const { profile } = await requireManager();
  const supabase = createSupabaseServerClient();
  const clean = parsed.data.trim().toLowerCase();

  // Prevent the only manager from removing themselves and locking the project
  // out of admin access.
  if (clean === profile.email.toLowerCase()) {
    return { ok: false, error: "You cannot remove yourself." };
  }
  const { count: managerCount } = await supabase
    .from("authorized_users")
    .select("email", { count: "exact", head: true })
    .eq("role", "manager");
  const { data: targetRow } = await supabase
    .from("authorized_users")
    .select("role")
    .eq("email", clean)
    .maybeSingle();
  const target = targetRow as { role?: ProfileRow["role"] } | null;
  if (target?.role === "manager" && (managerCount ?? 0) <= 1) {
    return { ok: false, error: "Cannot remove the last remaining manager." };
  }

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

export async function createTag(input: z.infer<typeof TagInput>): Promise<ActionResult> {
  const parsed = TagInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await requireManager();
  const supabase = createSupabaseServerClient();
  const name = parsed.data.name.trim();
  const slug = slugify(name);

  // Friendly duplicate handling — Postgres unique violations otherwise surface
  // as opaque error messages in the toast.
  const { data: existing } = await supabase
    .from("tags")
    .select("id")
    .or(`slug.eq.${slug},name.eq.${name}`)
    .limit(1)
    .maybeSingle();
  if (existing) return { ok: false, error: "A tag with this name already exists." };

  const { error } = await supabase.from("tags").insert({ name, slug });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tags");
  revalidatePath("/");
  revalidateTag(PUBLIC_FEED_TAG);
  return { ok: true };
}

export async function deleteTag(id: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid tag id." };
  await requireManager();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("tags").delete().eq("id", parsed.data);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/tags");
  revalidateTag(PUBLIC_FEED_TAG);
  return { ok: true };
}

const PostStatusInput = z.object({
  postId: z.string().uuid(),
  status: z.enum(["draft", "submitted", "scheduled", "published", "archived"]),
});

export async function setPostStatus(
  postId: string,
  status: "draft" | "submitted" | "scheduled" | "published" | "archived",
): Promise<ActionResult> {
  const parsed = PostStatusInput.safeParse({ postId, status });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  await requireManager();
  const supabase = createSupabaseServerClient();

  // Look up existing row so we can set published_at only on transition to "published"
  // (avoids overwriting the original publish timestamp on re-publish).
  const { data: existing } = await supabase
    .from("posts")
    .select("published_at")
    .eq("id", parsed.data.postId)
    .maybeSingle();

  const update: Record<string, unknown> = { status: parsed.data.status };
  if (parsed.data.status === "published" && !(existing as { published_at?: string | null } | null)?.published_at) {
    update.published_at = new Date().toISOString();
  }
  if (parsed.data.status === "archived") update.archived_at = new Date().toISOString();

  const { error } = await supabase.from("posts").update(update).eq("id", parsed.data.postId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin");
  revalidatePath("/");
  revalidateTag(PUBLIC_FEED_TAG);
  return { ok: true };
}
