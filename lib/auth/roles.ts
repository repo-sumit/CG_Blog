import type { AppRole } from "@/lib/db/types";

/**
 * UI labels for each role. The DB enum keeps `manager` for stability (renaming
 * the enum value would require a schema migration + RLS helper renames), but
 * the UI surfaces it as "Admin" per current product naming.
 */
export const ROLE_LABEL: Record<AppRole, string> = {
  viewer: "Viewer",
  author: "Author",
  manager: "Admin",
};

export function roleLabel(role: AppRole | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABEL[role];
}

export function canAuthor(role: AppRole | null | undefined) {
  return role === "author" || role === "manager";
}

export function isManager(role: AppRole | null | undefined) {
  return role === "manager";
}

/** Convenience alias — "admin" is the product term for manager. */
export const isAdmin = isManager;

export function isValidDomain(email: string, allowedDomain: string) {
  const e = email.trim().toLowerCase();
  const d = allowedDomain.trim().toLowerCase();
  if (!e.includes("@") || !d) return false;
  return e.split("@")[1] === d;
}
