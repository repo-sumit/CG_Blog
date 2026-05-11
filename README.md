# CG Signal — Team Blog Portal

> A retro-futuristic internal blog OS for the ConveGenius.ai team.
> Public reading, private editing, soft-deletes with auto-purge, comments, reactions, view-as-member, and a five-person editor allowlist — built on Next.js 14 + Supabase.

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
9. [Design system](#9-design-system)
10. [Local development](#10-local-development)
11. [Deployment](#11-deployment)
12. [Environment variables](#12-environment-variables)
13. [Operations playbook](#13-operations-playbook)
14. [Known limitations](#14-known-limitations)
15. [Future scope](#15-future-scope)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. Product summary

### Problem
The ConveGenius.ai team wants a lightweight place to publish weekly work updates that's better than a Slack thread and lighter than a wiki — searchable, archived, with a rotating posting schedule, and visible to the whole team (and any internal teammate who wants to read).

### Solution
A public-read / private-write blog with a five-person editor rotation. Everyone can read; only the five approved teammates can post. Anyone with a Google account can comment and react.

### Audience
- **5 approved editors** (Sumit + Aditya admins, Om + Insha + Aryan authors)
- **Internal `@convegenius.ai` readers** — full read access without signing in
- **External readers** (cross-team partners, vendors, public) — full read access without signing in
- **Comment/reaction users** — any Google account (`@gmail.com`, `@convegenius.ai`, etc.)

### Non-goals
- Not a public CMS — the editor allowlist is hard-pinned to 5 emails.
- Not a marketing site — `robots: noindex` on `/dashboard`, `/me/posts`, `/editor/*`, `/admin/*`.
- Not a federation hub — no API for external systems to post on behalf of users.

---

## 2. Feature inventory

### Reading (public, no login)
- Public landing at `/` with hero, category filter, featured post, latest-posts grid, contributor list.
- Public post detail at `/posts/[slug]` with sanitized HTML rendering, related posts, reaction bar, comment thread.
- Anonymous visitors can react and comment via the sign-in prompt (Google OAuth, no domain block).

### Writing (5-person editor allowlist)
- Tiptap rich-text editor with autosave (4s debounce), preview mode, weekly-template insertion, word + read-time counters.
- Rich-text features: bold/italic/underline/strike, H2/H3/H4 headings, bullet/numbered/checklist lists, blockquote, inline code, code blocks, links, text color, highlight, horizontal rule, undo/redo, clear formatting.
- Media: image / video / audio uploads to private Supabase storage, served via re-signing `/api/media/file?path=...` route so links never expire.
- External video embeds: YouTube, Vimeo, Loom, Google Drive (sandbox-allowlisted iframes).
- HTML sanitizer (`lib/editor/sanitize.ts`) strips scripts / event handlers / `javascript:` URLs and gates iframes to the embed allow-list.
- Status workflow: `draft → submitted (optional) → scheduled → published → archived`.
- Per-post tag selection (manager-curated tag set).

### Engagement (any signed-in user)
- 6-emoji reaction bar (`👍 ❤️ 😂 🎉 👀 🚀`) — multi-react allowed, toggle to remove.
- Plain-text comments, 100-char limit, soft-deletable, live counter with red/yellow/green tone.
- Comment author + post author + admins can delete any thread comment.

### Soft-delete + 30-day retention
- Deleting a post moves it to `status = "archived"` with `archived_at` timestamp — not a hard delete.
- Trash bin visible on `/me/posts` with "purges in N days" indicator per post.
- Restore action returns the post to `draft`.
- Admin-only "Delete forever" hard-deletes immediately.
- Daily Vercel cron at `/api/cron/cleanup-archived` (03:00 UTC) hard-deletes any archived post older than 30 days.

### Weekly schedule
- One author per weekday (Mon–Fri). Manager assigns days via `/admin/schedule`.
- Dashboard shows today's author, completion % for the week, and missed-post badges.
- Advisory conflict detection — can't assign two people to the same day without unassigning the existing owner first.

### View as member
- Toggle in the top nav lets admins/authors browse as a viewer.
- Persisted in an HTTP-only `cg_view_mode` cookie (24h TTL).
- All editor/admin UI elements hide; protected routes redirect to `/dashboard`.
- Sticky yellow banner across the top while active; one-click exit.

### Admin
- `/admin/schedule` — assign weekdays.
- `/admin/users` — manage the email allowlist (with self-lockout + last-admin guards).
- `/admin/tags` — curate the tag library (duplicate detection).
- `/admin/analytics` — completion %, posts per author, missed days.

---

## 3. Access-control model

Two-tier access. The DB enum is `viewer | author | manager`, but the UI surfaces `manager` as **"Admin"** (`roleLabel()` helper).

### Tier 1 — Public reading
- Routes: `/`, `/posts/[slug]`, `/login`, `/unauthorized`, `/api/auth/callback`, `/api/media/file`.
- Anyone can hit these. No session required.
- Public posts fetched via the **service-role client** (`lib/db/public.ts`) which hard-pins `status = 'published'`.

### Tier 2 — Authenticated comment/react user
- Any Google account passes. Gmail, ConveGenius, other Workspace — all accepted.
- On first sign-in, profile bootstraps with `role = 'viewer'` (or the allowlist role for the 5 approved emails).
- Permissions:
  - Comment on published posts (≤100 char body, plain text)
  - React to published posts (one of each of 6 emojis)
  - Delete their own comments
  - **Cannot** access `/dashboard`, `/me/posts`, `/editor/*`, `/admin/*` — redirected to `/unauthorized?reason=editor`.

### Tier 3 — Approved editor (5 emails)
| Email | Role | Weekday |
|---|---|---|
| sumit.kumar@convegenius.ai | Admin (manager) | Monday |
| aditya.c@convegenius.ai | Admin (manager) | Tuesday |
| om.kumar@convegenius.ai | Author | Wednesday |
| insha.naseem@convegenius.ai | Author | Thursday |
| aryan.singh@convegenius.ai | Author | Friday |

- Authors: create / edit / delete their **own** posts; upload their own media; delete comments on their own posts.
- Admins: everything Authors can do + manage all posts; manage allowlist, schedule, tags; delete any comment; hard-delete archived posts; access `/admin/*`.

### Enforcement layers (defense in depth)
1. **Middleware** (`lib/supabase/middleware.ts`) — gates non-public routes by session presence.
2. **Page guards** (`lib/auth/guards.ts`) — `requireAuthor()` and `requireManager()` redirect non-editors to `/unauthorized?reason=editor`.
3. **Server actions** — every action begins with a Zod-validated input + a `requireSession()` / `requireAuthor()` call.
4. **Supabase RLS** — defense in depth on every public table. Helper functions are `security definer` with locked `search_path`.
5. **Service-role isolation** — `SUPABASE_SERVICE_ROLE_KEY` is only read inside `lib/supabase/server.ts → createSupabaseServiceClient()`; never reaches the browser.

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Server components for fast reads, server actions for mutations, edge middleware for auth |
| Language | TypeScript (strict) | catches half the bugs at compile time |
| Database | **Supabase Postgres** | free tier covers a 5-person team, RLS native |
| Auth | **Supabase Auth** (Google OAuth + magic link) | works with Workspace + Gmail, no separate identity provider |
| Storage | **Supabase Storage** (private `blog-media` bucket) | signed URLs, RLS-gated |
| Editor | **Tiptap** v2 | extensible, JSON-first, secure round-trip |
| Styling | **Tailwind CSS** + custom dark-portal tokens | atomic + design-system-aware |
| Fonts | **next/font** — Orbitron (hero), Space Mono (UI) | self-hosted, no FOUT |
| Validation | **Zod** | one schema for the action input + the runtime check |
| Notifications | **Sonner** | tiny, themeable, accessible |
| Icons | **lucide-react** | tree-shakeable, consistent |
| Hosting | **Vercel** | free tier; cron jobs included |
| Tests | **Vitest** (unit) + **Playwright** (e2e) | unit for utilities, Playwright for the auth flow |

---

## 5. Architecture

### Read paths
- **Public reads** (landing + post detail + comments + reaction counts) → `lib/db/public.ts` → service-role Supabase client → bypass RLS, strict `status='published'` filter.
- **Authenticated reads** (dashboard, /me/posts, /admin/*) → user-session Supabase client → RLS enforced.

### Write paths
All writes go through **server actions** with this signature:

```ts
"use server";
async function someAction(input: T): Promise<{ ok: boolean; error?: string }>
```

Pattern inside every action:
1. Zod `safeParse` the input.
2. Get session via `requireSession()` / `requireAuthor()` / `requireManager()`.
3. Cross-check ownership via DB lookup if needed.
4. Use service-role client to perform the mutation (action has already verified the actor).
5. `revalidatePath()` every affected route.
6. Return `{ ok: true, ... }` or `{ ok: false, error }` — never throw across the wire.

### Media pipeline
1. User picks a file in the editor.
2. Editor POSTs `multipart/form-data` to `/api/media/upload` (Node runtime).
3. Route validates MIME + size + UUID-shape of `postId`, builds path `{userId}/{postId|drafts}/{ts}-{filename}`.
4. Uploads to `blog-media` bucket, inserts `media_assets` row, returns a **stable** URL: `/api/media/file?path=...`.
5. Editor embeds that URL into the HTML (NOT a signed URL).
6. On every render of the post, the browser hits `/api/media/file` → handler re-signs the storage path with a 1-hour TTL → 302-redirects to the fresh signed URL → browser caches the redirect for 50 minutes.

This means uploaded media never expires regardless of how old the post is.

### Comment / reaction pipeline
- Tables: `comments`, `reactions` (added in migration 0007).
- RLS policies allow public read of non-deleted comments/reactions on published posts.
- All inserts/deletes go through server actions in `app/posts/[slug]/actions.ts`.
- Comments soft-delete (`deleted_at`, `deleted_by`); deleted ones are excluded by the read query.
- Reactions toggle (delete-if-exists, insert-otherwise) under a unique `(post_id, user_id, emoji)` constraint.

### Cron
`vercel.json` registers one cron: `/api/cron/cleanup-archived` daily at 03:00 UTC. The handler:
1. Verifies the `Authorization: Bearer ${CRON_SECRET}` header (Vercel injects this automatically).
2. Selects archived posts with `archived_at < now() - 30 days`.
3. Hard-deletes them (cascade removes `post_tags`; `media_assets` foreign key is `on delete set null`).

---

## 6. Route map

### Public (no auth)
| Path | Purpose |
|---|---|
| `/` | Landing — featured + latest posts + categories + contributors |
| `/posts/[slug]` | Post detail with comments + reactions |
| `/login` | Sign-in (Google OAuth + magic link) |
| `/unauthorized` | Editor-access denied page |

### Authenticated — any user
The auth callback (`/api/auth/callback`) bootstraps a profile for any Google account.

### Editor-only (`role` ∈ `{author, manager}`)
| Path | Notes |
|---|---|
| `/dashboard` | Command-center |
| `/me/posts` (alias: `/my-posts`) | Own posts + trash bin |
| `/editor/new` (alias: `/transmit`) | Create — redirects to existing draft for this week if one exists; pass `?force=1` to bypass |
| `/editor/[id]` | Edit — auto-routes between block editor (if `blocks` non-empty) and Tiptap |
| `/archive` | Alias for `/me/posts#trash` |

### Admin-only (`role === manager`)
| Path | Notes |
|---|---|
| `/admin` | Stats + section cards |
| `/admin/schedule` | Weekday assignment |
| `/admin/users` | Allowlist CRUD with self-lockout + last-admin guards |
| `/admin/tags` | Tag library |
| `/admin/analytics` | Completion + per-author metrics |

### Redirects (legacy bookmarks)
| Old | → | New |
|---|---|---|
| `/blog` | → | `/` |
| `/blog/[slug]` | → | `/posts/[slug]` |
| `/my-posts` | → | `/me/posts` |
| `/transmit` | → | `/editor/new` |
| `/archive` | → | `/me/posts#trash` |
| Non-canonical Vercel host | 308 → | `convegenius-blog.vercel.app` (middleware) |

---

## 7. Database schema

Migrations in `supabase/migrations/`:

| File | Adds |
|---|---|
| `0001_init.sql` | Enums (`app_role`, `post_status`, `media_type`, `media_source_type`), tables (`app_settings`, `profiles`, `authorized_users`, `tags`, `post_templates`, `posts`, `media_assets`, `post_tags`, `audit_logs`), triggers, indexes |
| `0002_helpers_and_bootstrap.sql` | Helper SQL functions (`is_convegenius_user`, `current_user_role`, `is_manager`, `is_author_or_manager`, `is_authorized_author`, `assign_weekday`, `bootstrap_profile`) |
| `0003_rls_policies.sql` | RLS policies on every table + storage policies on `blog-media` |
| `0004_constraints_and_indexes.sql` | Speed indexes (`posts(author_id, status, updated_at desc)`, `post_tags(tag_id)`) |
| `0005_rewrite_signed_media_urls.sql` | One-shot rewrite of legacy 7-day signed URLs into `/api/media/file?path=...` |
| `0007_comments_reactions.sql` | `comments` + `reactions` tables, RLS policies |

> _Migration `0006_blocks_column.sql` was reverted in a previous turn (block-CMS feature rolled back). The `blocks` JSONB column may still exist as a no-op on your live DB — harmless, unused._

### Key tables

```sql
posts (
  id uuid PK, author_id uuid → profiles, title, slug unique,
  excerpt, content_json jsonb, content_html, status post_status,
  week_start_date date, assigned_weekday smallint,
  published_at, scheduled_for, cover_media_id,
  read_time_minutes int, created_at, updated_at, archived_at
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
| `app/(app)/editor/actions.ts` | `savePost`, `createDraftFromTemplate`, `softDeletePost`, `restorePost`, `permanentDeletePost`, `archivePost` (alias) |
| `app/(app)/admin/actions.ts` | `setWeekday`, `upsertAuthorizedUser`, `removeAuthorizedUser`, `createTag`, `deleteTag`, `setPostStatus` |
| `app/(app)/actions/viewMode.ts` | `setViewMode(enabled)` |
| `app/posts/[slug]/actions.ts` | `addComment`, `deleteComment`, `toggleReaction` |

### HTTP routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/auth/callback?code=&redirect=` | Supabase OAuth + magic-link return URL. Bootstraps profile, allowlists internal emails, redirects externals to `/`. |
| POST | `/api/auth/signout` | Clears the session cookie and redirects to `/login`. |
| POST | `/api/media/upload` | Multipart upload for image/video/audio. Returns `{ signedUrl: "/api/media/file?path=..." }`. |
| GET | `/api/media/file?path=...` | Re-signs a storage path on demand. Returns 302 to the fresh signed URL with `Cache-Control: private, max-age=3000`. |
| GET | `/api/media/signed-url?path=...` | Direct re-sign endpoint (used for admin tooling). Auth required. |
| GET | `/api/cron/cleanup-archived` | Vercel cron target. Auth via `Authorization: Bearer ${CRON_SECRET}`. |

---

## 9. Design system

### Identity
"Dark portal / retro-futuristic editorial OS." Inspired by The Nifty Portal and old-school terminal interfaces. Restrained — strong outlines, monospace UI text, hero-font wordmarks, sparing accent colors.

### Tokens (CSS variables in `app/globals.css`)

```css
--bg-main: #08090d        /* page background */
--bg-panel: #11141b
--bg-panel-raised: #171b24
--bg-panel-soft: #0f1218
--bg-inverse: #f4f0df     /* primary CTA surface (cream) */

--text-main: #f5f1e8
--text-muted: #c5c0b3
--text-soft: #8b8678
--text-inverse: #0a0a0a   /* INK on cream surfaces */

--border-main: #f5f1e8
--border-muted: #373c49
--border-soft: #252a35

--accent-orange: #ff5a1f
--accent-blue:   #4f8cff
--accent-green:  #35d07f
--accent-yellow: #ffd166
--accent-red:    #ff4d5e
```

### Fonts
- `Orbitron` 500/700/800/900 — hero wordmarks, panel titles
- `Space Mono` 400/700 — UI labels, body, metadata, code

### Components
| Primitive | File | Notes |
|---|---|---|
| `Button` | `components/ui/Button.tsx` | 6 variants, pill, hairline border on cream CTAs |
| `Card` | `components/ui/Card.tsx` | alias for `.portal-panel` |
| `Input` / `Textarea` | `components/ui/Input.tsx` | pill input, blue focus glow |
| `Badge` | `components/ui/Badge.tsx` | 8 tonal variants |
| `Avatar` | `components/ui/Avatar.tsx` | initials fallback with border |
| `Select` | `components/ui/Select.tsx` | custom dark-mode arrow |
| `Skeleton` | `components/ui/Skeleton.tsx` | bordered loading pulse |
| `Panel` | `components/portal/Panel.tsx` | 4 variants: default / raised / bright / soft |
| `SystemLabel` | `components/portal/SystemLabel.tsx` | mono uppercase chip |
| `BrandLockup` | `components/portal/BrandLockup.tsx` | icon + "CG Signal" wordmark |
| `Ticker` | `components/portal/Ticker.tsx` | marquee (kept as a utility; not currently rendered) |

---

## 10. Local development

```powershell
git clone <repo>
cd CG_Blog
npm install
copy .env.example .env.local   # then fill in
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
1. Create a new Supabase project, copy URL + anon + service-role keys.
2. SQL Editor → run migrations 0001 → 0007 **in order**.
3. SQL Editor → run `storage.sql` (creates `blog-media` bucket).
4. SQL Editor → run `seed.sql` (default tags + weekly-template + 5-person allowlist).
5. **Auth → URL Configuration** → Site URL = `http://localhost:3000`, Redirect URLs = `http://localhost:3000/api/auth/callback` + production URL.
6. **Auth → Providers → Google** — paste OAuth client ID + secret from Google Cloud Console.
7. **Auth → Providers → Email** → enable Magic Link, disable "Confirm email" for one-click sign-in.

---

## 11. Deployment

Hosted on Vercel from the `main` branch of `github.com/repo-sumit/CG_Blog`.

### One-time setup
1. Import GitHub repo into Vercel.
2. Add env vars (see below).
3. Set production domain to `convegenius-blog.vercel.app`.
4. Vercel detects `vercel.json` and registers the cron.

### Deploy flow
- Push to `main` → Vercel auto-builds and promotes to production.
- Preview deployments on PR branches.
- Daily cron `/api/cron/cleanup-archived` at 03:00 UTC.

### Canonical URL redirect
Middleware 308-redirects any non-canonical Vercel host (e.g. `cg-blog-sumits-projects-…vercel.app`) to `NEXT_PUBLIC_APP_URL`. Keeps cookies pinned to one host.

---

## 12. Environment variables

### Required
| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Vercel + `.env` | `https://convegenius-blog.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | both | from Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | both | anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | never expose to browser |
| `APP_ALLOWED_EMAIL_DOMAIN` | both | `convegenius.ai` |
| `APP_MANAGER_EMAIL` | both | comma-separated admin emails |
| `APP_AUTHOR_EMAILS` | both | comma-separated author emails |
| `CRON_SECRET` | both | any random string; Vercel uses it to authenticate scheduled jobs |

### Optional
| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW` | `false` | If `true`, authors' published posts become `submitted` for admin review |
| `NEXT_PUBLIC_MAX_UPLOAD_MB` | `50` | Per-file upload cap |

---

## 13. Operations playbook

### Add a new editor
1. Add their email to `APP_AUTHOR_EMAILS` (or `APP_MANAGER_EMAIL` for admin) in Vercel env vars.
2. Add to seed.sql for documentation, OR add via `/admin/users` UI after they sign in once.
3. Next sign-in, their profile gets the new role automatically.

### Remove an editor
1. Via `/admin/users` → click trash on their row (refuses if it'd remove the last admin).
2. Their `authorized_users` row is deleted, their `profiles.role` drops to `viewer`. They can still log in to comment but lose editor access.

### Restore an archived post
1. As editor, go to `/me/posts` → Trash panel at the bottom.
2. Click **Restore** — post goes back to `draft`.
3. Or if past 30 days, the cron has already hard-deleted it — irrecoverable.

### Manually trigger the cleanup cron
```powershell
curl -H "Authorization: Bearer $CRON_SECRET" `
  "https://convegenius-blog.vercel.app/api/cron/cleanup-archived"
```
Returns `{ "ok": true, "purged": N, "cutoff": "..." }`.

### Delete a comment as admin
1. Open the post detail page.
2. Hover the offending comment → trash icon appears next to author name.
3. Click → soft-deleted, removed from public view immediately.

### Switch into view-as-member mode
- Click the "View as member" pill (top-right of nav).
- Yellow banner appears, all admin/author UI hides.
- Click "Exit view mode" in banner or pill to return.

---

## 14. Known limitations

| Limitation | Impact | Workaround / status |
|---|---|---|
| **MIME validation trusts the browser** | An attacker could rename `evil.exe` to `cat.png`; server doesn't sniff bytes | Acceptable for an internal 5-author team. Migrate to magic-byte sniffing if we ever open uploads to externals. |
| **No comment rate-limiting** | A spammer could in theory post 100 comments fast | Acceptable for a small internal blog; add Vercel KV-backed rate-limit if abuse appears. |
| **Single-region Supabase** | Latency > 200ms for users far from the Supabase region | Acceptable — read paths cache aggressively, writes are infrequent. |
| **Vercel free tier email throttling** | Magic-link emails throttled to ~30/day from Supabase's built-in sender | Workaround: Google OAuth bypasses email entirely. Plug in Resend SMTP for higher volume. |
| **Search is `ilike` only** | Full-table scans on `posts.content_html` — slow at scale | Switch to a `tsvector` column + GIN index if corpus grows past ~500 posts. |
| **No real-time updates** | A new comment doesn't appear for other readers until they refresh | Supabase Realtime channel is a 30-line drop-in if we ever need it. |
| **No comment edit** | Authors can only delete and re-post | Per product spec; not a bug. |
| **Cron lower-bound** | A post archived at 03:01 stays around for ~24h before being purged at the next cron tick | Acceptable; admins can hard-delete manually if urgent. |
| **No audit log writes** | The `audit_logs` table exists but no code writes to it | Wire up when we have a compliance need. |
| **Block-based CMS is not active** | An experiment with 17 typed blocks was reverted | Tiptap stays the editor. Block work is documented in commit history if we want to revive it. |
| **No mobile editor optimization** | The Tiptap toolbar is desktop-first | Authors are 5 people on laptops; mobile use is rare. |
| **Reaction emoji set is hard-coded** | Six emojis baked into a check constraint | Add a `reaction_emojis` table if the product wants custom sets per post. |
| **Comments are plain text only** | No markdown, no mentions, no images | Per product spec. Add later as a feature if discussion volume grows. |

---

## 15. Future scope

Roughly ordered by likely value-per-effort.

### Phase 2 (next 1–2 weeks if requested)
- **@mentions in comments** — auto-link `@username` to their author profile.
- **Comment thread replies (1 level deep)** — `parent_id` column + a few RLS tweaks.
- **Per-user email digest** — weekly cron sends "what was posted this week" to opted-in domain users.
- **Author profile page** at `/authors/[id]` — bio, all their published posts, contribution stats.
- **Drafts visible to other authors for collaboration** — separate `shared_drafts` flag.
- **Cover-image picker** in the editor sidebar (`cover_media_id` already exists in the schema).
- **Search across post bodies** — Postgres `tsvector` migration.
- **Real-time comment feed** via Supabase Realtime subscription.

### Phase 3 (bigger swings)
- **Block-based editor** — revisit the 17-block experiment (Paragraph / Heading / Pullquote / Callout / List / Code / Image / Video / Gallery / Audio / CTA / Poll / Subscribe / Divider / Embed / Author bio / Spacer).
- **Notion / Markdown import** — paste a Notion page or paste markdown, get a post.
- **AI-assisted writing prompts** — "Help me draft my weekly update from these bullet points" via Claude API.
- **Public RSS feed** at `/feed.xml`.
- **OG-image generation** per post — `@vercel/og` template with the brand lockup + title.
- **Analytics dashboard for admins** — read-only chart of post views (would need a small pageviews table + edge logging).
- **Internal-only post visibility** — `audience` enum (`public | internal`) with auth gating on `internal` posts.

### Phase 4 (architectural)
- **Multi-team rollout** — extract this into a workspace-scoped product so other teams at ConveGenius can spin up their own blog.
- **Cross-post to Slack** — on publish, post a summary card to a Slack channel via webhook.
- **Replace Tiptap with a block-based editor** built on the 17-block taxonomy.
- **Self-hostable via Docker** if we want to take it off Vercel/Supabase.

---

## 16. Troubleshooting

### "Supabase env missing" on boot
The publishable key/URL aren't in `.env.local`. Restart `npm run dev` after editing env files.

### Sign-in bounces back to `/login` with an error
- Check Supabase **Redirect URLs** includes `<APP_URL>/api/auth/callback` exactly (no trailing slash).
- Verify `NEXT_PUBLIC_APP_URL` matches the hostname you're hitting.

### Uploads return 403
- Bucket name must be exactly `blog-media`.
- Storage policies from `0003_rls_policies.sql` must be applied.
- User must have `role` ∈ `{author, manager}`.

### Old media doesn't play
- Posts published before the `/api/media/file` re-sign migration may still have raw signed URLs that have expired.
- Run `0005_rewrite_signed_media_urls.sql` to rewrite legacy URLs.

### Cron doesn't run
- Check Vercel → Project → Cron Jobs that the entry is registered.
- `CRON_SECRET` env must be set in Vercel and match what the route reads.
- Test manually with the `curl` command above.

### A Gmail user can't comment
- Verify Google OAuth client is **External** with the Gmail address in Test Users (or fully published).
- The auth callback no longer blocks non-domain accounts as of `v1.x` — confirm the latest commit is deployed.

### Build fails on Vercel with a TS overlap error
- Usually a Supabase FK join inferred as `[]` when we cast to a single object. Pattern to fix:
  ```ts
  const raw = (row as unknown as { field?: T | T[] | null }).field;
  const single = Array.isArray(raw) ? raw[0] : raw;
  ```

---

## Credits

Architecture, design, implementation: Sumit Kumar + Claude (Anthropic).
Brand mark: hosted on ImgBB.
Fonts: Orbitron + Space Mono via Google Fonts.

For questions, bugs, or feature requests: open an issue in the GitHub repo or message Sumit on Slack.
