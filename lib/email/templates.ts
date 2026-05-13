import "server-only";

// Email HTML templates. Table-based layout + inline styles — required for
// Outlook/Gmail/iOS Mail compatibility. Body stays light-themed for
// readability (most clients ignore or invert dark CSS), but the masthead
// keeps the dark portal aesthetic so the brand still reads.

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
            <td style="padding-bottom:18px;border-bottom:1px solid #e5e7eb;">
              ${tickerStrip(["SIGNAL LOCKED", "SUBSCRIPTION CONFIRMED", "BOOT COMPLETE"])}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;">
              <h1 style="margin:0 0 12px;font-size:32px;line-height:1.05;font-family:Georgia,serif;letter-spacing:-0.02em;">
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
          <tr>
            <td style="padding-top:20px;border-top:1px solid #e5e7eb;">
              ${asciiSignoff()}
            </td>
          </tr>
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

// ============================================================
// Per-post / daily digest
// ------------------------------------------------------------
// `weekLabel` is kept as the prop name for back-compat with existing callers,
// but the value the caller passes is now expected to be a daily date string
// like "MAY 13, 2026". Subject lines + body copy say "today's signal" so the
// email reads as a fresh notification rather than a weekly roll-up.
// ============================================================

export function digestTemplate({
  appUrl,
  unsubscribeUrl,
  posts,
  weekLabel,
}: BaseTemplateOpts & { posts: DigestPost[]; weekLabel: string }) {
  if (posts.length === 0) return null;

  const totalMinutes = posts.reduce((sum, p) => sum + p.readTimeMinutes, 0);
  const authorList = Array.from(new Set(posts.map((p) => p.authorName))).join(", ");
  const isSingle = posts.length === 1;
  const single = isSingle ? posts[0]! : null;
  // Subject prefers the post title when only one signal is going out — feels
  // less like a digest and more like a notification.
  const subject = single
    ? `CG Signal · New post from ${single.authorName} · ${single.title}`
    : `CG Signal · ${posts.length} new signals today`;
  const heading = isSingle ? "Today's signal." : "Today's signals.";

  const text = `[CG SIGNAL // ${weekLabel}]\n\n${heading} ${posts.length} new ${
    isSingle ? "post" : "posts"
  } · ~${totalMinutes} min total\nBy: ${authorList}\n\n${posts
    .map(
      (p, i) =>
        `${String(i + 1).padStart(2, "0")} · ${p.title}\n   ${p.excerpt ?? ""}\n   ${p.authorName} · ${p.readTimeMinutes} min\n   ${appUrl}/posts/${p.slug}\n`,
    )
    .join("\n")}\n\nUnsubscribe: ${unsubscribeUrl}`;

  const items = posts
    .map((p, i) => {
      const ordinal = String(i + 1).padStart(2, "0");
      return `
        <tr>
          <td style="padding:20px 0;border-bottom:1px solid #e5e7eb;">
            <a href="${esc(appUrl)}/posts/${esc(p.slug)}" style="text-decoration:none;color:#111827;display:block;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td valign="top" width="40" style="padding-right:14px;">
                    <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:12px;color:#ff5a1f;font-weight:700;letter-spacing:0.05em;">
                      ${ordinal}
                    </div>
                  </td>
                  <td valign="top">
                    <div style="font-size:20px;line-height:1.25;font-weight:700;font-family:Georgia,serif;margin-bottom:6px;color:#111827;">
                      ${esc(p.title)}
                    </div>
                    ${
                      p.excerpt
                        ? `<div style="font-size:14px;line-height:1.55;color:#4b5563;margin-bottom:10px;">${esc(p.excerpt)}</div>`
                        : ""
                    }
                    <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b7280;">
                      ${esc(p.authorName)} · ${p.readTimeMinutes} min read · <span style="color:#ff5a1f;">Read →</span>
                    </div>
                  </td>
                </tr>
              </table>
            </a>
          </td>
        </tr>`;
    })
    .join("");

  return {
    subject,
    text,
    html: shell(
      `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding-bottom:18px;border-bottom:1px solid #e5e7eb;">
              ${tickerStrip([`DAY · ${weekLabel}`, "SIGNAL FEED ACTIVE", "TRANSMISSION INBOUND"])}
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;padding-bottom:8px;">
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#ff5a1f;">
                ${esc(weekLabel)}
              </div>
              <h1 style="margin:6px 0 14px;font-size:30px;line-height:1.05;font-family:Georgia,serif;letter-spacing:-0.02em;">
                ${esc(heading)}
              </h1>
            </td>
          </tr>
          <tr>
            <td>
              ${readoutStrip([
                { label: isSingle ? "Signal" : "Signals", value: String(posts.length) },
                { label: "Total read", value: `${totalMinutes} min` },
                { label: "Contributors", value: String(new Set(posts.map((p) => p.authorName)).size) },
              ])}
            </td>
          </tr>
          <tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                ${items}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding-top:18px;">
              ${primaryButton("Browse the full feed →", appUrl)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:20px;border-top:1px solid #e5e7eb;">
              ${asciiSignoff()}
            </td>
          </tr>
        </table>
      `,
      { appUrl, unsubscribeUrl },
    ),
  };
}

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
  dayLabel,
}: BaseTemplateOpts & { post: PostNotificationInput; dayLabel: string }) {
  const postUrl = `${appUrl}/posts/${post.slug}`;
  const subject = `CG Signal · ${post.title}`;
  const heading = "New signal published.";
  // Plain-text fallback for clients that don't render HTML.
  const text = `[CG SIGNAL // ${dayLabel}]

${heading}
New signal from ${post.authorName}.

${post.title}

${post.excerpt ?? ""}

${post.firstParagraph ?? ""}

Read it: ${postUrl}

—

Unsubscribe: ${unsubscribeUrl}`;

  // Cover row — either the real cover image with a max-height fallback, or a
  // soft brand block. Email clients vary wildly on background-images, so we
  // pin to an `<img>` with a fixed height; the placeholder is just a coloured
  // table cell.
  const coverRow = post.coverUrl
    ? `<tr>
        <td style="padding:0;">
          <a href="${esc(postUrl)}" style="display:block;text-decoration:none;">
            <img src="${esc(post.coverUrl)}" alt="${esc(post.title)}"
              style="display:block;width:100%;height:auto;max-height:320px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb;" />
          </a>
        </td>
      </tr>`
    : `<tr>
        <td style="padding:0;">
          <a href="${esc(postUrl)}" style="display:block;text-decoration:none;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0d12;border-radius:10px;border:1px solid #1f2330;">
              <tr><td style="height:200px;text-align:center;color:#f5f1e8;font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;">
                CG · Signal · New transmission
              </td></tr>
            </table>
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
            <td style="padding-bottom:18px;border-bottom:1px solid #e5e7eb;">
              ${tickerStrip([`DAY · ${dayLabel}`, "SIGNAL FEED ACTIVE", "TRANSMISSION INBOUND"])}
            </td>
          </tr>

          ${coverRow}

          <tr>
            <td style="padding-top:18px;">
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#ff5a1f;">
                New signal from ${esc(post.authorName)}
              </div>
              <h1 style="margin:8px 0 12px;font-size:30px;line-height:1.1;font-family:Georgia,serif;letter-spacing:-0.02em;color:#111827;">
                ${esc(post.title)}
              </h1>
              ${
                post.excerpt
                  ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#374151;">${esc(post.excerpt)}</p>`
                  : ""
              }
              ${
                post.firstParagraph
                  ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#4b5563;">${esc(post.firstParagraph)}</p>`
                  : ""
              }
              <div style="margin:8px 0 12px;">
                ${primaryButton("Read more →", postUrl)}
              </div>
              <div style="margin-top:8px;font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b7280;">
                ${esc(post.authorName)} · ${post.readTimeMinutes} min read
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top:24px;border-top:1px solid #e5e7eb;">
              ${asciiSignoff()}
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
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>CG Signal</title>
</head>
<body style="margin:0;padding:0;background:#f4f0df;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111827;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f4f0df;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid #d6d3c4;border-radius:14px;overflow:hidden;">
          <!-- Masthead — dark portal -->
          <tr>
            <td style="padding:22px 32px;background:#0b0d12;">
              <a href="${esc(appUrl)}" style="text-decoration:none;display:block;color:#f5f1e8;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td>
                      <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.18em;color:#a8a294;">
                        ConveGenius · Team Blog Portal
                      </div>
                      <div style="font-family:Georgia,serif;font-size:24px;font-weight:800;color:#f5f1e8;margin-top:6px;letter-spacing:-0.01em;">
                        CG&nbsp;SIGNAL
                      </div>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#35d07f;box-shadow:0 0 10px rgba(53,208,127,0.7);margin-right:6px;vertical-align:middle;"></span>
                      <span style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#a8a294;vertical-align:middle;">
                        Live
                      </span>
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:28px 32px;">${bodyHtml}</td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;background:#fafaf6;">
              <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;line-height:1.6;color:#6b7280;text-transform:uppercase;letter-spacing:0.14em;">
                CG SIGNAL · Internal Blog OS · Team Dhurandhar
                <br />
                <a href="${esc(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${esc(appUrl)}" style="color:#6b7280;text-decoration:underline;">Portal</a>
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

function tickerStrip(items: string[]): string {
  const cells = items
    .map(
      (item, i) =>
        `<td style="padding:6px 14px;font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.16em;color:#111827;${i > 0 ? "border-left:1px solid #d6d3c4;" : ""}">${esc(item)}</td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#f4f0df;border:1px solid #d6d3c4;border-radius:999px;overflow:hidden;"><tr>${cells}</tr></table>`;
}

function readoutStrip(stats: { label: string; value: string }[]): string {
  const cols = stats
    .map(
      (s, i) => `
        <td valign="top" width="33%" style="padding:14px 16px;${i > 0 ? "border-left:1px solid #e5e7eb;" : ""}">
          <div style="font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:10px;text-transform:uppercase;letter-spacing:0.14em;color:#6b7280;">
            ${esc(s.label)}
          </div>
          <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;margin-top:2px;color:#111827;">
            ${esc(s.value)}
          </div>
        </td>`,
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;background:#f4f0df;border:1px solid #d6d3c4;border-radius:10px;"><tr>${cols}</tr></table>`;
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
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="background:#0b0d12;border-radius:999px;">
          <a href="${esc(href)}" style="display:inline-block;padding:13px 26px;color:#f5f1e8;font-weight:700;font-size:11px;text-decoration:none;letter-spacing:0.18em;text-transform:uppercase;font-family:'Space Mono','SF Mono','Menlo',monospace;">
            ${esc(label)}
          </a>
        </td>
      </tr>
    </table>`;
}

// Decorative monospace block — pure text so it renders in every client.
function asciiSignoff(): string {
  return `
    <pre style="margin:0;padding:0;font-family:'Space Mono','SF Mono','Menlo',monospace;font-size:11px;line-height:1.4;color:#9ca3af;white-space:pre;letter-spacing:0;">
&gt; END OF TRANSMISSION
&gt; SIGNAL: STABLE · CHANNEL: LIVE
&gt; — team dhurandhar
    </pre>`;
}
