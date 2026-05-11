import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Two-step unsubscribe.
 *
 *  GET  /api/subscribe/unsubscribe?t=...  → confirmation page with a button
 *  POST /api/subscribe/unsubscribe        → actually unsubscribes (token in body)
 *
 * Why not just GET-with-side-effect: email clients (Gmail, Outlook, corporate
 * security scanners) routinely prefetch links in emails to check for malware.
 * A GET that toggles unsubscribed would mark people as opted-out without them
 * clicking. The form's POST won't fire on a prefetch.
 *
 * The page also supports RFC 8058 (List-Unsubscribe-Post: One-Click) — Gmail
 * sends POST directly to this URL with `List-Unsubscribe=One-Click` in the body
 * when the user clicks the inbox-level "Unsubscribe" link; we handle it.
 */

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!TOKEN_RE.test(token)) {
    return new NextResponse(missingTokenPage(), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
  return new NextResponse(confirmPage(token), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function POST(request: NextRequest) {
  // Accept token either as a form field (List-Unsubscribe one-click POST sends
  // it in the body) or as a query param (our own form posts with ?t= in the URL).
  let token = request.nextUrl.searchParams.get("t") ?? "";
  if (!token) {
    try {
      const form = await request.formData();
      const fromBody = form.get("t");
      if (typeof fromBody === "string") token = fromBody;
    } catch {
      // ignore; we'll treat as missing below
    }
  }

  if (!TOKEN_RE.test(token)) {
    return new NextResponse("Missing or invalid token", { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { error } = await service
    .from("subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .is("unsubscribed_at", null);
  if (error) {
    console.error("[unsubscribe] update failed", error);
  }

  // For Gmail's RFC 8058 one-click POST, return 204 No Content (no UI to render).
  // For our own form POST from the confirmation page, return a friendly HTML page.
  const wantsHtml = request.headers.get("accept")?.includes("text/html");
  if (!wantsHtml) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(doneHtml(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

// ============================================================
// HTML pages — minimal inline styles, dark portal theme
// ============================================================

function pageShell(body: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title} — CG Signal</title>
<style>
  body { margin:0; background:#08090d; color:#f5f1e8; font-family:ui-monospace,Menlo,monospace; }
  .wrap { min-height:100vh; display:grid; place-items:center; padding:24px; }
  .card { max-width:480px; background:#11141b; border:1px solid #373c49; border-radius:12px; padding:32px; text-align:center; }
  h1 { font-family:'Orbitron',sans-serif; font-size:24px; margin:0 0 12px; letter-spacing:-0.02em; text-transform:uppercase; }
  p { font-size:14px; line-height:1.6; color:#a8a294; margin:0 0 18px; }
  button, a.btn { display:inline-block; padding:11px 22px; background:#f4f0df; color:#0a0a0a; border:1px solid rgba(17,17,17,.12); text-decoration:none; border-radius:999px; font:600 11px/1 'Space Mono','SF Mono',Menlo,monospace; text-transform:uppercase; letter-spacing:0.18em; cursor:pointer; }
  a.ghost { display:inline-block; margin-top:14px; color:#a8a294; font-size:11px; text-transform:uppercase; letter-spacing:0.16em; text-decoration:underline; }
</style>
</head>
<body><div class="wrap"><div class="card">${body}</div></div></body>
</html>`;
}

function confirmPage(token: string): string {
  return pageShell(
    `
      <h1>Unsubscribe?</h1>
      <p>Stop receiving the CG Signal weekly digest. You can re-subscribe anytime from the portal.</p>
      <form method="post" action="/api/subscribe/unsubscribe?t=${encodeURIComponent(token)}">
        <button type="submit">Confirm unsubscribe</button>
      </form>
      <a class="ghost" href="/">Cancel — back to the portal</a>
    `,
    "Confirm unsubscribe",
  );
}

function doneHtml(): string {
  return pageShell(
    `
      <h1>Unsubscribed</h1>
      <p>You're off the list. No more digests from CG Signal.</p>
      <a class="btn" href="/">Back to the portal</a>
    `,
    "Unsubscribed",
  );
}

function missingTokenPage(): string {
  return pageShell(
    `
      <h1>Link expired</h1>
      <p>That unsubscribe link is malformed or missing its token. Use the link from a recent CG Signal email.</p>
      <a class="btn" href="/">Back to the portal</a>
    `,
    "Link expired",
  );
}
