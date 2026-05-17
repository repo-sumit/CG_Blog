"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guards";
import { VIEW_MODE_COOKIE } from "@/lib/auth/viewMode";

// Cookie lifetime — long enough that a deliberate view-mode session survives
// across page navigations and refreshes, short enough that a forgotten toggle
// expires on its own.
const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Flip View Mode on or off. UI-only — does not touch the DB or RLS.
 * Viewers can call this safely too (it's a no-op for them).
 */
export async function setViewMode(enabled: boolean): Promise<{ ok: true }> {
  // Require a session so anonymous clients can't set arbitrary cookies via the
  // server-action endpoint.
  await requireSession();

  const jar = await cookies();
  if (enabled) {
    jar.set(VIEW_MODE_COOKIE, "member", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ONE_DAY_SECONDS,
    });
  } else {
    jar.delete(VIEW_MODE_COOKIE);
  }

  // Refresh every page that gates UI on role so the toggle takes effect
  // immediately without a hard reload.
  revalidatePath("/", "layout");
  return { ok: true };
}
