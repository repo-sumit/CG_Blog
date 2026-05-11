import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectPath = url.searchParams.get("redirect") ?? "/dashboard";
  const supabase = createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const dest = new URL("/login", url.origin);
      dest.searchParams.set("error", error.message);
      return NextResponse.redirect(dest);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const email = user.email.toLowerCase();
  const domain = email.split("@")[1] ?? "";
  const env = serverEnv();

  if (domain !== env.allowedDomain) {
    // Sign the user out so the cookie doesn't linger.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/unauthorized?reason=domain", url.origin));
  }

  // Bootstrap (or refresh) the profile. The DB function reads the allowlist;
  // also reconcile env-driven manager/author overrides so a fresh setup works
  // without having to seed authorized_users by hand.
  try {
    const service = createSupabaseServiceClient();

    // Env-driven sync into authorized_users. Order matters:
    //   1. Every email in APP_MANAGER_EMAIL (now supports comma-separated list)
    //      is upserted as `manager` — always wins.
    //   2. Author emails are inserted only if they don't already exist (so a
    //      teammate promoted to manager via /admin/users isn't demoted on
    //      their next sign-in).
    //   3. The manager list is excluded from the authors loop.
    if (env.managerEmails.length > 0) {
      await service
        .from("authorized_users")
        .upsert(
          env.managerEmails.map((email) => ({ email, role: "manager" as const })),
          { onConflict: "email" },
        );
    }
    const managerSet = new Set(env.managerEmails);
    const authorEmailsToSeed = env.authorEmails.filter((a) => !managerSet.has(a));
    if (authorEmailsToSeed.length > 0) {
      await service
        .from("authorized_users")
        .upsert(
          authorEmailsToSeed.map((email) => ({ email, role: "author" as const })),
          { onConflict: "email", ignoreDuplicates: true },
        );
    }

    // Determine role and weekday for this user.
    const { data: allow } = await service
      .from("authorized_users")
      .select("role, weekly_post_day")
      .eq("email", email)
      .maybeSingle();

    const role = (allow?.role as "manager" | "author" | "viewer" | undefined) ?? "viewer";
    const weekday = (allow?.weekly_post_day as number | null | undefined) ?? null;

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      (meta.full_name as string | undefined) ||
      (meta.name as string | undefined) ||
      email.split("@")[0];
    const avatarUrl =
      (meta.avatar_url as string | undefined) || (meta.picture as string | undefined) || null;

    await service.from("profiles").upsert(
      {
        id: user.id,
        email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role,
        weekly_post_day: weekday,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch (err) {
    console.error("[auth/callback] bootstrap failed", err);
    const dest = new URL("/login", url.origin);
    dest.searchParams.set("error", "Profile bootstrap failed. Contact your admin.");
    return NextResponse.redirect(dest);
  }

  return NextResponse.redirect(new URL(redirectPath, url.origin));
}
