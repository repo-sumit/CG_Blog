// Helpers for safely handling user-supplied redirect URLs.
//
// Anywhere we take a `?redirect=` query param and feed it into NextResponse.redirect,
// we MUST pin it to our own origin. Otherwise an attacker can craft a phishing link:
//
//   /login?redirect=https://evil.example.com
//
// which after auth lands the victim on an attacker domain. `new URL(input, origin)`
// does NOT save us — if input is itself absolute (`https://evil.example.com`), the
// URL constructor returns the absolute URL unchanged.

/**
 * Normalize a `?redirect=` param to a safe same-origin path.
 * Returns `fallback` for anything that isn't a clean absolute path.
 *
 *   safeRedirectPath("/dashboard")               -> "/dashboard"
 *   safeRedirectPath("/posts/foo#comments")      -> "/posts/foo#comments"
 *   safeRedirectPath("//evil.com", "/")          -> "/"        (protocol-relative)
 *   safeRedirectPath("https://evil.com", "/")    -> "/"        (absolute URL)
 *   safeRedirectPath("javascript:alert(1)", "/") -> "/"
 *   safeRedirectPath("\\\\evil.com", "/")        -> "/"        (backslash games)
 */
export function safeRedirectPath(input: string | null | undefined, fallback = "/"): string {
  if (!input || typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (trimmed.length === 0) return fallback;
  // Must start with a single slash and NOT a second slash or backslash.
  // Protocol-relative URLs ("//host") and Windows-style paths ("\\host") are
  // both treated as cross-origin by browsers.
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  // Reject anything containing a colon up to the first slash — catches
  // `javascript:` and other unusual schemes.
  const firstSlash = trimmed.indexOf("/", 1);
  const head = firstSlash === -1 ? trimmed : trimmed.slice(0, firstSlash);
  if (head.includes(":")) return fallback;
  // Reject control characters and newlines (header-injection vectors).
  if (/[\x00-\x1f\x7f]/.test(trimmed)) return fallback;
  return trimmed;
}
