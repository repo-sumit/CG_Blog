import "server-only";

// Email HTML templates. Table-based layout + inline styles — required for
// Outlook/Gmail/iOS Mail compatibility. Tone matches the dark-portal brand
// but the email body is light-themed for readability (most email clients
// force-override or ignore dark CSS).

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(input: string): string {
  return input.replace(/[&<>"']/g, (c) => ESC[c] ?? c);
}

interface DigestPost {
  title: string;
  slug: string;
  excerpt: string | null;
  authorName: string;
  publishedAt: string | null;
  readTimeMinutes: number;
}

interface BaseTemplateOpts {
  appUrl: string;
  unsubscribeUrl: string;
}

// ============================================================
// Welcome email — sent on first subscribe
// ============================================================

export function welcomeTemplate({ appUrl, unsubscribeUrl }: BaseTemplateOpts) {
  return {
    subject: "You're in — ConveGenius Weekly Signals",
    text: `Welcome to ConveGenius Weekly Signals.

You'll get a short digest of the latest team transmissions every Monday morning.
No spam, no tracking pixels. Just notes, retros, launches, and experiments from team Dhurandhar.

Browse the portal: ${appUrl}
Unsubscribe anytime: ${unsubscribeUrl}

— Team Dhurandhar`,
    html: shell(
      `
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;font-family:Georgia,serif;">
          You're in.
        </h1>
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#374151;">
          One short digest a week. The latest transmissions from team Dhurandhar — notes,
          retros, launches, and experiments — and nothing else.
        </p>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#374151;">
          No spam. No tracking pixels. No daily nags.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="background:#111827;border-radius:8px;">
              <a href="${esc(appUrl)}" style="display:inline-block;padding:12px 22px;color:#f5f1e8;font-weight:600;font-size:14px;text-decoration:none;letter-spacing:0.05em;text-transform:uppercase;font-family:'Space Mono',monospace;">
                Open the portal
              </a>
            </td>
          </tr>
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

// ============================================================
// Weekly digest email
// ============================================================

export function digestTemplate({
  appUrl,
  unsubscribeUrl,
  posts,
  weekLabel,
}: BaseTemplateOpts & { posts: DigestPost[]; weekLabel: string }) {
  if (posts.length === 0) {
    // We never enqueue an empty digest, but guard anyway.
    return null;
  }

  const subject = `CG Signal · ${weekLabel} · ${posts.length} transmission${posts.length === 1 ? "" : "s"}`;

  const text = `${subject}\n\n${posts
    .map(
      (p) =>
        `${p.title}\n${p.excerpt ?? ""}\n${p.authorName} · ${p.readTimeMinutes} min\n${appUrl}/posts/${p.slug}\n`,
    )
    .join("\n---\n\n")}\n\nUnsubscribe: ${unsubscribeUrl}`;

  const items = posts
    .map(
      (p) => `
        <tr>
          <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
            <a href="${esc(appUrl)}/posts/${esc(p.slug)}" style="text-decoration:none;color:#111827;">
              <div style="font-size:20px;line-height:1.25;font-weight:700;font-family:Georgia,serif;margin-bottom:6px;">
                ${esc(p.title)}
              </div>
              ${
                p.excerpt
                  ? `<div style="font-size:14px;line-height:1.55;color:#4b5563;margin-bottom:8px;">${esc(p.excerpt)}</div>`
                  : ""
              }
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;font-family:'Space Mono',monospace;">
                ${esc(p.authorName)} · ${p.readTimeMinutes} min read
              </div>
            </a>
          </td>
        </tr>`,
    )
    .join("");

  return {
    subject,
    text,
    html: shell(
      `
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#ff5a1f;font-family:'Space Mono',monospace;margin-bottom:8px;">
          ${esc(weekLabel)}
        </div>
        <h1 style="margin:0 0 24px;font-size:28px;line-height:1.1;font-family:Georgia,serif;">
          This week's signals.
        </h1>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          ${items}
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

// ============================================================
// Shared shell — masthead + footer + unsubscribe
// ============================================================

function shell(bodyHtml: string, { appUrl, unsubscribeUrl }: BaseTemplateOpts) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CG Signal</title>
</head>
<body style="margin:0;padding:0;background:#f4f0df;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f0df;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
          <!-- Masthead -->
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid #e5e7eb;">
              <a href="${esc(appUrl)}" style="text-decoration:none;color:#111827;">
                <div style="font-family:'Space Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:0.16em;color:#6b7280;">
                  ConveGenius · Team Blog Portal
                </div>
                <div style="font-family:Georgia,serif;font-size:22px;font-weight:800;margin-top:4px;">
                  CG SIGNAL
                </div>
              </a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">${bodyHtml}</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid #e5e7eb;background:#fafaf6;border-radius:0 0 12px 12px;">
              <div style="font-family:'Space Mono',monospace;font-size:11px;color:#6b7280;line-height:1.6;">
                You're subscribed to ConveGenius Weekly Signals.
                <br />
                <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                · <a href="${esc(appUrl)}" style="color:#6b7280;text-decoration:underline;">Open the portal</a>
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
