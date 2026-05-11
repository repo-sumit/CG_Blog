# ConveGenius Team Blog

An internal weekly-update CMS for the ConveGenius.ai team. Built with **Next.js 14 (App Router) + Supabase + Tiptap + Tailwind**. Designed to deploy on **Vercel free tier** with a free Supabase project.

## Highlights

- **Domain-restricted auth** — only `@convegenius.ai` accounts can sign in (Google OAuth or magic link). Enforced in middleware, in the auth callback, and again at the database via RLS.
- **Role-based access** — explicit email allowlist (no implicit grants by domain alone). `manager`, `author`, `viewer`. Access control is by allowlist + role, never by personal attributes.
- **Tiptap rich editor** — headings, lists, links, color, highlight, code, images, audio, video, external embeds (YouTube/Vimeo/Loom/Drive), autosave, preview, weekly-template insertion, word/read-time counters.
- **Weekly schedule** — one author per weekday with today-author highlight, completion %, and missed-post indicators.
- **Private media storage** — uploads land in a private `blog-media` bucket and are served via signed URLs. MIME + size validation, path scoped to `{user_id}/{post_id}/{ts}-{filename}`.
- **Hardened RLS** — all tables have row-level security; helper functions are `security definer` with locked `search_path`; storage policies scope access by ownership and role.
- **Defense-in-depth XSS protection** — Tiptap JSON is the source of truth; rendered HTML is sanitized server-side before storage and on render.
- **Admin tools** — schedule editor, allowlist manager, tag manager, completion analytics.

## Project structure

```
app/
  (auth)/login, /unauthorized
  (app)/dashboard, /blog, /blog/[slug], /editor/{new,[id]}, /me/posts, /admin/{schedule,users,tags,analytics}
  api/auth/{callback,signout}, /media/{upload,signed-url}
components/ ui, auth, layout, dashboard, blog, editor, admin
lib/ supabase/, auth/, db/, editor/, utils/, env.ts
supabase/ migrations/ (0001..0003), seed.sql, storage.sql
tests/ unit/, e2e/
```

## Quick start

### 1. Install

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase project setup

1. Create a free project at https://supabase.com.
2. **Project Settings → API** — copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only)
3. Run the migrations (Supabase SQL Editor, in order):
   - `supabase/migrations/0001_init.sql`
   - `supabase/migrations/0002_helpers_and_bootstrap.sql`
   - `supabase/migrations/0003_rls_policies.sql`
4. Run `supabase/storage.sql` to create the private `blog-media` bucket.
5. Run `supabase/seed.sql` (tags, default weekly template, and a starter allowlist — edit emails first).
6. **Auth → URL Configuration**:
   - **Site URL** → `http://localhost:3000` (and your Vercel URL in production).
   - **Redirect URLs** → add `http://localhost:3000/api/auth/callback` and `<your-prod-url>/api/auth/callback`.
7. **Auth → Providers** — enable one:
   - **Google** (recommended for a Workspace team) — set client/secret, restrict to the `convegenius.ai` hosted domain.
   - **Email** (magic link) — enable "Magic Link", disable "Confirm email" if you want one-click sign-in.

### 3. Configure `.env.local`

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only
APP_ALLOWED_EMAIL_DOMAIN=convegenius.ai
APP_MANAGER_EMAIL=manager@convegenius.ai
APP_AUTHOR_EMAILS=author1@convegenius.ai,author2@convegenius.ai,author3@convegenius.ai,author4@convegenius.ai
NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW=false
NEXT_PUBLIC_MAX_UPLOAD_MB=50
```

> `APP_MANAGER_EMAIL` and `APP_AUTHOR_EMAILS` are reconciled into the `authorized_users` table on each sign-in. You can also manage them at `/admin/users` after first launch.

### 4. Run

```bash
npm run dev
# open http://localhost:3000
```

## Deployment (Vercel)

1. Push to GitHub.
2. **Import** the repo into Vercel.
3. Add the same env vars under **Project Settings → Environment Variables**. `SUPABASE_SERVICE_ROLE_KEY` must be **Production / Preview** only (never `NEXT_PUBLIC_*`).
4. Add your Vercel URL to Supabase **Site URL** and **Redirect URLs**.
5. Deploy. Smoke test:
   - Visit the URL while signed out → redirect to `/login`.
   - Sign in with manager email → can reach `/admin`.
   - Sign in with allowlisted author → can reach `/editor/new`, create+publish a post.
   - Sign in with valid-domain non-allowlisted user → only sees `/blog` (viewer).
   - Sign in with non-`convegenius.ai` account → `/unauthorized`.
   - Upload an image / video / audio and verify playback.

### Optional Render worker

The MVP does **not** require Render. Add a Render worker only if you later need long-running media processing, transcoding, or scheduled email reminders that don't fit Vercel's serverless limits. The recommended pattern is a small Express/Node service hitting Supabase with the service-role key; the schema and storage layout already support this.

## Day-to-day usage

- **Authors**: visit `/editor/new` (or "Continue draft" on the dashboard), use **Use weekly template** to start, write, then **Publish** (or **Submit for review** if `NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW=true`).
- **Managers**: `/admin/schedule` to assign weekdays; `/admin/users` to add/remove people; `/admin/tags` to curate tags; `/admin/analytics` for completion %.
- **Viewers**: `/blog` and `/blog/[slug]` only. Editor and admin routes redirect them.

## Testing

```bash
npm run typecheck
npm run lint
npm test          # vitest unit tests (sanitizer, slug, file validation, embeds, roles, read-time)
npm run e2e       # playwright (requires a running app at AUTH_TEST_BASE_URL)
```

E2E covers unauthenticated redirect, login page render, and the unauthorized page. Add `storageState` fixtures with manager/author sessions to extend coverage (see Playwright docs).

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY` is read only inside `lib/supabase/server.ts → createSupabaseServiceClient()` and server-only routes. Never exposed to the browser.
- RLS is the **enforcement layer**. Application-level role checks are UX only.
- Tiptap HTML is sanitized server-side (`lib/editor/sanitize.ts`) before being stored or rendered. Scripts, iframes, event handlers, and `javascript:` URLs are stripped. External video embeds are converted from a small allowlist (YouTube/Vimeo/Loom/Drive) into safe `<iframe>` blocks that we generate, not user-supplied HTML.
- Storage is private. Playback URLs are short-lived signed URLs scoped to the bucket; storage policies pin each path to `auth.uid()` (or manager).
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, Referrer-Policy, Permissions-Policy) are applied in `next.config.mjs`.
- Cookies follow Supabase SSR defaults; sessions are refreshed in `middleware.ts`.

## Acceptance criteria status

- ✅ Domain restricted auth (middleware + callback + RLS via `is_convegenius_user()`).
- ✅ Role-based access: manager, author (allowlist), viewer (valid domain).
- ✅ Rich CMS editor with autosave, preview, weekly template, embeds, uploads.
- ✅ Private storage bucket with signed URLs and per-user folders.
- ✅ Weekly schedule, today-author highlight, missed/posted indicators.
- ✅ Admin tools: schedule, users, tags, analytics.
- ✅ Migrations, seed, env example, README, deploy checklist.
- ✅ TypeScript strict, Tailwind, lint config.
- ⚠️ Tests: unit suite covers sanitization, embeds, slugs, file validation, roles, read-time. Playwright covers the public auth surface only — extend with authenticated fixtures for full workflow coverage.

## Troubleshooting

- **"Supabase env missing"** at boot → the publishable key/URL aren't set in `.env.local`. Restart `next dev` after editing env files.
- **Sign-in redirects back to `/login` with an error** → check Supabase **Redirect URLs** include `<APP_URL>/api/auth/callback` exactly (no trailing slash).
- **Cannot see anyone in `/admin/users`** → run `supabase/seed.sql` after editing emails, or add via the UI.
- **Uploads return 403** → verify the bucket is named exactly `blog-media`, the storage policies from `0003_rls_policies.sql` are applied, and the user has `author` or `manager` role.
- **Media doesn't play after some time** → signed URLs expire (7 days for uploads via the editor, 1 hour via `/api/media/signed-url`). Re-embed if needed, or extend the TTL.

## Known limitations / TODO

- No comments/reactions (table not created — listed as optional in the prompt; can be added later).
- No server-side video transcoding (out of scope for free tier — users must upload browser-playable media).
- Editor doesn't yet support slash-command or callout blocks (could be added with custom Tiptap nodes).
- Search uses Postgres `ilike`; switch to `to_tsvector` / `tsvector` columns if the corpus grows.
- Comment moderation, reactions, view counts: all optional and not built in this MVP.
