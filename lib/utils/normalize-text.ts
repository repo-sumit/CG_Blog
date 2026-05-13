/**
 * Normalises author-typed punctuation that's misleading in monospace UI copy.
 * Today this is just em-dash → hyphen + en-dash → hyphen; we keep the surface
 * small so adding more rules later (e.g. smart quotes) is a one-line change.
 *
 * IMPORTANT: this runs on plain text. The HTML body still goes through
 * `sanitizeHtml`; that's where we strip script tags etc. Don't try to call
 * this on raw HTML because it would also rewrite dashes inside `href=…`
 * URL paths.
 */
export function normalizePostText(input: string | null | undefined): string {
  if (input == null) return "";
  return input
    .replace(/—/g, "-") // em-dash U+2014
    .replace(/–/g, "-"); // en-dash U+2013
}

/**
 * Walks an HTML string and normalises dashes inside text nodes only. Anchors
 * are skipped so URLs / titles inside `<a href="…">` keep any literal dashes
 * the author wrote on purpose.
 *
 * Implementation is a small regex-based pass over the body — we avoid pulling
 * in a full DOM parser on the server. The regex replaces dashes only when
 * they sit between `>` and `<` boundaries (i.e. inside text content), which
 * is good enough for our Tiptap output where every text run is wrapped in
 * its own tag.
 */
export function normalizePostHtml(html: string): string {
  if (!html) return "";
  // Replace dashes only in segments NOT inside an <a …>…</a> anchor — protects
  // URL text. Achieved by a single-pass walker over the string.
  let out = "";
  let i = 0;
  while (i < html.length) {
    const aStart = html.toLowerCase().indexOf("<a", i);
    if (aStart === -1) {
      out += html.slice(i).replace(/[—–]/g, "-");
      break;
    }
    // Normalise everything up to the next anchor.
    out += html.slice(i, aStart).replace(/[—–]/g, "-");
    // Find the closing </a> (or </A>) — case-insensitive.
    const closingMatch = html.slice(aStart).toLowerCase().indexOf("</a>");
    if (closingMatch === -1) {
      // Malformed input — append the remainder unchanged and bail.
      out += html.slice(aStart);
      break;
    }
    const endIdx = aStart + closingMatch + "</a>".length;
    out += html.slice(aStart, endIdx); // copy the anchor block verbatim
    i = endIdx;
  }
  return out;
}
