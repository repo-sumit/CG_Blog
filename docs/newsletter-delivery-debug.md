# Newsletter delivery — why "only one person got the email"

## Root cause

Resend's free tier in **test mode** — which is what every new Resend account
ships in — will only deliver email to **the address that owns the Resend
account**. Every other recipient gets a 403 back from the Resend API. Our
loop logs the failure per-recipient and carries on, so the dispatch
completes from the app's perspective but only one inbox ever sees the post.

Concretely, when the `from:` address is `onboarding@resend.dev` (the
sandbox sender Resend assigns to fresh accounts), Resend rejects sends to
any `to:` address that isn't the account owner with:

```
You can only send testing emails to your own email address (sumit.kumar@convegenius.ai).
```

That single line is the entire bug.

## Fix

Verify a domain on Resend and switch `RESEND_FROM` to use it. Steps:

1. **Add a domain** at https://resend.com/domains. For ConveGenius this would be something like `signal.convegenius.ai` (subdomain is fine, and is the recommended pattern so it doesn't share reputation with your transactional `@convegenius.ai` mail).
2. **Set the DNS records** Resend gives you (SPF, DKIM, optional DMARC). They show as TXT / CNAME entries — paste them into Cloudflare or whatever DNS you use.
3. Wait a few minutes; refresh the Resend dashboard until the domain shows **Verified**.
4. **Update env vars** in Vercel:

   ```env
   RESEND_FROM="CG Signal <signal@signal.convegenius.ai>"
   ```

5. **Redeploy** — `RESEND_FROM` is read server-side at runtime so a redeploy
   isn't strictly required, but it makes the timing of the change obvious.

After step 4, the next published post triggers a send to **every** active
subscriber.

## What our code already does right

Verified during this debug pass:

- [lib/email/newsletter.ts](../lib/email/newsletter.ts) fetches **all** active subscribers (`is("unsubscribed_at", null)`) — not just the caller.
- The loop is per-recipient with isolated try/catch; one failure doesn't stop the rest.
- Each subscriber gets a unique `unsubscribe_token` in the link + `List-Unsubscribe` header (RFC 8058) — required by Gmail/Yahoo/Outlook bulk-sender rules.
- `newsletter_sent_at` is stamped via a conditional update *before* sending so racing callers (Post Now + the publish-scheduled cron) can't double-send.
- We log a summary line per dispatch: `[newsletter:<postId>] done · attempted=N sent=N failed=N`. Failures are also logged with the per-recipient error string so you can see exactly which addresses Resend rejected.

So once domain verification is done, the existing code Just Works.

## Free-tier limits to be aware of

Even after verifying a domain, Resend's free tier caps:

- **100 emails per day** total.
- **3000 emails per month** total.
- 1 verified domain.

For our team-blog audience that's plenty for years. If we ever cross those
caps, the failure mode is a 429 from the Resend API — our loop logs each
one and keeps going.

## Required env vars

```env
RESEND_API_KEY=re_xxx
RESEND_FROM="CG Signal <signal@your-verified-domain>"
NEXT_PUBLIC_APP_URL=https://your-production-host
```

If `RESEND_API_KEY` or `RESEND_FROM` is missing, `sendPerPostNewsletter`
returns `{ ok: true, skipped: "not_configured" }` immediately and logs
nothing — failure-mode is silent so the publish flow keeps working.

## Debugging checklist

When a post is published and emails don't show up:

1. Open the Vercel **Functions → Logs** for `/api/cron/publish-scheduled`
   (scheduled post) or the deployment's runtime logs (Post Now). Filter for
   `[newsletter:`.
2. You should see a `starting · N subscribers` line followed by a
   `done · attempted=N sent=N failed=N` line.
3. If `failed > 0`, the next log line lists the per-recipient error. A 403
   with "testing emails" → Resend is in test mode (see Fix above). A 429
   → free-tier cap hit.
4. If the `done` line never appears, the function timed out (Vercel kills
   serverless functions after 10s on Hobby) — check Resend's `from`
   address resolution latency.
5. If `attempted` is way lower than the real subscriber count, the
   `subscribers` table query returned fewer rows than you expect — usually
   means rows have `unsubscribed_at` set when they shouldn't. Inspect the
   table directly in Supabase Studio.

## Email content (May 2026)

The per-post template is now a single-post notification, not a digest:

- Cover image at the top (or a brand-coloured placeholder if no cover)
- Eyebrow: `New signal from {author}`
- Post title
- Excerpt (short summary)
- First paragraph of the body (auto-extracted from HTML, stripped of tags)
- **Read more →** button linking to the public post URL
- ASCII signoff + footer with unsubscribe link

The older digest template still exists in `lib/email/templates.ts` as
`digestTemplate` but no live caller uses it — kept around in case a
"weekly summary" cadence comes back.
