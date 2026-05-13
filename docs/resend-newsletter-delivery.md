# Resend newsletter delivery — setup + debugging

The CG SIGNAL newsletter sends one email per published post via Resend.
This doc is the single reference for getting deliveries to **every**
subscriber, not just the Resend account owner.

## Root cause when "only one person got the email"

**Resend's sandbox mode.** Every new Resend account starts with the sender
address `onboarding@resend.dev`. While that sender is active, Resend's API
**only delivers to the email that owns the Resend account** — every other
recipient comes back with:

```
You can only send testing emails to your own email address (<owner>).
```

Our loop logs each failure and carries on, so the dispatch *looks*
successful from the app's perspective. Only the owner sees the email.

The app code already detects this and logs it prominently:

```
[newsletter:<postId>] Resend is using sandbox sender (onboarding@resend.dev).
Only the Resend account owner may receive emails. Verify a domain and set
RESEND_FROM. See docs/resend-newsletter-delivery.md.
```

Per-failed-recipient there's also a categorised hint:

```
[newsletter:<postId>] Resend test mode detected. Verify a domain and update
RESEND_FROM.
```

## Fix — verify a domain on Resend

This is the one production-config step required to deliver to all subscribers.

### Step 1 · Add a domain in Resend

1. Go to <https://resend.com/domains>.
2. Click **Add Domain**.
3. Use a **subdomain** — recommended `signal.convegenius.ai`. Subdomains
   keep transactional / newsletter mail isolated from your main domain's
   email reputation, and Google / Outlook prefer it.
4. Resend shows a list of DNS records to add at your DNS provider:
   - **SPF** (`TXT` record) — tells receiving servers Resend is allowed
     to send on behalf of your domain.
   - **DKIM** (`TXT` records, usually 1–3) — signs each message so it can
     be cryptographically verified.
   - **DMARC** (`TXT` record) — optional but recommended for higher
     inbox-placement rates.

### Step 2 · Add the records at your DNS provider

For Cloudflare / Namecheap / GoDaddy / Route 53: open DNS management,
add each record exactly as Resend shows, save. SPF + DKIM propagate in
2–10 minutes typically; DMARC is the same.

**Cloudflare gotcha**: when the type is `CNAME`, make sure the cloud icon
is **grey** (proxied OFF). Resend records can't be proxied through
Cloudflare's edge.

### Step 3 · Wait for verification

Resend shows the domain as **Pending → Verified** when DNS propagates. If
it stays Pending for >30 minutes, double-check the record values (whitespace
differences are common when copy-pasting).

### Step 4 · Update `RESEND_FROM` in Vercel

Vercel dashboard → Project → Settings → Environment Variables. Edit
`RESEND_FROM`:

```env
RESEND_FROM="CG Signal <signal@signal.convegenius.ai>"
```

(Replace the domain with whatever you verified.)

### Step 5 · Redeploy

`RESEND_FROM` is read at runtime, but reploying ensures all serverless
instances pick up the change immediately.

After redeploy, the next published post triggers a real send to every
subscriber. The Vercel function log shows:

```
[newsletter:<postId>] starting · subscribers=N
[newsletter:<postId>] sent · email=user1@example.com
[newsletter:<postId>] sent · email=user2@example.com
…
[newsletter:<postId>] done · attempted=N sent=N failed=0
```

## Required env vars

```env
# Required
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM="CG Signal <signal@signal.convegenius.ai>"
NEXT_PUBLIC_APP_URL=https://<your-production-host>

# Existing — required for the rest of the app
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

If `RESEND_FROM` is left as `onboarding@resend.dev` or anything else
ending in `@resend.dev`, the app logs a sandbox warning at the start of
every dispatch and the `/api/admin/newsletter-diagnostics` endpoint
returns `isSandboxSender: true`.

## Free-tier limits

Free Resend:

- **100 emails per day** total.
- **3000 emails per month** total.
- 1 verified domain.

For a small team blog (today ~5 contributors, ~10–20 subscribers,
~1 post/day) these limits are comfortable. Each post-publish sends one
email per active subscriber, so 20 subscribers × 1 post/day = 20 emails;
well under both caps.

Watch the rate limit when:

- The subscriber list crosses ~80 active addresses (a single Post Now
  burst could clip the 100/day cap).
- You publish multiple posts back-to-back. Each runs the same loop and
  consumes from the same daily budget.

Our code detects 429 / rate-limit responses and logs:

```
[newsletter:<postId>] Resend free-tier rate/usage limit reached
(100/day, 3000/month).
```

If you cross the cap, upgrade to Resend's paid plan or wait until the
window resets (UTC midnight for daily, calendar month for monthly).

## Manager-only diagnostics endpoint

```
GET /api/admin/newsletter-diagnostics
```

Returns JSON like:

```json
{
  "resendConfigured": true,
  "resendFromDomain": "signal.convegenius.ai",
  "isSandboxSender": false,
  "totalSubscribers": 17,
  "activeSubscribers": 14,
  "unsubscribedSubscribers": 3,
  "appUrl": "https://convegenius-blog.vercel.app",
  "publicAppUrlIsLocalhost": false
}
```

Requires manager role; returns 401 / 403 otherwise. Subscriber emails are
**never** included — only counts.

Use this as the first thing you check when "only I got the email":

1. `isSandboxSender: true` → domain not verified / wrong `RESEND_FROM`.
2. `activeSubscribers: 0` → no one's actually subscribed (the form path
   isn't writing to the table, or everyone unsubscribed).
3. `publicAppUrlIsLocalhost: true` → unsubscribe links + post links are
   pointing at localhost; fix `NEXT_PUBLIC_APP_URL`.

## Newsletter loop guarantees

The dispatcher in `lib/email/newsletter.ts`:

1. Bails fast if Resend isn't configured (no `RESEND_API_KEY` or `RESEND_FROM`).
2. Validates post is `published` AND `newsletter_sent_at IS NULL`.
3. **Claims the dispatch** via a conditional UPDATE on `newsletter_sent_at`
   BEFORE iterating subscribers — guarantees Post Now + the publish-
   scheduled cron can't double-send.
4. Pulls **every** active subscriber (`unsubscribed_at IS NULL`) — never
   filters to admin, never short-circuits.
5. Loops per-recipient (NOT `.single()`); each gets a unique unsubscribe
   token in their email + List-Unsubscribe header (RFC 8058).
6. Catches errors per recipient; one bad address never blocks the rest.
7. Returns a summary: `{ attempted, sent, failed, failures, sandboxDetected, rateLimitDetected }`.

## Testing checklist

1. **Verify diagnostics** locally:

   ```
   GET https://<production>/api/admin/newsletter-diagnostics
   ```

   Confirm `isSandboxSender: false`, `resendConfigured: true`,
   `activeSubscribers >= 2`.

2. **Subscribe at least one non-owner email** via the public form.

3. **Publish one post** with Post Now (or schedule and let the cron
   pick it up).

4. **Read the Vercel function log** for `[newsletter:<postId>]` lines.
   Expect:

   - `starting · subscribers=N` once at the top
   - `sent · email=…` once per active subscriber
   - `done · attempted=N sent=N failed=0` at the end

5. **Open the non-owner inbox** — the email should be there. If it
   isn't, the failure log line above will tell you which Resend error
   fired.

## Don'ts

- ❌ Don't keep `RESEND_FROM=onboarding@resend.dev` in production. It
  guarantees the "only one person got the email" bug.
- ❌ Don't expose `RESEND_API_KEY` to the client. It's a server-only var.
- ❌ Don't add subscriber emails to logs.
- ❌ Don't remove the unsubscribe link from the email (RFC 8058 requires
  it for bulk senders; Gmail / Yahoo will dump us in spam without).
- ❌ Don't loop with `Promise.all` over `sendEmail`. Resend rate-limits
  on parallel requests far more aggressively than serial — the existing
  `for…of` keeps things predictable.
