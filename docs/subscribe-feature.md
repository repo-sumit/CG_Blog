# Subscribe feature

## What it is

The "Receive the next signal" newsletter form on the public landing page.
Collects emails, stores them in the `subscribers` Supabase table, fires a
welcome email via Resend, and gates duplicates server-side.

## Status

Restored on the landing page in the May 2026 mobile/UX pass. The component
and the API route were never deleted — only the `<SubscribeSection />` call
in `app/page.tsx` was commented out. The restore was a 2-line uncomment plus
a polish of the form layout to behave on narrow phones.

## Files

```
components/landing/SubscribeSection.tsx   # the form + success card
app/api/subscribe/route.ts                # POST handler
app/api/subscribe/unsubscribe/route.ts    # one-click unsubscribe (pre-existing)
lib/email/templates.ts                    # welcome email template
lib/email/resend.ts                       # tiny Resend REST client
supabase/migrations/0008_subscribers.sql  # table + RLS (pre-existing)
```

## Table schema

Existing table, not changed in this pass. Naming note: the spec mentioned
`email_subscribers`; the actual table is `subscribers` and has been since the
initial migration. We kept the existing name to avoid a destructive migration.

```sql
create table public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  unsubscribe_token uuid not null default gen_random_uuid() unique,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  last_email_sent_at timestamptz
);
```

RLS:
- `select` denied to all anon / signed-in users.
- `insert` only via service-role client inside the API route.
- `update` only via service-role.

## API behaviour

`POST /api/subscribe` with body `{ email: string, source?: string }`:

| Path | Response | Side effect |
|---|---|---|
| New email | `{ ok: true, status: "subscribed" }` | Insert row, send welcome email |
| Email already active | `{ ok: true, status: "already_subscribed" }` | None — no re-send |
| Previously unsubscribed | `{ ok: true, status: "reactivated" }` | Clear `unsubscribed_at`, send welcome again |
| Invalid email | `{ ok: false, error: "..." }` 400 | None |
| DB error | `{ ok: true, status: "subscribed" }` (soft-fail) | Logged server-side |

Soft-failing on DB error is deliberate — the form recovers cleanly for the
user and ops sees the error in function logs instead of having a stuck UI.

## Client copy

| Outcome | Toast |
|---|---|
| Valid + new | `Signal locked. You are subscribed.` |
| Valid + duplicate | `You are already subscribed.` |
| Invalid email | `Enter a valid email address.` |
| Network / server failure | `Subscription failed. Please try again.` |

## Analytics events

Both fired from the client form, never with the email itself:

```ts
track("subscribe_started", { source: "landing" });
track("subscribe_success", { source: "landing" });
```

## Mobile layout

The form is now stacked on mobile:

```
┌─────────────────────────┐
│ Email                   │
│ ┌─────────────────────┐ │
│ │ your@email.com      │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │      Subscribe      │ │  ← full-width on mobile
│ └─────────────────────┘ │
│ Unsubscribe anytime ·   │
│ No tracking pixels      │
└─────────────────────────┘
```

On `sm+` the Subscribe button becomes auto-width and the column constraints
relax. The button uses the default primary variant which is cream-on-cream-
ink in light mode and cream-on-dark-ink in dark mode — both pass WCAG
contrast.

## Privacy

- Subscriber list is not exposed publicly. RLS blocks reads from anon and
  signed-in clients. Only the service-role client (server-only) can read.
- Unsubscribe is one-click via `/api/subscribe/unsubscribe?t=<token>`. The
  token is a stable UUID per subscriber; new subscriptions regenerate it so
  old unsubscribe links from a deleted-then-recreated subscriber don't keep
  working.
- We never log the email body of the request or the welcome send — only
  Resend's message id on success and the error string on failure.
- Welcome email includes the RFC 8058 `List-Unsubscribe` and
  `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers per Gmail /
  Yahoo / Outlook bulk-sender requirements.

## Env vars required

```env
RESEND_API_KEY=re_...                    # required to send welcomes
RESEND_FROM="CG Signal <hi@yourdomain>"  # required, must be verified at Resend
```

If either is unset the API still records the subscription (no email sent)
and logs the misconfig server-side.
