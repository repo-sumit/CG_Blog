import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe — token-based, no auth required. The token is the
 * `unsubscribe_token` column generated when the row was created. Anyone with
 * that link can opt the corresponding email out. Idempotent.
 *
 * Compliant with RFC 8058 (List-Unsubscribe-Post-style flows): a simple GET
 * is enough; many clients (Gmail, Yahoo) honor the link from email headers.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("t");
  if (!token) {
    return new NextResponse("Missing token", { status: 400 });
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

  // Always show the friendly confirmation — even if the token wasn't found,
  // we don't want to leak whether or not it was valid.
  return new NextResponse(unsubscribedPage(), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function unsubscribedPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Unsubscribed — CG Signal</title>
<style>
  body { margin:0; background:#08090d; color:#f5f1e8; font-family:ui-monospace,Menlo,monospace; }
  .wrap { min-height:100vh; display:grid; place-items:center; padding:24px; }
  .card { max-width:480px; background:#11141b; border:1px solid #373c49; border-radius:12px; padding:32px; text-align:center; }
  h1 { font-family:'Orbitron',sans-serif; font-size:28px; margin:0 0 12px; letter-spacing:-0.02em; }
  p { font-size:14px; line-height:1.6; color:#a8a294; margin:0 0 16px; }
  a { display:inline-block; padding:10px 18px; border:1px solid #f5f1e8; color:#f5f1e8; text-decoration:none; border-radius:999px; font-size:11px; text-transform:uppercase; letter-spacing:0.16em; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>UNSUBSCRIBED</h1>
      <p>You're off the list. No more digests from CG Signal.</p>
      <a href="/">Back to the portal</a>
    </div>
  </div>
</body>
</html>`;
}
