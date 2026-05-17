import "server-only";
import { cookies } from "next/headers";
import type { AppRole } from "@/lib/db/types";

/**
 * View Mode — lets admins/authors temporarily browse as a regular viewer
 * (read-only member). It's UI-only: the user's actual role in the DB and
 * their RLS permissions are unchanged. We just hide editing controls and
 * redirect privileged routes when the cookie is present.
 *
 * Storage: a single HTTP-only cookie. Easy to read in server components and
 * the middleware. Cleared by the toggle action when exiting view mode.
 */

export const VIEW_MODE_COOKIE = "cg_view_mode";
const VIEW_MODE_VALUE = "member";

/** True if the current request is in view-as-member mode. */
export async function isViewModeActive(): Promise<boolean> {
  try {
    const store = await cookies();
    const c = store.get(VIEW_MODE_COOKIE);
    return c?.value === VIEW_MODE_VALUE;
  } catch {
    return false;
  }
}

/**
 * Returns the *effective* role for UI decisions, demoting to "viewer" when
 * view mode is active. Use this anywhere you'd otherwise read `profile.role`
 * to decide whether to show an edit/admin control.
 */
export async function effectiveRole(actualRole: AppRole): Promise<AppRole> {
  return (await isViewModeActive()) ? "viewer" : actualRole;
}
