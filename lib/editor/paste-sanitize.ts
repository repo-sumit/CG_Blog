"use client";

/**
 * Paste-time sanitizer for Google Docs / Word / web clippings.
 *
 * Google Docs pastes a tangle of Microsoft-style classes, oversized inline
 * fonts, page-layout containers, and `<b style="font-weight:normal">` quirks
 * that ProseMirror can't render cleanly. The goal here is:
 *
 *   1. Preserve the semantic shape (headings, bold/italic/underline, links,
 *      lists, blockquotes, code).
 *   2. Strip everything that fights the dark-portal theme — explicit fonts,
 *      large pixel sizes, page margins, vendor classes, etc.
 *   3. Drop entire <script>/<style>/<meta>/<link> blocks (defense-in-depth
 *      on top of the server-side sanitizeHtml).
 *
 * This runs through Tiptap's `editorProps.transformPastedHTML`, so the HTML
 * is rewritten BEFORE ProseMirror converts it into the editor schema. Any
 * tag that survives but isn't in the schema gets dropped by ProseMirror
 * automatically — we don't need to whitelist tags here.
 */

// Whitelist of CSS properties we keep on pasted content. Notably absent:
//   - color / background-color / background → these were originally allowed
//     but lock text to whatever shade Google Docs picked, which becomes
//     unreadable in dark mode. The portal theme owns the colour, full stop.
//   - font-family / font-size → noisy and almost always wrong against the
//     hero/UI fonts.
// What survives is purely semantic emphasis + alignment, which translates
// cleanly into the Tiptap schema.
const KEEP_STYLES = new Set([
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
]);

/** Style values we never want to keep, even on whitelisted properties. */
function isUnwantedFontWeight(value: string): boolean {
  // Google Docs wraps everything in `<b style="font-weight:normal">` — drop
  // those values so the wrapping `<b>` collapses to plain text.
  return /font-weight\s*:\s*normal/i.test(value);
}

function sanitizeStyleAttr(raw: string): string {
  const cleaned: string[] = [];
  for (const decl of raw.split(";")) {
    const idx = decl.indexOf(":");
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    if (!KEEP_STYLES.has(prop)) continue;
    if (prop === "font-weight" && isUnwantedFontWeight(`${prop}:${value}`)) continue;
    cleaned.push(`${prop}: ${value}`);
  }
  return cleaned.join("; ");
}

/** Strip a single element's incompatible attributes in place. */
function cleanElement(el: Element): void {
  // Drop all class/id/data-* attributes — these carry Google Docs / Office
  // quirks that don't survive Tiptap's schema anyway.
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name === "href" || name === "src" || name === "alt" || name === "title") continue;
    if (name === "style") {
      const cleaned = sanitizeStyleAttr(attr.value);
      if (cleaned.length === 0) el.removeAttribute(name);
      else el.setAttribute(name, cleaned);
      continue;
    }
    if (name === "rel" || name === "target") continue; // anchors keep these
    el.removeAttribute(name);
  }
}

/**
 * Walk the parsed paste fragment and:
 *   - delete <script>, <style>, <meta>, <link>, <head>
 *   - unwrap Google Docs `<b style="font-weight:normal">` wrappers
 *   - unwrap `<span>` with no surviving styles (they only existed to carry
 *     classes we just stripped)
 *   - strip every attribute except the safe shortlist
 */
function walk(node: Node): void {
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "script" || tag === "style" || tag === "meta" || tag === "link" || tag === "head") {
    el.remove();
    return;
  }

  // Recurse first so we clean children, then unwrap empties.
  for (const child of Array.from(el.childNodes)) walk(child);

  cleanElement(el);

  // Google Docs ships `<b style="font-weight:normal">…</b>` as a wrapper for
  // every paste. After cleanElement, the style is gone, so the wrapping
  // <b> looks like real bold — unwrap it.
  if (tag === "b" && !el.getAttribute("style")) {
    unwrap(el);
    return;
  }

  // Bare spans (no surviving attribute) just add noise to the schema.
  if (tag === "span" && el.attributes.length === 0) {
    unwrap(el);
  }
}

function unwrap(el: Element): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

/** Public hook for Tiptap's `editorProps.transformPastedHTML`. */
export function sanitizePastedHtml(input: string): string {
  if (typeof window === "undefined") return input; // SSR guard
  if (!input || input.length === 0) return input;

  // Quick exit when the paste is obviously plain text wrapped in a single
  // <p> with no styling — keeps the common case fast.
  if (!/<[a-z][^>]*style|class=|<script|<meta|<style|<b\b|<span/i.test(input)) {
    return input;
  }

  const parser = new DOMParser();
  // Wrap in a doc to let DOMParser handle stray <html>/<body> from Word.
  const doc = parser.parseFromString(`<!doctype html><body>${input}</body>`, "text/html");
  const body = doc.body;
  if (!body) return input;

  for (const child of Array.from(body.childNodes)) walk(child);
  return body.innerHTML;
}
