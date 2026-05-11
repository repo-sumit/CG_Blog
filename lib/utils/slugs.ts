// Strip combining marks (U+0300–U+036F) after NFKD decomposition.
const COMBINING_MARK_RE = /[̀-ͯ]/g;

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(COMBINING_MARK_RE, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

export function withSuffix(base: string, suffix: string): string {
  return `${base}-${suffix}`.slice(0, 96);
}
