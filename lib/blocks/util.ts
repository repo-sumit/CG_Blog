// Small utilities shared across block modules.

import type { CMSBlock, CMSBlockType, BlockData } from "./types";
import { slugify } from "@/lib/utils/slugs";

/** Generates a stable id for new blocks. Uses Web Crypto on browsers and Node 18+. */
export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback for environments without randomUUID — good enough for ids.
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Escape a string for safe inclusion in HTML text (NOT for attribute context). */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a string for safe inclusion in HTML attribute values. */
export function escapeAttr(input: string): string {
  return escapeHtml(input);
}

/** Build a CSS-property string for inline styles. */
export function inlineStyle(
  rules: Record<string, string | number | undefined>,
): string {
  return Object.entries(rules)
    .filter(([, v]) => v !== undefined && v !== "" && v !== null)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
}

/** Generate a stable anchor slug for a heading. */
export function headingAnchor(text: string): string {
  return slugify(text || "section");
}

/** Build a fresh CMSBlock with the registered default data. Used by the editor "add block" UX. */
export function makeBlock<T extends CMSBlockType>(
  type: T,
  defaultData: BlockData<T>,
): Extract<CMSBlock, { type: T }> {
  return { id: newId(), type, data: defaultData } as Extract<CMSBlock, { type: T }>;
}
