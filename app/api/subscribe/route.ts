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

  if (existing) {
    const { data: updated } = await service
      .from("subscribers")
      .update({ unsubscribed_at: null })
      .eq("id", (existing as { id: string }).id)
      .select("id, unsubscribe_token")
      .single();
    row = updated as unknown as { id: string; unsubscribe_token: string };
  } else {
    const { data: inserted, error } = await service
      .from("subscribers")
      .insert({ email, source })
      .select("id, unsubscribe_token")
      .single();
    if (error) {
      console.error("[/api/subscribe] insert failed", error);
      return NextResponse.json({ ok: true }, { status: 200 }); // soft-fail
    }
    row = inserted as unknown as { id: string; unsubscribe_token: string };
  }

  if (row) {
    const unsubscribeUrl = `${publicEnv.appUrl}/api/subscribe/unsubscribe?t=${row.unsubscribe_token}`;
    const tpl = welcomeTemplate({ appUrl: publicEnv.appUrl, unsubscribeUrl });
    // Don't block the response on email delivery — log and move on.
    sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text }).then((res) => {
      if (!res.ok) console.error("[/api/subscribe] welcome email failed", res.error);
    });
  }

  return NextResponse.json({ ok: true });
}
