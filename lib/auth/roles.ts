import type { AppRole } from "@/lib/db/types";

export const ROLE_LABEL: Record<AppRole, string> = {
  viewer: "Viewer",
  author: "Author",
  manager: "Manager",
};

export function canAuthor(role: AppRole | null | undefined) {
  return role === "author" || role === "manager";
}

export function isManager(role: AppRole | null | undefined) {
  return role === "manager";
}

export function isValidDomain(email: string, allowedDomain: string) {
  const e = email.trim().toLowerCase();
  const d = allowedDomain.trim().toLowerCase();
  if (!e.includes("@") || !d) return false;
  return e.split("@")[1] === d;
}
