// Server-side sanitizer for Tiptap-generated HTML. We trust the Tiptap schema
// for the most part; this pass is defense-in-depth — strip scripts, event
// handlers, and javascript: URLs in case the HTML was tampered with upstream
// of the editor. Iframes are stripped EXCEPT when their `src` is on an
// allow-listed embed provider (YouTube, Vimeo, Loom, Drive), which is how
// external video embeds reach the rendered post.

const ON_HANDLER_RE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_RE = /(href|src)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi;
const SCRIPT_BLOCK_RE = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>[\s\S]*?<\/style>/gi;

// Iframes are a special case — match the whole element so we can inspect src.
const IFRAME_RE = /<iframe\b([^>]*)>[\s\S]*?<\/iframe>/gi;

// Hostnames whose iframe embeds are safe (matches the providers in
// `lib/utils/embeds.ts`).
const EMBED_HOST_RE =
  /^(?:https:\/\/)(?:www\.youtube\.com\/embed\/|player\.vimeo\.com\/video\/|www\.loom\.com\/embed\/|drive\.google\.com\/file\/d\/)/i;

function srcOf(attrs: string): string | null {
  const m = attrs.match(/\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3]) ?? null;
}

const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g;
const FORBIDDEN_TAGS = new Set(["script", "object", "embed", "form", "input", "style", "link", "meta"]);

export function sanitizeHtml(input: string): string {
  if (!input) return "";
  let html = input;

  html = html.replace(SCRIPT_BLOCK_RE, "");
  html = html.replace(STYLE_BLOCK_RE, "");

  // Replace each iframe: keep it only if src matches the allow-list.
  html = html.replace(IFRAME_RE, (full, attrs: string) => {
    const src = srcOf(attrs);
    if (!src || !EMBED_HOST_RE.test(src)) return "";
    // Strip event handlers from kept iframes; force allow/sandbox attributes.
    const cleanAttrs = attrs.replace(ON_HANDLER_RE, "");
    return `<iframe${cleanAttrs} loading="lazy" referrerpolicy="no-referrer"></iframe>`;
  });

  html = html.replace(ON_HANDLER_RE, "");
  html = html.replace(JS_URL_RE, '$1="#"');

  html = html.replace(TAG_RE, (match, tag: string) => {
    if (FORBIDDEN_TAGS.has(tag.toLowerCase())) return "";
    return match;
  });
  return html;
}
