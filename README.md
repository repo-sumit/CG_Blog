# CG SIGNAL — ConveGenius Team Blog Newsletter

> A retro-futuristic internal blog + newsletter for the ConveGenius.ai team.
> Public reading, private editing, Mon–Fri publishing cadence, per-post
> newsletter delivery, soft-deletes, comments, reactions, contributor profiles,
> OG-safe social previews, structured discovery metadata, rate-limited public
> writes, Sentry observability, light/dark theming, and a five-person editor
> allowlist — built on Next.js 16 + React 19 + Supabase + Resend.

**Production:** [convegenius-blog.vercel.app](https://convegenius-blog.vercel.app)

---

## Table of contents

1. [Product summary](#1-product-summary)
2. [Feature inventory](#2-feature-inventory)
3. [Access-control model](#3-access-control-model)
4. [Tech stack](#4-tech-stack)
5. [Architecture](#5-architecture)
6. [Route map](#6-route-map)
7. [Database schema](#7-database-schema)
8. [Server actions & API routes](#8-server-actions--api-routes)
9. [Caching strategy](#9-caching-strategy)
10. [Newsletter pipeline](#10-newsletter-pipeline)
11. [Media pipeline](#11-media-pipeline)
12. [Design system](#12-design-system)
13. [Theming](#13-theming)
14. [Local development](#14-local-development)
15. [Deployment](#15-deployment)
16. [Environment variables](#16-environment-variables)
17. [Operations playbook](#17-operations-playbook)
18. [Known limitations](#18-known-limitations)
19. [Future scope](#19-future-scope)
20. [Troubleshooting](#20-troubleshooting)
21. [Docs index](#docs-index)

---

## 1. Product summary

### Problem
The ConveGenius.ai team wants a lightweight place to publish daily work
updates that's better than a Slack thread and lighter than a wiki —
searchable, archived, on a rotating Mon–Fri schedule, visible to the whole
team and any internal teammate who wants to read, and capable of pushing
each new post directly to subscribers' inboxes without a separate
newsletter tool.

### Solution
A public-read / private-write blog with a five-person editor rotation and
an integrated transactional newsletter. Everyone can read; only the five
approved teammates can post. Anyone with a Google account can comment and
react. Any visitor can subscribe to get future posts delivered the moment
they publish.

### Audience
- **5 approved editors** (Aditya + Sumit admins, Om + Insha + Aryan authors)
- **Internal `@convegenius.ai` readers** — full read access without signing in
- **External readers** (cross-team partners, vendors, public) — full read access without signing in
- **Comment/reaction users** — any Google account (`@gmail.com`, `@convegenius.ai`, etc.)
- **Newsletter subscribers** — any email, single opt-in, per-post delivery

### Non-goals
- Not a public CMS — the editor allowlist is hard-pinned to 5 emails.
- Not a growth-marketing site — public reader pages are indexable, but
  editor/admin/API/auth surfaces are blocked in `robots.ts` and non-canonical
  Vercel hosts are 308-redirected to the production domain.
- Not a federation hub — no API for external systems to post on behalf of users.
- Not a long-form discussion forum — comments are 100-char plain text, not threaded.

---

## 2. Feature inventory

### Public reading (no login)
- **Landing page** at `/` — hero, live cadence readout, search box, channel/tag filter pills, section running-heads, fluid post grid with a `Latest` badge, contributor crew section, subscribe block, footer
- **Post detail** at `/posts/[slug]` — sanitized rich-text body, author byline with avatar + role, view count, read time, reaction bar, comment thread, mid-article + bottom subscribe blocks, related posts grid, share button (Web Share API + clipboard fallback)
- **Search** — `?q=` matches against title + excerpt in memory (the catalog is small)
- **Channel filter** — `?tag=<slug>` filters the grid; both filters compose
- **Fluid responsive grid** — auto-fit columns based on container width (≥320 px floor per card), reflows on browser zoom without snap-breakpoints
- **Stable Open Graph + Twitter cards** — `/api/og-image/[slug]` proxy 302-redirects to a fresh signed cover URL every crawler hit, so WhatsApp / LinkedIn / Slack / Twitter previews never break when the underlying signed URL rotates
- **Structured discovery metadata** — `/sitemap.xml` lists home, the archive alias, and published post URLs; `/robots.txt` allows public reader pages while disallowing private surfaces; post pages emit `BlogPosting` JSON-LD
- **Brand fallback image** — `/og-default.png` for posts without a cover
- **Live engagement counts** on cards — views (👁), reactions (❤️), comments (💬)
- **Trailing first-name byline** — `…  6👁  2❤️  3💬                Insha` keeps the card scannable
- **Reading-experience nicety** — drafts and scheduled posts return 404; never leaked to public callers
- **Social preview testing endpoints** — direct-fetchable `/api/og-image/[slug]` for Facebook / LinkedIn / Twitter validator tools
- **Canonical host enforcement** — preview / generated Vercel hosts redirect to `NEXT_PUBLIC_APP_URL`, keeping cookies, shared links, and social previews pinned to one origin

### Authentication
- **Google OAuth** (any Google account — Workspace, Gmail, ConveGenius)
- **Magic link** email sign-in (Supabase Auth's built-in email sender or Resend if SMTP configured)
- **Login page** at `/login` — split layout, hero + form, mobile-stacked
- **Auth callback** at `/api/auth/callback` — bootstraps a `profiles` row on first sign-in
- **Sign-out** at `/api/auth/signout` — clears the Supabase session cookie + redirects to `/login`
- **Unauthorized page** at `/unauthorized` — shown to non-editors who hit editor routes; reason-coded via `?reason=`
- **No domain block** for the comment/react audience — gating happens at the editor tier
- **Pre-hydration session** via Supabase SSR cookies — pages load with the user's session already resolved server-side

### Engagement (any signed-in user)
- **6-reaction bar** — Like / Love / Funny / Celebrate / Watching / Launch use accessible Lucide icon buttons while preserving the emoji keys (`👍 ❤️ 😂 🎉 👀 🚀`) in the database; multi-react allowed; tap again to remove
- **Optimistic UI** for reactions — toggle reflects instantly, server reconciles
- **Plain-text comments** — 100-char body limit, soft-deletable, live counter with red/yellow/green tone
- **Soft-delete** — comment author + post author + admins can delete; deleted rows excluded by reads
- **Trash semantics** — `deleted_at` + `deleted_by` columns preserve audit trail
- **Sign-in CTA** for anonymous visitors on the post page (clicking reaction/comment input prompts sign-in)

### Writing (5-person editor allowlist)
- **TipTap rich-text editor** at `/editor/new` (alias `/transmit`) and `/editor/[id]`
- **Lazy editor bundle** — `PostEditorLoader` keeps TipTap and custom extensions out of non-editor routes and shows an authenticated skeleton while the editor chunk loads client-side
- **Three-button publish workflow** — Save Draft / Schedule Post / Post Now (or Submit for Review when manager review is enabled)
- **Status workflow** — `draft → submitted (optional) → scheduled → published → archived`
- **Server autosave** every 15 s of inactivity
- **Local draft backup** every 3 s to `localStorage` (key: `cg_signal_draft_${postId || "new"}`) — survives tab crashes; restore-prompt banner on next mount when the local snapshot is newer than the server copy
- **Word + read-time counters** in the editor chrome (220 wpm baseline)
- **Sticky toolbar** — pinned to the viewport while scrolling through long drafts
- **Rich-text features** — bold / italic / underline / strike / highlight / inline-code, H2/H3/H4 headings, bullet / numbered / task lists, blockquote, code blocks, links, text color, horizontal rule, undo / redo, clear formatting
- **Smart-paste from Google Docs / Word / Notion** — `sanitizePastedHtml` strips vendor classes, layout cruft, oversized fonts before TipTap parses
- **Paste-to-embed** — a bare YouTube / Vimeo / Loom / Google Drive URL becomes a typed embed node instead of a raw link
- **Per-post tags** — manager-curated tag catalogue + author shortcut to create new tags inline (server validates + dedupes)
- **Cover image picker** — choose from post media OR upload a new image; thumbnail goes to the `blog-media` Supabase bucket
- **Scheduled publishing** — calendar/time picker, 09:00 UTC default slot, modal validation
- **Revert to draft** — single click un-publishes a published or scheduled post and clears the schedule
- **Weekly template** — load a starter outline (`WEEKLY_TEMPLATE`) into a fresh draft
- **Body media inserts** — image / video / audio uploaded via **direct browser → Supabase Storage** (`lib/media/direct-upload.ts`), bypassing Vercel's 4.5 MB function payload limit; the API only registers metadata after upload and enforces ownership, MIME, size, and rate-limit checks
- **External video embeds** — YouTube, Vimeo, Loom, Google Drive (sandbox-allowlisted iframes via `EmbedBlock` Node extension)
- **HTML sanitizer** (`lib/editor/sanitize.ts`) — strips scripts / event handlers / `javascript:` URLs; gates iframes to the embed allow-list; sets `referrerpolicy="strict-origin-when-cross-origin"` so unlisted YouTube videos don't trip error 153
- **Server-action serialization safety** — TipTap JSON is `JSON.parse(JSON.stringify(...))`'d before crossing the Server Action boundary so non-prototype-clean nodes don't trip Next's serializer

### Engagement metrics — server side
- **Per-post view tracking** — `PostViewTracker` client component fires once per session per post (30-min throttle) into `/api/analytics/post-view` → inserts a row into `post_views`
- **Vercel Analytics** event `post_view` on every navigation (deduped client-side)
- **Aggregate counts** stitched onto every public post via `attachViewCounts` + `attachEngagementCounts` in `lib/db/public.ts` — two batched Supabase round-trips regardless of list size

### Newsletter (Resend integration)
- **Single opt-in subscribe form** on landing + on every public post page (bottom + mid-article inline CTA on long posts)
- **Subscribe rate limit** — optional Upstash Redis sliding-window limiter caps subscribe attempts at 5 / minute per IP and returns standard `X-RateLimit-*` headers on 429 responses
- **Compact subscribe variant** on post pages — same component, drops the gradient halo so it reads as editorial rather than marketing
- **Contributor-hide** — logged-in authors/managers don't see the subscribe blocks on post pages (they drive the newsletter, no need to pitch it)
- **Mid-article CTA** — server-side split of sanitized article HTML at the paragraph break closest to ~55% of the document; gated on ≥400 words + ≥4 break points so short posts never get it
- **Smooth-scroll + focus** — clicking the inline CTA scrolls the bottom subscribe section into view and focuses its email input
- **Per-post newsletter delivery** — when a post is published (Post Now OR scheduled-publish cron), `sendPerPostNewsletter` fans out a per-recipient email with thumbnail + title + excerpt + first paragraph + "Read more" button
- **Idempotent send** — conditional `UPDATE posts SET newsletter_sent_at = now() WHERE id = $1 AND newsletter_sent_at IS NULL` guarantees retries / double-runs never duplicate mail
- **Resend sandbox detection** — when `RESEND_FROM` is `onboarding@resend.dev`, only the Resend-account owner gets delivery; surfaced clearly in `/api/admin/newsletter-diagnostics`
- **Welcome email** — sent on subscription via `welcomeTemplate`, with `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` headers per RFC 8058 (Gmail / Yahoo / Outlook bulk-sender compliance)
- **One-click unsubscribe** — `/api/subscribe/unsubscribe?t=<token>` shows a confirm page, POST confirms, success page links back to newsletter
- **Status reactivation** — re-subscribing after unsubscribe clears `unsubscribed_at` and rotates the unsubscribe token; old unsubscribe links stop working
- **Already-subscribed handling** — friendly "you are already subscribed" toast, no duplicate welcome
- **Subscriber privacy** — never exposed to the public reader; only the manager-only `/admin/subscribers` page reads the table; row-level security on the table + service-role-only access
- **Analytics events** — `subscribe_cta_view` (impression), `subscribe_submit`, `subscribe_success` — all tagged with `placement: landing | post_end | mid_article` + `postSlug`

### Sharing
- **PostShareButton** — Web Share API on supported devices (mobile iOS / Android), copy-to-clipboard fallback elsewhere
- **Hover-checked state** — green border + checkmark toast for 1.5 s after copy
- **Stable URL** — `${NEXT_PUBLIC_APP_URL}/posts/${slug}` (no tracking parameters)
- **Desktop placement** — sits right of the byline metadata
- **Mobile placement** — full-width row below the byline

### Soft-delete + retention (planned 30-day cron)
- **Soft delete** — `status = 'archived'` + `archived_at` timestamp; reversible
- **Trash bin** at `/me/posts` — shows archived posts with a restore button
- **Restore** — returns the post to `draft` (publish flow re-triggers from scratch)
- **Permanent delete** — admin-only or author-on-archived; cascade-removes `post_tags`; `media_assets.post_id` becomes `null` via `on delete set null` so orphaned media is harmless

### Five-day weekly schedule
- **One author per weekday** (Mon–Fri) — manager assigns days via `/admin/schedule`
- **Today's author** card on the dashboard — name + their assigned day + posted/not-yet-posted badge
- **Conflict-detection** — assigning a day already owned forces the manager to clear the old owner first
- **Audit log** — every schedule change is recorded in `audit_logs` (best-effort)

### View as member
- Toggle in the top nav lets editors browse as a viewer
- Persisted in an HTTP-only `cg_view_mode` cookie (24h TTL)
- All editor/admin UI elements hide; protected routes redirect to `/dashboard`
- Sticky yellow banner across the top while active; one-click exit
- Anti-bypass — server guards check the cookie before letting editors into editor surfaces

### Admin
- `/admin` — landing with stat tiles (team size, published this week, awaiting review, all drafts) + section nav
- `/admin/schedule` — drag-free weekday assignment
- `/admin/users` — manage the `authorized_users` allowlist with self-lockout + last-admin guards
- `/admin/tags` — curate the tag library (duplicate detection by name + slug)
- `/admin/analytics` — completion %, posts per author, missed days, total/today/7d post views, top 5 posts, engagement-by-post table, audience mix (logged-in vs anonymous), active subscriber count
- `/admin/subscribers` — manager-gated table of every newsletter signup with status (active/unsubscribed), source, signup date, unsubscribe date; server-side email search + status filter pills; capped at 500 rows
- `/admin/newsletter-diagnostics` — debug endpoint surfacing Resend config, sandbox state, last delivery error

### Runtime safety + observability
- **Boot-time env validation** — `instrumentation.ts` warns in development, refuses broken production boots when required env vars are missing, and enforces a minimum-length `CRON_SECRET`
- **Sentry for browser/server/edge** — client, server, and edge configs initialize only when DSNs are present; Server Component / route-handler errors flow through `onRequestError`
- **Sentry tunnel** — `next.config.mjs` proxies browser events through `/monitoring` to reduce ad-blocker drops; source-map upload is enabled when Sentry org/project/auth env vars exist
- **Global security headers** — every route gets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, strict-origin referrer policy, and a restrictive Permissions Policy
- **Public write rate limits** — `lib/ratelimit.ts` protects newsletter subscribe and authenticated media-registration endpoints when Upstash REST credentials are configured

### Contributors section
- Public `/#contributors` block on the landing page
- **Stable order** — `TEAM_META.displayOrder` in `lib/team.ts` is the single source of truth (Aditya → Sumit → Om → Insha → Aryan); applied in `listContributorStats` AND `listTeam` so admin schedule / dashboard / analytics all match
- **Rich card** per contributor — avatar, name, designation, POD/team, role badge, LinkedIn + GitHub icon links (GitHub only renders when set), topic chips, post count, latest-post tile
- **Topic auto-derive** — top 4 tags by frequency across their published posts; falls back to manual `topics` array when no posts exist
- **Latest-post tile** — title + date in a hover-flat panel; arrows to the post detail page
- **No-publish fallback** — "No transmissions yet" pill instead of a hard-empty card
- **Stable identity badges** — Senior PM / Product Associate / Senior UI/UX Designer / Design Intern / Product Intern

### Dashboard (editors)
- `/dashboard` — author command-center
- **Today's author** highlight if it's a weekday
- **Week-at-a-glance** table — Mon–Fri rows, who owns the day, their status
- **Completion %** for the current week
- **Quick links** — Save Draft / New Transmission / View Schedule

### My Posts
- `/me/posts` (alias `/my-posts`) — author's own posts with status badges, edit links, soft-delete button
- **Trash bin** at the bottom — archived posts + restore + permanent delete (with retention countdown when the cron exists)

---

## 3. Access-control model

Two-tier role. The DB enum is `viewer | author | manager`; the UI surfaces `manager` as **"Admin"** (`roleLabel()` helper).

### Tier 1 — Public reading
- Routes: `/`, `/posts/[slug]`, `/login`, `/unauthorized`, `/api/auth/callback`, `/api/media/file`, `/api/og-image/[slug]`, `/api/subscribe`, `/api/subscribe/unsubscribe`, `/og-default.png`, `/cg.png`
- No session required
- All publicly readable data is fetched through the **service-role client** in `lib/db/public.ts` with a hard `status = 'published'` pin

### Tier 2 — Authenticated commenter / reactor
- Any Google account passes
- On first sign-in, `profiles` row bootstraps with `role = 'viewer'` (or the allowlist role if the email matches)
- Permissions:
  - Comment on published posts (≤ 100-char body, plain text)
  - React (one of each of 6 emojis)
  - Delete their own comments
  - Subscribe / unsubscribe to the newsletter
  - **Cannot** access `/dashboard`, `/me/posts`, `/editor/*`, `/admin/*` — redirected to `/unauthorized?reason=editor`

### Tier 3 — Approved editor (5 emails)

| Email | Role | Day |
|---|---|---|
| aditya.c@convegenius.ai | Admin (manager) | — |
| sumit.kumar@convegenius.ai | Admin (manager) | — |
| om.kumar@convegenius.ai | Author | — |
| insha.naseem@convegenius.ai | Author | — |
| aryan.singh@convegenius.ai | Author | — |

- Authors: create / edit / delete their own posts; upload their own media; delete comments on their own posts
- Admins: everything authors can do + manage all posts; manage allowlist, schedule, tags, subscribers; delete any comment; hard-delete archived posts; access `/admin/*`

### Enforcement layers (defense in depth)
1. **Next proxy + middleware helper** (`proxy.ts` → `lib/supabase/middleware.ts`) refreshes Supabase SSR cookies, canonicalizes the host, and gates non-public routes by session presence; the `PUBLIC_PATHS` list scopes which routes anonymous traffic can reach
2. **Page guards** (`lib/auth/guards.ts`) — `requireAuthor()` / `requireManager()` redirect non-editors to `/unauthorized?reason=editor`
3. **Server actions** — every action begins with Zod-validated input + a `requireSession()` / `requireAuthor()` / `requireManager()` call
4. **Supabase RLS** — defense in depth on every public table; helper functions are `security definer` with locked `search_path`
5. **Service-role isolation** — `SUPABASE_SERVICE_ROLE_KEY` is only read inside `lib/supabase/server.ts → createSupabaseServiceClient()`; never reaches the browser bundle
6. **Editor allowlist** — `authorized_users` table is the source of truth; bootstrap trigger consults it on profile creation

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router)** | Server components + server actions + ISR; `proxy.ts` auth/canonical-host gate |
| UI runtime | **React 19** | current app-router runtime + client components for editor, comments, reactions, subscribe, and theme UI |
| Language | **TypeScript (strict)** | catches half the bugs at compile time; no `any` allowed |
| Database | **Supabase Postgres** | free tier covers a 5-person team; RLS native; easy migrations |
| Auth | **Supabase Auth** (Google OAuth + magic link) | works with Workspace + Gmail; no separate identity provider |
| Storage | **Supabase Storage** (private `blog-media` bucket) | signed URLs, RLS-gated; direct browser uploads sidestep Vercel function payload caps |
| Editor | **TipTap v2** | extensible, JSON-first, secure round-trip; custom AudioBlock/VideoBlock/EmbedBlock extensions |
| Styling | **Tailwind CSS** + custom CSS-variable theme tokens | atomic + design-system-aware; light/dark theme swap without React rerenders |
| Fonts | **next/font** — Orbitron (hero), Space Mono (UI) | self-hosted, no FOUT |
| Validation | **Zod** | one schema for the action input + the runtime check |
| Notifications | **Sonner** | tiny, themeable, accessible toasts |
| Icons | **lucide-react** | tree-shakeable, consistent |
| Transactional email | **Resend** | lightweight REST wrapper, RFC 8058 headers, sandbox / verified domain modes |
| Hosting | **Vercel** | free tier; cron jobs; edge analytics; serverless functions |
| Product telemetry | **Vercel Analytics** + **Speed Insights** | event tracking + web-vitals; SSR-safe; no tracking pixels |
| Error monitoring | **Sentry for Next.js** | browser/server/edge capture, request-error hook, optional source maps, `/monitoring` tunnel |
| Rate limiting | **Upstash Redis** (`@upstash/ratelimit`) | sliding-window limits for public subscribe + authenticated media-registration endpoints |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | unit for utilities, Playwright for the auth flow |

No SWR / React Query. The app is overwhelmingly server-rendered; ISR + `unstable_cache` + tag invalidation (`updateTag` from server actions, `revalidateTag` from cron route handlers) provide the stale-while-revalidate pattern at the server boundary. See `docs/frontend-cache-audit.md` for the full reasoning.

---

## 5. Architecture

### Render model
- **Server Components** by default — every page in `app/` resolves its data on the server before the response is sent
- **Next 16 async route props** — dynamic `params` and `searchParams` are awaited in pages / metadata handlers before use
- **Client Components** opt in with `"use client"` — used only for interactive surfaces (reactions, comments form, share button, subscribe form, theme toggle, post-view tracker, editor)
- **Server Actions** with `"use server"` for every mutation — Zod-validated inputs, ownership checks, revalidation calls, structured `{ ok, error? }` returns

### Read paths
- **Public reads** (landing + post detail + comments + reaction counts + contributor stats) → `lib/db/public.ts` → service-role Supabase client → bypass RLS, strict `status='published'` filter
- **Authenticated reads** (dashboard, /me/posts, /admin/*) → user-session Supabase client → RLS enforced

### Write paths
All writes flow through Server Actions with this pattern:

```ts
"use server";
async function someAction(input: T): Promise<{ ok: boolean; error?: string }> {
  // 1. Zod.safeParse the input
  // 2. requireSession / requireAuthor / requireManager
  // 3. Cross-check ownership via DB lookup if needed
  // 4. Use service-role client for the mutation (actor already verified)
  // 5. revalidatePath + updateTag/revalidateTag for every affected surface
  // 6. Return { ok: true, ... } or { ok: false, error } — never throw across the wire
}
```

### Caching topology

| Surface | Strategy | TTL | Invalidator |
|---|---|---|---|
| Landing post grid / tags / contributor stats | `unstable_cache` keyed per limit, tagged `public-feed` | 60 s | `updateTag("public-feed")` from server actions; `revalidateTag("public-feed", "default")` from scheduled-publish cron |
| Post detail page | `force-dynamic` | none | `revalidatePath("/posts/${slug}")` on publish / comment / reaction |
| Admin / dashboard / my-posts | `force-dynamic` | none | direct `revalidatePath` on writes |
| OG image proxy | `Cache-Control: public, max-age=3600, s-maxage=3600` | 1 h | n/a (fresh DB lookup per uncached hit) |
| Media file proxy | `Cache-Control: public, max-age=3000, s-maxage=3000` | 50 min | pinned 10 min under signed-URL TTL |
| Public media (`/og-default.png`, `/cg.png`) | Next static assets | immutable | n/a |

See `docs/frontend-cache-audit.md` for the full audit + per-surface rationale.

### Pre-hydration theme script
`components/theme/ThemeScript.tsx` runs synchronously inside `<body>` *before* React mounts and stamps `data-theme="dark"` or `data-theme="light"` on `<html>` from localStorage, falling back to the explicit light default. There is no system mode, so first paint is deterministic and avoids a flash of wrong colors.

### Runtime instrumentation
- `instrumentation.ts` runs at process boot, validates required production env vars, warns on recommended observability/rate-limit env vars, and refuses production starts with a weak `CRON_SECRET`
- `register()` imports runtime-specific Sentry config for Node or Edge
- `onRequestError = Sentry.captureRequestError` sends Server Component and route-handler errors to Sentry when a DSN is configured
- Browser errors use `sentry.client.config.ts`; server and edge errors use `sentry.server.config.ts` / `sentry.edge.config.ts`

### Cron
`vercel.json` registers:
- `/api/cron/keep-alive` (`0 6 * * *`) — daily Supabase warm-up read for free-tier projects
- `/api/cron/publish-scheduled` (`0 9 * * *`) — daily due-post promotion; promotes rows whose `scheduled_for` has arrived to `published`, dispatches per-post newsletters, invalidates the `public-feed` tag

All cron requests authenticate via `Authorization: Bearer ${CRON_SECRET}`.

---

## 6. Route map

### Public (no auth)
| Path | Purpose |
|---|---|
| `/` | Landing — hero, search, tag pills, post grid, contributors, subscribe, footer |
| `/posts/[slug]` | Post detail with view tracker, share button, reactions, comments, mid-article + bottom subscribe, related posts |
| `/sitemap.xml` | Dynamic sitemap for home, archive alias, and published post detail pages |
| `/robots.txt` | Allows public reader pages; disallows admin/editor/API/auth surfaces; points at sitemap |
| `/login` | Sign-in (Google OAuth + magic link) |
| `/unauthorized` | Editor-access denied page (reason-coded) |

### Auth-only (any signed-in user — no editor role required)
The auth callback (`/api/auth/callback`) bootstraps a profile for any Google account. Signed-in non-editors can comment / react / subscribe.

### Editor-only (`role` ∈ `{author, manager}`)
| Path | Notes |
|---|---|
| `/dashboard` | Command-center — today's author, week-at-a-glance, quick links |
| `/me/posts` (alias `/my-posts`) | Own posts + trash bin |
| `/editor/new` (alias `/transmit`) | Create — redirects to existing draft for this week if one exists |
| `/editor/[id]` | Edit — TipTap rich-text editor |

### Admin-only (`role === manager`)
| Path | Notes |
|---|---|
| `/admin` | Stats + section cards |
| `/admin/schedule` | Weekday assignment with conflict detection |
| `/admin/users` | Allowlist CRUD with self-lockout + last-admin guards |
| `/admin/tags` | Tag library |
| `/admin/analytics` | Completion + per-author metrics + post engagement |
| `/admin/subscribers` | Newsletter signups with search + filter |

### API routes
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/callback?code=&redirect=` | Supabase OAuth + magic-link return URL |
| POST | `/api/auth/signout` | Clears session, redirects to `/login` |
| POST | `/api/media/upload` | Registers direct Supabase Storage uploads; author-only, ownership-checked, MIME/size-validated, rate-limited |
| GET | `/api/media/file?path=...` | Re-signs a storage path; 302 + 50 min Cache-Control |
| GET | `/api/media/signed-url?path=...` | Admin tooling; auth required |
| GET | `/api/media/list?postId=...` | Cover-image picker source |
| GET | `/api/og-image/[slug]` | Stable OG image proxy — re-signs cover storage path; 302 to default for no-cover or unpublished |
| POST | `/api/subscribe` | Idempotent subscribe; welcome email + reactivation logic |
| GET/POST | `/api/subscribe/unsubscribe?t=<token>` | Confirm + apply unsubscribe |
| POST | `/api/analytics/post-view` | Insert into `post_views` (30 min dedupe per session) |
| GET | `/api/cron/publish-scheduled` | Daily — promote due scheduled posts + send newsletters |
| GET | `/api/cron/keep-alive` | Daily — Supabase keep-alive ping |
| GET | `/api/admin/newsletter-diagnostics` | Manager-only debug endpoint for Resend config |
| POST | `/monitoring` | Sentry browser-event tunnel configured by `withSentryConfig` |

### Redirects (legacy bookmarks)
| Old | → | New |
|---|---|---|
| `/blog` | → | `/` |
| `/blog/[slug]` | → | `/posts/[slug]` |
| `/my-posts` | → | `/me/posts` |
| `/transmit` | → | `/editor/new` |
| `/archive` | → | `/me/posts#trash` |
| Non-canonical Vercel host | 308 → | `NEXT_PUBLIC_APP_URL` host |

---

## 7. Database schema

Migrations in `supabase/migrations/`:

| File | Adds |
|---|---|
| `0001_init.sql` | Enums (`app_role`, `post_status`, `media_type`, `media_source_type`), tables (`app_settings`, `profiles`, `authorized_users`, `tags`, `post_templates`, `posts`, `media_assets`, `post_tags`, `audit_logs`), triggers, indexes |
| `0002_helpers_and_bootstrap.sql` | Helper SQL functions (`is_convegenius_user`, `current_user_role`, `is_manager`, `is_author_or_manager`, `is_authorized_author`, `assign_weekday`, `bootstrap_profile`) |
| `0003_rls_policies.sql` | RLS policies on every table + storage policies on `blog-media` |
| `0004_constraints_and_indexes.sql` | Speed indexes (`posts(author_id, status, updated_at desc)`, `post_tags(tag_id)`) |
| `0005_rewrite_signed_media_urls.sql` | One-shot rewrite of legacy signed URLs into `/api/media/file?path=...` |
| `0007_comments_reactions.sql` | `comments` + `reactions` tables, RLS policies |
| `0008_subscribers.sql` | `subscribers` table with `unsubscribe_token`, `unsubscribed_at`, `source` |
| `0009_newsletter_sent_at.sql` | `posts.newsletter_sent_at` + partial index for unsent posts |
| `0010_post_views.sql` | `post_views` table for engagement analytics |
| `0011_save_performance_indexes.sql` | Indexes that speed up the save-publish hot path |

### Key tables

```sql
posts (
  id uuid PK, author_id uuid → profiles, title, slug unique,
  excerpt, content_json jsonb, content_html, status post_status,
  week_start_date date, assigned_weekday smallint,
  published_at, scheduled_for, cover_media_id,
  read_time_minutes int, newsletter_sent_at timestamptz,
  created_at, updated_at, archived_at
)

profiles (
  id uuid PK → auth.users, email unique, full_name, avatar_url,
  role app_role, weekly_post_day smallint, is_active bool,
  created_at, updated_at
)

authorized_users (
  id uuid PK, email unique, role app_role,
  weekly_post_day smallint, created_by, created_at
)

comments (
  id uuid PK, post_id → posts, user_id → auth.users,
  author_name, author_avatar_url, body (1..100 chars),
  created_at, deleted_at, deleted_by
)

reactions (
  id uuid PK, post_id → posts, user_id → auth.users,
  emoji (check ∈ allowed list), created_at,
  unique (post_id, user_id, emoji)
)

subscribers (
  id uuid PK, email unique, unsubscribe_token uuid,
  unsubscribed_at timestamptz, created_at, source text
)

post_views (
  id uuid PK, post_id → posts, viewer_id uuid (nullable),
  session_id text, created_at,
  unique (post_id, session_id, dedupe_window)
)

media_assets (
  id uuid PK, owner_id → profiles, post_id → posts,
  storage_bucket, storage_path, source_type, media_type,
  mime_type, size_bytes, external_url, provider, title, alt_text,
  duration_seconds, created_at
)
```

---

## 8. Server actions & API routes

### Server actions (App Router `"use server"`)

| File | Functions |
|---|---|
| `app/(app)/editor/actions.ts` | `savePost`, `createDraftFromTemplate`, `createTagAsAuthor`, `softDeletePost`, `restorePost`, `permanentDeletePost`, `archivePost` (alias) |
| `app/(app)/admin/actions.ts` | `setWeekday`, `upsertAuthorizedUser`, `removeAuthorizedUser`, `createTag`, `deleteTag`, `setPostStatus` |
| `app/(app)/actions/viewMode.ts` | `setViewMode(enabled)` |
| `app/posts/[slug]/actions.ts` | `addComment`, `deleteComment`, `toggleReaction` |

### Mutation invariants

Every server action that affects publicly-visible state calls **both**:
- `revalidatePath(<surface>)` — kicks the route segment's render cache
- `updateTag("public-feed")` — expires the `unstable_cache` entries for landing-page reads immediately after editor/admin mutations

The scheduled-publish route handler uses `revalidateTag("public-feed", "default")` instead, because cron runs outside a Server Action.

This pairing is the contract that lets the public feed sit on a 60-second TTL safely.

---

## 9. Caching strategy

### Server-side ISR
- **Landing page** (`app/page.tsx`) — `export const revalidate = 60`; uses `searchParams` so the route is server-rendered, but the heavy Supabase reads inside hit `unstable_cache`
- **Post detail** — `force-dynamic` because it mixes per-user data (session, myReactions); future work to split this surface
- **Admin / dashboard / my-posts** — `force-dynamic`; per-user data, low traffic, no caching value

### `unstable_cache` wrapping
Three public reads wrap their uncached implementation with `unstable_cache`:

```ts
export const listPublicPosts        = unstable_cache(uncached, [key], { revalidate: 60, tags: ["public-feed"] });
export const listPublicTags         = unstable_cache(uncached, [key], { revalidate: 60, tags: ["public-feed"] });
export const listContributorStats   = unstable_cache(uncached, [key], { revalidate: 60, tags: ["public-feed"] });
```

The single `PUBLIC_FEED_TAG` is invalidated on:
- post publish / archive / hard-delete
- admin post-status change
- tag CRUD (admin + author-shortcut)
- cron `publish-scheduled` per promoted row

### Client-side
- **No client cache library** (no SWR, no React Query)
- Comments + reactions use **optimistic UI** + `router.refresh()` after server-action mutations
- Editor saves use a **15s server autosave** + **3s localStorage backup** for crash resilience

### Image cache
- **OG image proxy** — 1 h Cache-Control on the 302 redirect; crawlers cache the resolved bytes for far longer
- **Media file proxy** — 50 min cache, pinned 10 min under the signed-URL TTL so browsers always re-resolve before signatures expire

---

## 10. Newsletter pipeline

### Subscribe flow
1. User submits an email to `POST /api/subscribe` (`{ email, source }`)
2. `checkRateLimit("subscribe", clientIp)` allows 5 attempts / 60 s when Upstash is configured; 429 responses include `X-RateLimit-*` headers
3. Zod validates the email + source length
4. Service-role client looks up the existing subscriber by email
5. Three branches:
   - **New email** → insert + send welcome
   - **Previously unsubscribed** → clear `unsubscribed_at`, rotate token, re-send welcome
   - **Already active** → no DB change, friendly toast
6. Welcome email is fire-and-forget — never blocks the API response
7. Response always returns `{ ok: true }` for accepted requests to mitigate enumeration; errors are logged server-side

### Per-post send flow (Post Now)
1. Editor calls `savePost(... status: "published")`
2. Action publishes the row + revalidates paths/tags
3. Action calls `sendPerPostNewsletter(postId)`
4. Newsletter helper:
   - `UPDATE posts SET newsletter_sent_at = now() WHERE id = $1 AND newsletter_sent_at IS NULL RETURNING id` — guarantees one-shot delivery
   - If no row returned, the post was already sent → skip
   - Fetch post + author + cover signed URL (or `/og-default.png`)
   - Select `subscribers WHERE unsubscribed_at IS NULL`
   - For each recipient, render `postNotificationTemplate` and call `sendEmail`
   - Per-recipient List-Unsubscribe URL embedded with the recipient's token

### Per-post send flow (scheduled cron)
- `/api/cron/publish-scheduled` runs daily at `0 9 * * *` via Vercel
- Selects `posts WHERE status = 'scheduled' AND scheduled_for <= now()`
- Promotes each to `published`, sets `published_at = scheduled_for`
- Calls `sendPerPostNewsletter` (same idempotent path)
- Revalidates `/`, `/posts/${slug}`, and the `public-feed` tag

### Unsubscribe flow
- `/api/subscribe/unsubscribe?t=<token>` GET → confirmation page
- POST same URL → sets `unsubscribed_at = now()` matching the token
- Already-unsubscribed tokens return "Already unsubscribed" page
- Malformed / missing tokens → "Link expired" page
- All pages link back to `/` ("Back to the newsletter")

### Resend modes
- **Sandbox** — `RESEND_FROM = onboarding@resend.dev` delivers ONLY to the Resend account owner email. Detected automatically; surfaced as a warning in `/api/admin/newsletter-diagnostics`
- **Verified domain** — `RESEND_FROM = newsletter@<your-domain>` after DNS verification; delivers to anyone

### Diagnostics
- `/api/admin/newsletter-diagnostics` (manager-only) returns:
  - Active Resend config (without exposing the API key)
  - Sandbox/verified status
  - Subscriber counts
  - Last delivery error if any

---

## 11. Media pipeline

### Direct upload (current media path)
1. User picks a file in the editor
2. Editor calls `directUploadMedia({ file, postId })` from `lib/media/direct-upload.ts`
3. Helper builds a storage path shaped as `{userId}/{postId|drafts}/{timestamp}-{filename}`
4. Browser uploads bytes directly to Supabase Storage via the Supabase client — bypasses Vercel's 4.5 MB function payload cap
5. Helper POSTs a tiny JSON metadata payload to `/api/media/upload`
6. Route verifies the caller is an author/manager, rate-limits the request, validates path ownership, strips unsafe filename characters, checks MIME + size caps, and inserts the `media_assets` row
7. Returns `{ signedUrl: "/api/media/file?path=..." }` — a stable URL the editor embeds

### No server byte relay
`/api/media/upload` no longer accepts `multipart/form-data` or streams file bytes through Vercel. All file data goes browser → Supabase Storage; the Next route only records metadata after the object exists.

### Per-request re-signing
- Embedded URLs look like `/api/media/file?path=<storage-path>`
- On every fetch:
  - Path passes regex sanity check (UUID/UUID/anything)
  - Logged-in `@convegenius.ai` users → service signs and 302s
  - Anonymous users → service verifies the `media_assets` row belongs to a `published` post, then signs and 302s
  - Anonymous + path doesn't resolve to a published post → 404
- 50-minute browser cache pinned under the 1-hour Supabase signed-URL TTL

### Validation
- MIME allow-list: `image/jpeg|png|webp|gif`, `video/mp4|webm|quicktime`, `audio/*` subset
- Per-file size caps via env (`NEXT_PUBLIC_MAX_UPLOAD_MB`, video / audio variants)
- Supabase bucket has a per-object byte cap (default 50 MB free tier; raise the bucket setting and env caps together if the project plan supports larger files)
- Metadata registration is limited to 30 uploads / 60 s per authenticated user when Upstash is configured

### Custom TipTap nodes
- `AudioBlock` — schema-aware `<audio>` element with playback chrome
- `VideoBlock` — schema-aware `<video>` element supporting autoplay-muted / poster / loop
- `EmbedBlock` — sandboxed `<iframe>` with `referrerpolicy="strict-origin-when-cross-origin"` so unlisted YouTube videos don't trip error 153

---

## 12. Design system

### Identity
"Retro-futuristic editorial OS." Strong outlines, monospace UI text, hero-font wordmarks, sparing accent colors. Inspired by terminal interfaces + Japanese editorial typography.

### Tokens (CSS variables in `app/globals.css`)

Theme-independent:

```css
--radius-xs: 8px;   --radius-sm: 12px;  --radius-md: 16px;
--radius-lg: 20px;  --radius-panel: 24px; --radius-xl: 32px;
--radius-pill: 999px;
--tracking-tight: -0.04em;  --tracking-label: 0.18em;  --tracking-wide: 0.12em;
--leading-hero: 0.88;       --leading-title: 0.95;     --leading-body: 1.65;
```

Theme palette (dark CSS fallback; light is stamped before first paint for first-time visitors):

```css
--bg-main, --bg-page, --bg-panel, --bg-panel-raised, --bg-panel-soft, --bg-inverse
--text-main, --text-muted, --text-soft, --text-inverse
--border-main, --border-muted, --border-soft
--accent-orange, --accent-blue, --accent-green, --accent-yellow, --accent-red
```

### Fonts
- `Orbitron` 500/700/800/900 — hero wordmarks, panel titles, headlines
- `Space Mono` 400/700 — UI labels, body, metadata, code

### Component primitives

| Primitive | File | Notes |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | 6 variants, pill, hairline border on cream CTAs |
| `Card` | `components/ui/Card.tsx` | alias for `.portal-panel` |
| `Input` / `Textarea` | `components/ui/Input.tsx` | rounded-lg fields with consistent focus ring |
| `Badge` | `components/ui/Badge.tsx` | 8 tonal variants |
| `Avatar` | `components/ui/Avatar.tsx` | initials fallback with border |
| `Select` | `components/ui/Select.tsx` | custom theme arrow |
| `Skeleton` | `components/ui/Skeleton.tsx` | bordered loading pulse |
| `Panel` | `components/portal/Panel.tsx` | 4 variants: default / raised / bright / soft |
| `SystemLabel` | `components/portal/SystemLabel.tsx` | mono uppercase chip |
| `BrandLockup` | `components/portal/BrandLockup.tsx` | icon + "CG Signal · Team Blog Newsletter" wordmark |
| `Ticker` | `components/portal/Ticker.tsx` | marquee utility |

### Utility CSS

| Class | Purpose |
|---|---|
| `.post-grid` | Auto-fit fluid grid for the landing signal feed (320 px floor, `clamp(16, 2vw, 24)` gap) |
| `.post-grid-tight` | Narrower variant for the post-detail related-posts strip (240 px floor) |
| `.grid-overlay`, `.checker`, `.concentric`, `.scanlines` | Decorative pattern backgrounds for thumbnails / hero |
| `.hero-gradient` | Brand radial gradient for the landing hero halo |
| `.signal-glow` | 16 px green box-shadow pulse |
| `.signal-dot` | Pulsing live-transmission dot |

---

## 13. Theming

- **Pre-hydration script** (`components/theme/ThemeScript.tsx`) runs synchronously before paint; reads `cg_signal_theme` from localStorage, falls back to `light`, and stamps `data-theme="dark"` or `data-theme="light"` on `<html>`
- **Light theme as default** for first-time visitors (overrideable via the toggle)
- **Theme toggle** (`components/theme/ThemeToggle.tsx`) — two explicit modes: light / dark; persists to localStorage immediately
- **No "system" mode** — user picks one explicitly; reduces test-matrix surface
- **CSS-variable swap** — switching themes mutates `data-theme` only; no React re-render needed for the entire page; instant visual flip
- See `docs/theme-system.md`, `docs/theme-light-default.md`, `docs/light-mode-guidelines.md` for full color rationale

---

## 14. Local development

```powershell
git clone <repo>
cd CG_Blog
npm install
New-Item -ItemType File .env.local -Force   # then fill in vars from section 16
npm run dev                    # http://localhost:3000
```

### Useful scripts

| Command | Does |
|---|---|
| `npm run dev` | Start Next.js in dev mode |
| `npm run build` | Production build (catches type errors) |
| `npm run lint` | ESLint |
| `npm run typecheck` | tsc --noEmit |
| `npm test` | Vitest unit suite |
| `npm run e2e` | Playwright e2e (requires `AUTH_TEST_BASE_URL`) |

### First-time Supabase setup
1. Create a new Supabase project, copy URL + anon + service-role keys
2. SQL Editor → run migrations 0001 → 0011 **in order**
3. SQL Editor → run `storage.sql` (creates `blog-media` bucket)
4. SQL Editor → run `seed.sql` (default tags, weekly template, 5-person allowlist)
5. **Auth → URL Configuration** → Site URL = `http://localhost:3000`, Redirect URLs = `http://localhost:3000/api/auth/callback` + production URL
6. **Auth → Providers → Google** — paste OAuth client ID + secret from Google Cloud Console
7. **Auth → Providers → Email** → enable Magic Link, disable "Confirm email" for one-click sign-in

### Resend (recommended for newsletter delivery)
1. Create a Resend account; verify a domain or use sandbox sender
2. Create an API key with `Send` permission
3. Add `RESEND_API_KEY` + `RESEND_FROM` to `.env.local`
4. Hit `/api/admin/newsletter-diagnostics` after signing in as a manager to confirm config

---

## 15. Deployment

Hosted on Vercel from the `main` branch.

### One-time setup
1. Import the GitHub repo into Vercel
2. Add env vars (see § 16)
3. Set the production domain
4. Vercel detects `vercel.json` and registers the cron jobs

### Deploy flow
- Push to `main` → Vercel auto-builds and promotes to production
- Preview deployments on generated Vercel hosts 308-redirect to the canonical production host
- Daily cron `/api/cron/publish-scheduled` at `0 9 * * *`
- Daily cron `/api/cron/keep-alive` at `0 6 * * *`

### Canonical URL redirect
`proxy.ts` 308-redirects any non-localhost, non-canonical host to `NEXT_PUBLIC_APP_URL`. Keeps cookies pinned to one host and prevents preview-host OG issues.

---

## 16. Environment variables

### Required

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | both | `https://convegenius-blog.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | both | from Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | both | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | never expose to browser |
| `APP_ALLOWED_EMAIL_DOMAIN` | both | `convegenius.ai` |
| `APP_MANAGER_EMAIL` | both | comma-separated admin emails |
| `APP_AUTHOR_EMAILS` | both | comma-separated author emails |
| `CRON_SECRET` | server | random string, at least 24 chars in production; Vercel uses it to authenticate scheduled jobs |
| `RESEND_API_KEY` | server | Resend transactional email key |
| `RESEND_FROM` | server | `onboarding@resend.dev` (sandbox) or `newsletter@<your-domain>` (verified) |

### Optional

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW` | `false` | If `true`, author Post Now becomes "Submit for review" with `status = submitted` |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `50` | Per-file image upload cap |
| `NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB` | `50` | Per-file video upload cap (free Supabase tier max) |
| `NEXT_PUBLIC_MAX_AUDIO_UPLOAD_MB` | `50` | Per-file audio upload cap |
| `NEXT_PUBLIC_ENABLE_DEMO_WATCHING_COUNTER` | `false` | Shows the explicitly-labelled simulated public-nav activity pill |
| `UPSTASH_REDIS_REST_URL` | unset | Enables rate limiting when paired with token; production boot warns if missing |
| `UPSTASH_REDIS_REST_TOKEN` | unset | Enables rate limiting when paired with URL; production boot warns if missing |
| `NEXT_PUBLIC_SENTRY_DSN` | unset | Browser Sentry capture; production boot warns if missing |
| `SENTRY_DSN` | unset | Server/edge Sentry capture; falls back to public DSN when absent |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | unset | Enables Sentry source-map upload during Vercel builds |

---

## 17. Operations playbook

### Add a new editor
1. Add their email to `APP_AUTHOR_EMAILS` (or `APP_MANAGER_EMAIL`) in Vercel env vars + redeploy
2. Add via `/admin/users` UI after they sign in once OR add to `seed.sql`
3. Next sign-in, their profile gets the new role automatically
4. If you want them in the contributor grid order, set their `displayOrder` in `lib/team.ts`

### Remove an editor
1. `/admin/users` → click trash on their row (refuses if it'd remove the last admin)
2. Their `authorized_users` row is deleted; `profiles.role` drops to `viewer`
3. They can still log in to comment + react, just lose editor access

### Restore an archived post
1. As editor, `/me/posts` → Trash panel
2. Click **Restore** — post goes back to `draft`

### Manually trigger the publish-scheduled cron
```powershell
curl -H "Authorization: Bearer $env:CRON_SECRET" `
  "https://convegenius-blog.vercel.app/api/cron/publish-scheduled"
```

### Investigate a missing newsletter delivery
1. Sign in as a manager, hit `/api/admin/newsletter-diagnostics`
2. Check sandbox flag (Resend sandbox sender = only owner gets mail)
3. Check `posts.newsletter_sent_at` in Supabase — if non-null, the send claim was made
4. Check Resend dashboard's logs for delivery status / bounces
5. See `docs/newsletter-delivery-debug.md` for the full runbook

### Delete a comment as admin
1. Open the post detail page
2. Hover the offending comment → trash icon appears next to author name
3. Click → soft-deleted, removed from public view immediately

### Switch into view-as-member mode
- Click the "View as member" pill (top-right of nav)
- Yellow banner appears; all admin/author UI hides
- Click "Exit view mode" in banner or pill to return

### Change the contributor order
1. Edit `displayOrder` numbers in `lib/team.ts`
2. Deploy — `updateTag("public-feed")` happens automatically on the next editor/admin mutation; force-refresh by triggering any post-related write or wait up to 60 seconds for ISR

---

## 18. Known limitations

| Limitation | Impact | Workaround / status |
|---|---|---|
| **MIME validation trusts the browser** | An attacker could rename `evil.exe` to `cat.png`; server doesn't sniff bytes | Acceptable for an internal 5-author team. Migrate to magic-byte sniffing if uploads ever open to externals. |
| **No comment rate-limiting** | A spammer could in theory post 100 comments fast | Subscribe and media registration are rate-limited via Upstash; add a comments limiter if abuse appears. |
| **Single-region Supabase** | Latency > 200ms for users far from the Supabase region | Acceptable — public reads cache aggressively via ISR; writes are infrequent. |
| **Vercel free tier email throttling** | Magic-link emails throttled to ~30/day from Supabase's built-in sender | Workaround: Google OAuth bypasses email entirely. Resend handles newsletter mail at higher volume. |
| **Search is in-memory filtering over titles + excerpts** | Fetch-then-filter doesn't scale past ~500 posts | Switch to a `tsvector` column + GIN index when corpus grows. |
| **Resend sandbox sender** | `onboarding@resend.dev` only delivers to the Resend account owner | Verify a domain in Resend to fan out to all subscribers. |
| **Per-file upload cap** | 50 MB on Supabase free tier | Upgrade the Supabase plan / bucket object limit and raise the matching `NEXT_PUBLIC_MAX_*_UPLOAD_MB` env caps together. |
| **Post detail page is `force-dynamic`** | Mixes user-specific reactions; can't ISR-cache without splitting public vs user-specific renders | Future work — wrap `getPublicPostBySlug` in `unstable_cache`, render user reactions in a small client component. |
| **No client-side cache library** | No SWR, no React Query | Intentional — server components + ISR cover the SWR pattern for public reads. Adopt SWR only when a heavy client dashboard appears. |
| **`/api/media/file` re-signs every uncached fetch** | Modest Supabase Storage cost per uncached video play | Mitigated by 50-minute browser cache; signed URLs are cheap. |
| **30-day retention cron not yet wired** | Archived posts live forever until manually deleted | Build `/api/cron/cleanup-archived` and add a `vercel.json` cron entry. |
| **Rate limiting degrades open when Upstash is missing** | Subscribe + media-registration limits become no-ops in local/dev or misconfigured envs | `instrumentation.ts` warns in production; set both Upstash REST env vars before launch. |

---

## 19. Future scope

- **Post-detail page caching** — split public + user-specific renders so the post body can ISR
- **Offline reader** — service worker caches the last 10 visited posts' HTML so first-time WhatsApp arrivals work in flight mode
- **SWR adoption** — only justified when a heavy client dashboard appears (realtime drafts list, multi-user editor presence)
- **Full-text search** — Postgres `tsvector` + GIN index once the catalog grows past 500 posts
- **Image versioning** — versioned filenames + `Cache-Control: immutable` for ultra-long cache when thumbnails are updated
- **Webhooks for downstream tools** — Slack notification on publish, Notion mirror, RSS feed
- **Multi-author drafts** — collaborative editing via TipTap collaboration + Y.js + Supabase Realtime
- **Drafts versioning** — `post_revisions` table snapshot on each save with rollback UI
- **30-day retention cron** — build `/api/cron/cleanup-archived` + add it to `vercel.json`
- **Real presence counter** — replace the opt-in simulated `DemoWatchingCounter` with Supabase Realtime presence if live readership becomes useful
- **Magic-byte MIME sniffing** for upload validation
- **Comment threading** — single-level replies, capped at 2 deep
- **Read-time progress bar** — fixed-top scroll-progress strip on long posts

---

## 20. Troubleshooting

### "No API key found in request" on login
**Cause:** `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` missing at build time.
**Fix:** `NEXT_PUBLIC_*` vars are baked into the bundle; add the key in Vercel, redeploy.

### Card thumbnail / OG image broken on WhatsApp / Slack
**Cause:** crawler cached an expired Supabase signed URL.
**Fix:** The OG proxy at `/api/og-image/[slug]` 302-redirects to a fresh signed URL each hit; crawlers cache the resolved bytes. If preview was cached with a direct signed URL from before the proxy existed, append `?v=2` to the shared URL once to force a fresh fetch. See `docs/social-preview-thumbnail-fix.md`.

### Newsletter sent to only one address
**Cause:** Resend sandbox sender (`onboarding@resend.dev`) only delivers to the Resend account owner.
**Fix:** Verify a domain in Resend, switch `RESEND_FROM` to `newsletter@<your-domain>`. See `docs/newsletter-delivery-debug.md`.

### Subscribe or media upload returns 429
**Cause:** Upstash rate limiting is active. Subscribe is limited to 5 attempts / 60 s per IP; media registration is limited to 30 uploads / 60 s per signed-in user.
**Fix:** Wait for the reset time in `X-RateLimit-Reset`. If limits feel too tight for production behavior, adjust `lib/ratelimit.ts`.

### Editor toolbar not sticky on long drafts
**Status:** Fixed. Root cause was `.portal-panel` setting `overflow: hidden`, which interrupts `position: sticky`. Fix moved the toolbar OUTSIDE the Card as a sibling. See `docs/editor-toolbar-layout-fix.md`.

### Video upload fails with "FUNCTION_PAYLOAD_TOO_LARGE"
**Cause:** Vercel function payload cap is 4.5 MB.
**Fix:** Direct upload helper (`lib/media/direct-upload.ts`) PUTs the file straight to Supabase Storage from the browser, sidestepping Vercel entirely. Already wired in the editor.

### YouTube embed shows error 153 for unlisted videos
**Cause:** `referrerpolicy="no-referrer"` strips the Referer header YouTube needs to verify unlisted access.
**Fix:** Switched to `referrerpolicy="strict-origin-when-cross-origin"` in both `EmbedBlock` and the sanitizer. Already deployed.

### Landing page shows stale post counts
**Cause:** ISR 60-second TTL; some non-write event (a new view) hasn't triggered revalidation yet.
**Fix:** Counts on cards lag by ≤60 seconds by design. Post-detail page itself shows live counts. If urgent, trigger any publish or admin write to flush the `public-feed` tag.

### `revalidate` doesn't seem to invalidate after publish
**Check:** editor/admin server actions call **both** `revalidatePath` AND `updateTag("public-feed")`. The scheduled-publish route handler calls `revalidateTag("public-feed", "default")`. The `unstable_cache` entries are only invalidated by the tag; path-only invalidation won't bust them.

### Production refuses to boot with `[instrumentation]`
**Cause:** `instrumentation.ts` detected missing required production env vars or a `CRON_SECRET` shorter than 24 characters.
**Fix:** Add the missing env vars in Vercel and redeploy. For the cron secret, generate a longer value, for example `openssl rand -hex 32`.

### Pre-hydration theme flash
**Status:** Fixed. `<ThemeScript />` runs synchronously as the first child of `<body>` so `data-theme` is stamped before paint, defaulting to light unless `cg_signal_theme` says dark. `suppressHydrationWarning` on `<html>` silences React's mismatch warning since the script intentionally mutates the DOM before React mounts.

### Sticky page wider than viewport on mobile
**Cause:** flex container without `min-w-0` letting an inner element force its intrinsic width.
**Fix:** add `min-w-0` to flex children. See `docs/mobile-spacing-fixes.md` for the catalog of fixes.

### Editor crashes loading an old post with raw `<audio>` / `<video>` HTML
**Cause:** TipTap schema doesn't know `<audio>`/`<video>` by default; the HTML parser drops them and ProseMirror complains.
**Fix:** Custom `AudioBlock` / `VideoBlock` / `EmbedBlock` Node extensions in `lib/editor/media-extensions.ts` add schema support. Already deployed.

### "Only plain objects can be passed to Server Actions"
**Cause:** TipTap's `getJSON()` can return objects with non-`Object.prototype` ancestry, which Next's Server Action serializer rejects.
**Fix:** `JSON.parse(JSON.stringify(editor.getJSON()))` strips prototypes. Already in `handleSave`.

---

## Docs index

Living docs for ops + audit history live in `docs/`:

| Doc | Topic |
|---|---|
| `codebase-stabilization-audit.md` | Overall stability snapshot |
| `editor-publish-scheduling-upgrade.md` | Three-button publish flow rationale |
| `editor-toolbar-collaboration-upgrade.md` | Toolbar redesign |
| `editor-toolbar-layout-fix.md` | Sticky-toolbar root cause |
| `frontend-cache-audit.md` | ISR + `unstable_cache` strategy |
| `google-docs-paste-support.md` | Paste sanitizer rationale |
| `keep-alive.md` | Supabase keep-alive cron |
| `light-mode-guidelines.md` | Light-theme color choices |
| `mobile-responsive-guidelines.md` | Mobile breakpoint rules |
| `mobile-spacing-fixes.md` | Catalog of mobile overflow fixes |
| `newsletter-delivery-debug.md` | Diagnostic runbook |
| `resend-newsletter-delivery.md` | Resend integration design |
| `save-publish-performance-audit.md` | Publish hot-path timings |
| `social-preview-thumbnail-fix.md` | OG proxy design |
| `social-sharing-preview.md` | Share button design |
| `subscribe-feature.md` | Subscribe section design |
| `theme-and-responsive-audit.md` | Theme + responsive audit |
| `theme-light-default.md` | Light-as-default rationale |
| `theme-system.md` | Pre-hydration theme system |

---

_Last updated: 2026-05-17. Maintained alongside the codebase — when behavior changes, this README and the docs above change with it._
