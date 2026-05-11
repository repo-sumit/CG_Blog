import "server-only";

/**
 * Minimal Resend client — fetch wrapper, no SDK dependency. The official
 * SDK is fine but adds a package; for the small surface we use (one POST)
 * it's lighter to call the REST endpoint directly.
 *
 * Configuration:
 *   RESEND_API_KEY    — required, get from https://resend.com/api-keys
 *   RESEND_FROM       — required, e.g. "CG Signal <signal@cgsignal.convegenius.ai>"
 *                       Must be a verified Resend domain OR
 *                       "onboarding@resend.dev" for testing.
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Optional reply-to override. */
  replyTo?: string;
  /** Raw email headers to merge in (e.g. List-Unsubscribe per RFC 8058). */
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  ok: boolean;
  /** Resend's message id on success. */
  id?: string;
  error?: string;
}

export async function sendEmail({ to, subject, html, text, replyTo, headers }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!apiKey || !from) {
    return { ok: false, error: "RESEND_API_KEY / RESEND_FROM not configured." };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        reply_to: replyTo,
        headers,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Resend ${res.status}: ${body}` };
    }
    const json = (await res.json()) as { id?: string };
    return { ok: true, id: json.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
