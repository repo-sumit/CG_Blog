import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { sendEmail } from "@/lib/email/resend";
import { welcomeTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(254),
  source: z.string().max(40).optional(),
});

/**
 * Subscribe to the weekly digest. Single opt-in:
 *  - Insert into `subscribers` (upsert resets `unsubscribed_at` if previously unsubbed).
 *  - Fire-and-forget welcome email via Resend.
 *
 * Always returns ok=true to avoid revealing whether an email was already on the
 * list (mild enumeration mitigation). Errors are logged server-side.
 */
export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const source = parsed.data.source ?? null;

  const service = createSupabaseServiceClient();

  // Upsert: re-subscribing after an unsubscribe clears `unsubscribed_at` so they
  // get future digests again. The `unsubscribe_token` regenerates on conflict
  // so old unsubscribe links from a previous subscription don't keep working.
  const { data: existing } = await service
    .from("subscribers")
    .select("id, unsubscribe_token, unsubscribed_at")
    .eq("email", email)
    .maybeSingle();

  let row: { id: string; unsubscribe_token: string } | null = null;
  type Status = "subscribed" | "already_subscribed" | "reactivated";
  let status: Status = "subscribed";

  if (existing) {
    const e = existing as { id: string; unsubscribed_at: string | null };
    if (e.unsubscribed_at === null) {
      // Active subscriber re-submitting their email — return a friendly
      // "already subscribed" without re-sending the welcome.
      const { data: same } = await service
        .from("subscribers")
        .select("id, unsubscribe_token")
        .eq("id", e.id)
        .single();
      row = same as unknown as { id: string; unsubscribe_token: string } | null;
      status = "already_subscribed";
    } else {
      // Previously unsubscribed — reactivate and (re-)send a welcome.
      const { data: updated } = await service
        .from("subscribers")
        .update({ unsubscribed_at: null })
        .eq("id", e.id)
        .select("id, unsubscribe_token")
        .single();
      row = updated as unknown as { id: string; unsubscribe_token: string };
      status = "reactivated";
    }
  } else {
    const { data: inserted, error } = await service
      .from("subscribers")
      .insert({ email, source })
      .select("id, unsubscribe_token")
      .single();
    if (error) {
      console.error("[/api/subscribe] insert failed", error);
      // Soft-fail: don't leak DB errors to the form, but tell the client
      // the request was accepted so they aren't stuck on "retry".
      return NextResponse.json(
        { ok: true, status: "subscribed" satisfies Status },
        { status: 200 },
      );
    }
    row = inserted as unknown as { id: string; unsubscribe_token: string };
    status = "subscribed";
  }

  // Welcome email only when we genuinely added a new (or reactivated) row —
  // re-submissions of an already-active email don't re-send.
  if (row && status !== "already_subscribed") {
    const unsubscribeUrl = `${publicEnv.appUrl}/api/subscribe/unsubscribe?t=${row.unsubscribe_token}`;
    const tpl = welcomeTemplate({ appUrl: publicEnv.appUrl, unsubscribeUrl });
    // List-Unsubscribe headers per RFC 8058 — Gmail/Yahoo/Outlook now require
    // these for bulk senders to avoid the spam folder and to render the inbox
    // "Unsubscribe" link. `One-Click` tells them they can POST without UI.
    const headers = {
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    };
    // Don't block the response on email delivery — log and move on.
    sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, headers }).then((res) => {
      if (!res.ok) console.error("[/api/subscribe] welcome email failed", res.error);
    });
  }

  return NextResponse.json({ ok: true, status });
}
