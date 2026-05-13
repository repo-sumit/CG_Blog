import "server-only";

// Email HTML templates. Table-based layout + inline styles — required for
// Outlook/Gmail/iOS Mail compatibility. Body stays light-themed for
// readability (most clients ignore or invert dark CSS), but the masthead
// keeps the dark portal aesthetic so the brand still reads.

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

interface PostNotificationInput {
  title: string;
  slug: string;
  excerpt: string | null;
  /** Plain-text first paragraph (already stripped of HTML). Optional fallback. */
  firstParagraph: string | null;
  authorName: string;
  readTimeMinutes: number;
  /** Absolute public URL for the cover image, or null when none. */
  coverUrl: string | null;
}

interface BaseTemplateOpts {
  appUrl: string;
  unsubscribeUrl: string;
}

// ============================================================
// Welcome
// ============================================================

export function welcomeTemplate({ appUrl, unsubscribeUrl }: BaseTemplateOpts) {
  return {
    subject: "Signal locked — CG Signal is live in your inbox",
    text: `[CG SIGNAL // SUBSCRIPTION CONFIRMED]

You're locked in.

The moment someone on team Dhurandhar publishes a new signal, you'll get a short notification email with the title, a snippet, and a direct link to read it.

What you'll get:
  · One email per new signal
  · Notes, retros, launches, experiments
  · Direct links to read, comment, react

What you won't get:
  · Daily nags or batch digests
  · Tracking pixels
  · Spam, ever

Open the portal: ${appUrl}
Unsubscribe anytime: ${unsubscribeUrl}

— Team Dhurandhar`,
    html: shell(
      `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td>
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#ff5a1f;font-weight:700;">
                Subscription confirmed
              </div>
              <h1 style="margin:10px 0 14px;font-size:32px;line-height:1.05;font-family:Georgia,serif;letter-spacing:-0.02em;color:#111111;">
                You're locked in.
              </h1>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#374151;">
                The moment someone on <strong>team Dhurandhar</strong> publishes a new
                signal, you'll get a short notification with the title, a snippet, and
                a direct link to read it — no weekly batching, no waiting.
              </p>
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;background:#f4f0df;border:1px solid #e5e7eb;border-radius:10px;">
                <tr>
                  <td style="padding:20px 22px;">
                    <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#ff5a1f;margin-bottom:10px;">
                      What you'll get
                    </div>
                    ${bullet("One email per new signal")}
                    ${bullet("Notes, retros, launches, experiments")}
                    ${bullet("Direct links to read, comment, react")}
                    <div style="height:14px;line-height:14px;font-size:1px;">&nbsp;</div>
                    <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#6b7280;margin-bottom:10px;">
                      What you won't get
                    </div>
                    ${bullet("Daily nags or batch digests", true)}
                    ${bullet("Tracking pixels", true)}
                    ${bullet("Spam, ever", true)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="left" style="padding-bottom:8px;">
              ${primaryButton("Open the portal →", appUrl)}
            </td>
          </tr>
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

// (The old weekly `digestTemplate` was removed in May 2026. CG SIGNAL sends
// per-post notifications now via `postNotificationTemplate` below — there's
// no aggregation flow to re-introduce. If a future weekly-roundup is needed,
// reach for the per-post template + a new shell wrapper rather than reviving
// the old digest chrome.)

// ============================================================
// Per-post notification (preferred for on-publish sends)
// ------------------------------------------------------------
// This is the email we send when a single post goes live — thumbnail at top,
// title, short summary, the first paragraph of the body, and a "Read More"
// button. Replaces the digest-style template for `Post Now` flows; the
// digest template still exists for hypothetical multi-post sends.
// ============================================================

export function postNotificationTemplate({
  appUrl,
  unsubscribeUrl,
  post,
}: BaseTemplateOpts & { post: PostNotificationInput }) {
  const postUrl = `${appUrl}/posts/${post.slug}`;
  const subject = `CG Signal · ${post.title}`;

  // Plain-text fallback for clients that don't render HTML. Kept short and
  // free of the old "END OF TRANSMISSION" debug-style chrome.
  const text = `New signal published.
New signal from ${post.authorName}.

${post.title}

${post.excerpt ?? ""}

${post.firstParagraph ?? ""}

Read more: ${postUrl}

—
Unsubscribe: ${unsubscribeUrl}`;

  // Cover row — real cover image when present, otherwise a brand-coloured
  // placeholder. The src ALWAYS resolves to a stable URL (the /api/og-image
  // proxy or /og-default.png) so email clients can cache it without dealing
  // with Supabase signed-URL TTLs.
  const coverImgSrc = post.coverUrl ?? `${appUrl}/og-default.png`;
  const coverRow = `<tr>
        <td style="padding:0;">
          <a href="${esc(postUrl)}" style="display:block;text-decoration:none;">
            <img
              src="${esc(coverImgSrc)}"
              width="600"
              alt="${esc(post.title)}"
              style="display:block;width:100%;max-width:600px;height:auto;object-fit:cover;border-radius:20px;border:1px solid #e4dfd2;"
            />
          </a>
        </td>
      </tr>`;

  return {
    subject,
    text,
    html: shell(
      `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom:18px;">
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#ff5a1f;font-weight:700;">
                New signal published
              </div>
            </td>
          </tr>

          ${coverRow}

          <tr>
            <td style="padding-top:22px;">
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#5f5f55;">
                New signal from <span style="color:#111111;font-weight:700;">${esc(post.authorName)}</span>
              </div>
              <h1 class="email-title" style="margin:10px 0 14px;font-size:34px;line-height:1.1;font-family:Georgia,serif;letter-spacing:-0.02em;color:#111111;font-weight:700;">
                ${esc(post.title)}
              </h1>
              ${
                post.excerpt
                  ? `<p style="margin:0 0 16px;font-size:17px;line-height:1.5;color:#111111;font-weight:500;">${esc(post.excerpt)}</p>`
                  : ""
              }
              ${
                post.firstParagraph
                  ? `<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#3f3f38;">${esc(post.firstParagraph)}</p>`
                  : ""
              }
              <div style="margin:0 0 12px;">
                ${primaryButton("Read more", postUrl)}
              </div>
              <div style="margin-top:14px;font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.14em;color:#7a7568;">
                ${esc(post.authorName)} · ${post.readTimeMinutes} min read
              </div>
            </td>
          </tr>
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

// ============================================================
// Building blocks
// ============================================================

function shell(bodyHtml: string, { appUrl, unsubscribeUrl }: BaseTemplateOpts) {
  // Hand-rolled HTML for email — table layout + inline styles, the only
  // approach Gmail / Outlook / iOS Mail reliably honour. Inline <style>
  // block at the top is the one exception: a couple of email clients DO
  // honour media queries inside it (Apple Mail, mobile Gmail web), enough
  // to deliver responsive padding/title-size tweaks without breaking
  // anywhere else.
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<title>CG Signal</title>
<style>
  @media only screen and (max-width: 600px) {
    .email-container { width: 100% !important; max-width: 100% !important; }
    .email-padding   { padding: 24px 18px !important; }
    .email-title     { font-size: 28px !important; line-height: 1.15 !important; }
    .email-cta       { display: block !important; width: 100% !important; box-sizing: border-box; text-align: center; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:#f4f0df;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f0df;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="email-container" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #ded8c8;border-radius:18px;overflow:hidden;">
          <!-- Masthead — minimal, dark portal -->
          <tr>
            <td style="padding:18px 24px;background:#08090d;">
              <a href="${esc(appUrl)}" style="text-decoration:none;display:block;">
                <div style="font-family:Georgia,serif;font-size:22px;font-weight:800;color:#f5f1e8;letter-spacing:-0.01em;">
                  CG&nbsp;SIGNAL
                </div>
                <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#a8a294;margin-top:4px;">
                  ConveGenius · Team Blog
                </div>
              </a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="email-padding" style="padding:28px 28px 32px;">${bodyHtml}</td>
          </tr>
          <!-- Footer — clean, two short lines, unsubscribe required by RFC 8058 -->
          <tr>
            <td style="padding:18px 28px 22px;border-top:1px solid #ded8c8;background:#fbf8ef;">
              <div style="font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#5f5f55;">
                CG SIGNAL · ConveGenius Team Blog
                <br />
                You received this email because you subscribed to CG SIGNAL.
                <br />
                <a href="${esc(unsubscribeUrl)}" style="color:#5f5f55;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${esc(appUrl)}" style="color:#5f5f55;text-decoration:underline;">Open portal</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function bullet(text: string, negative = false): string {
  const mark = negative ? "✕" : "●";
  const markColor = negative ? "#9ca3af" : "#35d07f";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:4px;">
      <tr>
        <td valign="top" width="20" style="font-family:'Space Mono','SF Mono','Menlo',monospace;color:${markColor};font-size:12px;line-height:1.4;">${mark}</td>
        <td valign="top" style="font-size:14px;line-height:1.5;color:#374151;">${esc(text)}</td>
      </tr>
    </table>`;
}

function primaryButton(label: string, href: string): string {
  // Cream-on-cream-text would be invisible; the email-side CTA is dark with
  // white ink to match the in-app primary button. `.email-cta` class lets
  // the media query in the shell expand it to full-width on mobile.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#08090d;border-radius:999px;">
          <a href="${esc(href)}" class="email-cta" style="display:inline-block;padding:14px 28px;color:#ffffff;font-weight:700;font-size:12px;text-decoration:none;letter-spacing:0.14em;text-transform:uppercase;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}
