import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/lib/db/types";

export interface SessionContext {
  userId: string;
  email: string;
  profile: ProfileRow;
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile) return null;

  return {
    userId: user.id,
    email: (user.email ?? "").toLowerCase(),
    profile: profile as unknown as ProfileRow,
  };
}

export async function requireSession(): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!ctx) redirect("/login");
  return ctx;
}

export async function requireAuthor(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "author" && ctx.profile.role !== "manager") {
    redirect("/dashboard");
  }
  return ctx;
}

export async function requireManager(): Promise<SessionContext> {
  const ctx = await requireSession();
  if (ctx.profile.role !== "manager") {
    redirect("/dashboard");
  }
  return ctx;
}
