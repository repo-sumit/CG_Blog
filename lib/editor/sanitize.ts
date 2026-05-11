// Lightweight server-side sanitizer for Tiptap-generated HTML.
// We trust Tiptap's schema-based serializer; this pass is defense-in-depth:
// strip scripts/iframes/event handlers in case content_html was tampered with
// upstream of the editor.

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const ON_HANDLER_RE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_RE = /(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi;
const SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const IFRAME_BLOCK_RE = /<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi;

const FORBIDDEN_TAGS = new Set(["script", "iframe", "object", "embed", "form", "input", "style", "link", "meta"]);

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let html = input;
  html = html.replace(SCRIPT_BLOCK_RE, "");
  html = html.replace(STYLE_BLOCK_RE, "");
  html = html.replace(IFRAME_BLOCK_RE, "");
  html = html.replace(ON_HANDLER_RE, "");
  html = html.replace(JS_URL_RE, "$1=\"#\"");
  html = html.replace(TAG_RE, (match, tag: string) => {
    if (FORBIDDEN_TAGS.has(tag.toLowerCase())) return "";
    return match;
  });
  return html;
}
