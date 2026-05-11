# Claude Code Master Prompt: Internal Team Blog CMS for ConveGenius.ai

Copy this entire prompt into Claude Code.

---

## Role and Objective

You are Claude Code acting as a senior full-stack product engineer, system architect, UI engineer, and security-minded implementation partner.

Build a polished internal team blog/CMS for a 5-person team at ConveGenius.ai. The product should help one manager and four direct reports publish weekly work updates in a structured, beautiful, media-rich format. Each team member owns one assigned weekday and is expected to post an update about what they worked on this week or last week.

The application must be production-oriented, secure, deployable to Vercel, and backed by Supabase for authentication, database, storage, and row-level security. Use free-tier-friendly architecture. Use Render only if a separate backend/worker is truly needed; otherwise prefer Next.js server actions, route handlers, and Supabase.

Important access-control note: the stakeholder mentioned that only four male team members should have data access. Do not implement permissions based on gender or any protected personal attribute. Implement access by explicit email allowlist and roles instead. There should be one manager/admin account and four named authorized author/editor accounts. All other authenticated users from the ConveGenius.ai domain should have view-only access.

---

## Product Summary

Create an internal weekly team blog platform with:

1. Domain-restricted authentication for `@convegenius.ai` users.
2. Role-based access control:
   - Manager/Admin: full access to posts, schedule, users, publishing, analytics, moderation, and settings.
   - Authorized Authors/Editors: create, edit, autosave, preview, upload media, and publish or submit their own posts based on configured workflow.
   - Domain Viewers: can only view published/internal posts after login.
   - Non-domain users: cannot access the app.
3. Rich content management system for beautiful weekly updates.
4. Video embedding and video file playback.
5. Audio embedding and audio file playback.
6. Weekly posting schedule for exactly 5 people, one per weekday.
7. Team feed, author pages, weekly archive, search, filters, tags, media cards, and dashboard.
8. Secure Supabase database schema with RLS policies.
9. Supabase Storage for uploaded media.
10. Vercel deployment setup with `.env.example`, README, migrations, and seed data.

---

## Recommended Tech Stack

Use this stack unless the existing repository already has a strong alternative:

### Frontend

- Next.js latest stable with App Router
- React latest stable
- TypeScript strict mode
- Tailwind CSS
- shadcn/ui and Radix UI primitives for accessible components
- lucide-react for icons
- Tiptap rich text editor for CMS editing
- date-fns for date formatting
- Zod for schema validation
- react-hook-form where forms become complex
- Sonner or a similar lightweight toast library

### Backend and Data

- Supabase Auth for authentication
- Supabase Postgres for database
- Supabase Row Level Security for data authorization
- Supabase Storage for images, videos, audio, and attachments
- Supabase SSR package for Next.js server/client integration
- Next.js Server Actions and Route Handlers for app-level mutations

### Optional Backend on Render

Only use Render if the app genuinely needs work that should not run in Vercel serverless functions, such as:

- long-running media processing
- heavy file transformations
- scheduled notification workers beyond simple cron needs
- webhook processors with longer execution time

For the MVP, avoid Render and keep the system Vercel + Supabase only.

### Testing and Quality

- Vitest for unit tests
- React Testing Library for components
- Playwright for authentication and core workflow E2E tests
- ESLint and Prettier
- TypeScript `strict: true`

---

## Core User Roles

Implement roles using a database enum or controlled text values.

### `manager`

The manager can:

- View all posts including drafts.
- Create, edit, publish, archive, and delete any post.
- Assign weekdays to each team member.
- Manage authorized author list.
- View completion analytics.
- See missed-post alerts.
- Moderate comments if comments are implemented.
- Manage tags, topics, and templates.

### `author`

Authorized authors can:

- Create posts.
- Edit their own drafts and posts.
- Upload media for their own posts.
- Preview posts.
- Publish their own post or submit for review depending on workflow configuration.
- View their own posting history and streak.

### `viewer`

Viewers can:

- Log in only if email domain is `@convegenius.ai`.
- Read published/internal posts.
- Search/filter published posts.
- View author pages and weekly archive.
- Play embedded videos and audio.

Viewers cannot:

- Create, edit, delete, or publish posts.
- Upload files.
- Access draft content.
- Access admin dashboards.
- Read raw private media objects outside signed URLs.

---

## Authentication Requirements

### Domain Restriction

All users must authenticate with a `@convegenius.ai` email address. Normalize email and domain checks to lowercase.

Reject, redirect, or block any user who is not from the domain:

```txt
Allowed domain: convegenius.ai
Examples allowed: name@convegenius.ai
Examples denied: name@gmail.com, name@convegenius.com, name@external.ai
```

Do not rely only on client-side validation. Enforce the domain restriction server-side using Supabase Auth hooks, database functions, RLS policies, or a combination of these.

Preferred implementation:

1. Add client-side validation for fast feedback on the login form.
2. Add a server-side domain check after login/session creation.
3. Use a Supabase auth hook or profile bootstrap function to reject/mark invalid domains.
4. Use RLS policies so even if a session exists, unauthorized users cannot read or mutate protected data.

### Login Options

Implement one of these depending on the ease of Supabase setup:

- Preferred: Google OAuth for ConveGenius.ai Google Workspace users.
- Fallback: Magic link login with Supabase Auth.
- Optional: Email/password auth only if explicitly enabled.

The UI should be clean and enterprise-style:

- Centered login card.
- ConveGenius.ai internal workspace copy.
- Domain hint: "Use your ConveGenius.ai email".
- Friendly unauthorized screen for non-domain users.

### Role Assignment

Create an explicit role assignment model.

Use placeholders in `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_ALLOWED_EMAIL_DOMAIN=convegenius.ai
APP_MANAGER_EMAIL=manager@convegenius.ai
APP_AUTHOR_EMAILS=author1@convegenius.ai,author2@convegenius.ai,author3@convegenius.ai,author4@convegenius.ai
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Do not expose the service role key to the browser.

On first login/profile creation:

- If email equals `APP_MANAGER_EMAIL`, assign role `manager`.
- If email is in `APP_AUTHOR_EMAILS`, assign role `author`.
- If email domain is valid but email is not allowlisted, assign role `viewer`.
- If domain is invalid, block access.

Also allow the manager to manage the allowlist in the admin settings UI after setup.

---

## Main Product Features

### 1. Weekly Team Schedule

The team has 5 members and 5 weekdays. Each member owns one day.

Build:

- A weekly schedule widget on the dashboard.
- A `Today\'s Author` highlight card.
- Upcoming authors for the rest of the week.
- Missed-post indicator if a user has not posted for their assigned day/week.
- Configurable day assignment by manager.

Example default schedule:

| Day | Owner |
| --- | --- |
| Monday | Manager |
| Tuesday | Author 1 |
| Wednesday | Author 2 |
| Thursday | Author 3 |
| Friday | Author 4 |

Allow the manager to modify this later from settings.

### 2. Blog Feed

Create an internal blog feed with:

- Latest published posts.
- Weekly grouping.
- Author avatar/name.
- Assigned day badge.
- Tags and project labels.
- Media indicators: video, audio, image.
- Estimated read time.
- Search bar.
- Filters by author, week, tag, media type, and status for managers/authors.
- Empty states that guide users to create their first post.

### 3. Post Detail Page

Each post should have a beautiful reading experience:

- Title
- Author profile block
- Published date and associated week
- Tags/projects
- Rich text content
- Embedded images
- Embedded video players
- Embedded audio players
- Attachment cards if document uploads are allowed
- Previous/next post navigation
- Related posts from same author or same week
- Internal-only noindex metadata

All routes should require authentication.

### 4. Rich CMS Editor

Build a high-quality writing interface using Tiptap.

Required editor capabilities:

- Title field
- Excerpt/summary field
- Rich text body
- Paragraphs
- Headings H2/H3/H4
- Bold
- Italic
- Underline
- Strikethrough
- Bullet lists
- Numbered lists
- Blockquote
- Inline code
- Code block if easy
- Links
- Text color
- Highlight/background color
- Horizontal rule
- Undo/redo
- Clear formatting
- Image insertion
- Video embed/upload block
- Audio embed/upload block
- Preview mode
- Autosave draft
- Save status indicator: saved, saving, unsaved, error
- Word count
- Estimated read time
- Last edited timestamp

Nice-to-have editor features:

- Post template insertion
- Callout blocks: win, blocker, learning, next step
- Project update block
- Checklist block
- Table support
- Markdown shortcuts
- Slash command menu if feasible without overcomplicating

### 5. Weekly Post Template

Create a default template to make writing fast and consistent:

```md
## Focus of the Week

What was your main focus?

## Key Work Completed

- 
- 
- 

## Impact / Outcome

What changed because of this work?

## Learnings

What did you learn?

## Blockers / Risks

Any blockers that need manager/team attention?

## Plan for Next Week

What will you work on next?
```

Add a "Use Weekly Template" button in the editor.

### 6. Media Uploads and Embeds

Support video and audio in two ways:

#### Uploaded Media

Use Supabase Storage with a private bucket, for example `blog-media`.

Support:

- Images: jpg, jpeg, png, webp, gif if needed
- Videos: mp4, webm, mov if browser-compatible
- Audio: mp3, wav, m4a, ogg if browser-compatible
- Optional docs: pdf only if needed

Features:

- Upload progress bar
- File type validation
- File size validation with clear error messages
- Store media metadata in `media_assets`
- Associate uploaded files with a post and owner
- Render video using native `<video controls>`
- Render audio using native `<audio controls>`
- Use signed URLs for private storage access
- Do not expose public buckets unless explicitly required

Free-tier-friendly constraint:

- Do not implement server-side transcoding in MVP.
- Tell users to upload browser-playable media.
- For very large video, recommend external provider embed links.

#### External Embeds

Support safe embedding via URL for approved providers:

- YouTube
- Vimeo
- Loom
- Google Drive video/audio links only if feasible

Do not allow arbitrary iframe HTML from users unless sanitized and allowlisted. Convert known URLs into safe embed blocks.

### 7. Content Workflow

Implement statuses:

- `draft`
- `submitted` if review workflow is enabled
- `scheduled`
- `published`
- `archived`

Minimum MVP workflow:

- Authors create/edit drafts.
- Authors publish their own posts if allowed by config.
- Manager can publish/unpublish/archive any post.
- Viewers only see `published` posts.

Add a setting or constant:

```ts
const REQUIRE_MANAGER_REVIEW = false;
```

If true:

- Authors submit posts.
- Manager reviews and publishes.

### 8. Dashboard

Build a dashboard after login.

For viewers:

- Latest team updates
- This week\'s posts
- Weekly schedule
- Search/filter access

For authors:

- Everything viewers see
- My assigned day
- My draft post for this week
- Quick action: create this week\'s post
- Autosaved drafts
- My post history
- Missed post status

For manager:

- Everything authors see
- Team completion board
- Drafts/submissions awaiting review
- Missed updates
- Schedule management shortcut
- Author activity
- Content analytics

### 9. Search and Discovery

Implement simple search without paid external tools.

Use one of:

- Supabase/Postgres `ilike` search for MVP
- Postgres full-text search for better quality

Search across:

- Title
- Excerpt
- Author name
- Tags
- Project labels
- Rendered text content if stored safely

Filters:

- Author
- Week
- Tag
- Media type
- Status, manager/author only

### 10. Tags and Project Labels

Add tags to help the team browse updates.

Examples:

- Product
- Design
- Engineering
- QA
- Research
- Customer Success
- Analytics
- AI
- Sprint Update
- Blocker
- Launch
- Experiment

Allow manager to manage tags. Authors can apply tags.

### 11. Notifications and Reminders

MVP can show in-app reminders only.

Optional advanced feature:

- Reminder banner when today is the author\'s assigned posting day.
- Manager sees missed-post alerts.
- Optional email notifications later through Supabase Edge Function, Vercel Cron, or Render worker.

Do not overbuild notification infrastructure in the MVP.

---

## UX and Visual Design Requirements

Design should feel like a premium internal product, not a plain CRUD dashboard.

### Visual Direction

- Clean SaaS dashboard aesthetic
- Modern editorial reading experience
- Card-based feed
- Soft borders, subtle shadows, generous whitespace
- Responsive layouts for desktop, tablet, and mobile
- Professional typography
- Clear information hierarchy
- Minimal but delightful micro-interactions

### Suggested Design System

Use Tailwind CSS tokens and CSS variables for:

- Background
- Foreground
- Card
- Border
- Muted text
- Primary action
- Accent states
- Success/warning/destructive states

Do not hardcode a noisy color palette. Use a mature internal-tool look. If ConveGenius brand assets are unavailable, use a neutral palette with one confident accent color.

### Key Screens

Build these screens:

1. `/login`
   - Login card
   - Domain guidance
   - Error states

2. `/unauthorized`
   - Explains access is limited to ConveGenius.ai accounts

3. `/dashboard`
   - Role-aware dashboard

4. `/blog`
   - Main feed with search and filters

5. `/blog/[slug]`
   - Post detail page

6. `/editor/new`
   - New post editor

7. `/editor/[id]`
   - Edit post editor

8. `/me/posts`
   - My drafts and published posts

9. `/admin`
   - Manager control center

10. `/admin/schedule`
    - Assign weekdays

11. `/admin/users`
    - Manage roles/allowlist

12. `/admin/tags`
    - Manage tags

13. `/admin/analytics`
    - Completion analytics and content metrics

### Accessibility

Implement:

- Semantic HTML
- Keyboard-accessible menus and forms
- Visible focus states
- ARIA labels for icon buttons
- Color contrast suitable for enterprise use
- Form error messages linked to inputs

---

## Database Schema Requirements

Create Supabase migrations under `supabase/migrations`.

Use UUID primary keys and timestamps. Enable RLS on all public tables.

Suggested tables:

### `profiles`

Stores app profile and role.

Fields:

- `id uuid primary key references auth.users(id) on delete cascade`
- `email text unique not null`
- `full_name text`
- `avatar_url text`
- `role app_role not null default 'viewer'`
- `weekly_post_day smallint null` where 1=Monday and 5=Friday
- `is_active boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `authorized_users`

Stores explicit role allowlist.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `email text unique not null`
- `role app_role not null`
- `weekly_post_day smallint null`
- `created_by uuid references profiles(id)`
- `created_at timestamptz not null default now()`

### `posts`

Stores blog posts.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `author_id uuid not null references profiles(id)`
- `title text not null`
- `slug text unique not null`
- `excerpt text`
- `content_json jsonb not null default '{}'::jsonb`
- `content_html text not null default ''`
- `status post_status not null default 'draft'`
- `week_start_date date not null`
- `assigned_weekday smallint null`
- `published_at timestamptz null`
- `scheduled_for timestamptz null`
- `cover_media_id uuid null`
- `read_time_minutes int not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `archived_at timestamptz null`

### `media_assets`

Tracks uploaded or embedded media.

Fields:

- `id uuid primary key default gen_random_uuid()`
- `owner_id uuid not null references profiles(id)`
- `post_id uuid null references posts(id) on delete set null`
- `storage_bucket text null`
- `storage_path text null`
- `source_type media_source_type not null` where values are `upload`, `external_url`
- `media_type media_type not null` where values are `image`, `video`, `audio`, `document`
- `mime_type text null`
- `size_bytes bigint null`
- `external_url text null`
- `provider text null`
- `title text null`
- `alt_text text null`
- `duration_seconds int null`
- `created_at timestamptz not null default now()`

### `tags`

Fields:

- `id uuid primary key default gen_random_uuid()`
- `name text unique not null`
- `slug text unique not null`
- `created_at timestamptz not null default now()`

### `post_tags`

Fields:

- `post_id uuid references posts(id) on delete cascade`
- `tag_id uuid references tags(id) on delete cascade`
- Primary key: `(post_id, tag_id)`

### `post_templates`

Fields:

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `description text null`
- `content_json jsonb not null`
- `is_default boolean not null default false`
- `created_by uuid null references profiles(id)`
- `created_at timestamptz not null default now()`

### `audit_logs`

Fields:

- `id uuid primary key default gen_random_uuid()`
- `actor_id uuid null references profiles(id)`
- `action text not null`
- `entity_type text not null`
- `entity_id uuid null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### Optional tables

Implement only if time permits:

- `comments`
- `reactions`
- `post_views`

---

## Enums

Create enums:

```sql
create type app_role as enum ('viewer', 'author', 'manager');
create type post_status as enum ('draft', 'submitted', 'scheduled', 'published', 'archived');
create type media_type as enum ('image', 'video', 'audio', 'document');
create type media_source_type as enum ('upload', 'external_url');
```

---

## RLS and Security Requirements

Security is a core requirement. Implement robust RLS.

### General Principles

- Enable RLS on every public table.
- Browser clients must use only the publishable/anon key.
- Never expose Supabase service role key to client components.
- Use server actions/route handlers for privileged operations.
- Add role checks in both app code and database policies.
- Treat app-level checks as UX; treat RLS as the actual enforcement layer.

### RLS Policy Intent

Implement policies equivalent to:

#### Profiles

- Authenticated ConveGenius users can read active profiles needed for the blog.
- Users can update limited personal fields on their own profile.
- Only manager can change roles, active status, or weekday assignment.

#### Posts

- Viewers can read only `published` posts.
- Authors can read their own drafts/submitted/scheduled/published posts.
- Authors can insert posts for themselves only.
- Authors can update their own posts only, subject to status rules.
- Authors cannot edit someone else\'s posts.
- Manager can read/write all posts.
- Archived/deleted behavior should be explicit.

#### Media Assets

- Viewers can access media linked to published posts through signed URLs.
- Authors can upload/read/update their own media.
- Manager can manage all media.

#### Authorized Users

- Manager can read/write allowlist.
- Authors/viewers cannot read full allowlist unless required by UI.

#### Tags/Templates

- Everyone authenticated can read active tags/templates.
- Manager can create/update/delete tags/templates.
- Authors can apply existing tags to their posts.

### Helper Functions

Create SQL helper functions such as:

- `public.is_convegenius_user()`
- `public.current_user_role()`
- `public.is_manager()`
- `public.is_author_or_manager()`
- `public.is_authorized_author()`

Use `security definer` carefully. Lock down search paths.

---

## Storage Requirements

Create a private Supabase Storage bucket:

```txt
blog-media
```

Storage path convention:

```txt
{user_id}/{post_id}/{timestamp}-{safe_filename}
```

Examples:

```txt
c0f.../a12.../2026-05-11-demo-video.mp4
c0f.../a12.../2026-05-11-weekly-audio.mp3
```

Implement:

- Signed URL generation for playback.
- Upload progress in the editor.
- File size validation before upload.
- MIME validation before upload.
- Storage RLS policies.
- Cleanup or orphan handling where practical.

Avoid public storage unless the stakeholder explicitly requests public access.

---

## Route and File Structure

Use a clean file structure similar to:

```txt
app/
  (auth)/
    login/page.tsx
    unauthorized/page.tsx
  (app)/
    dashboard/page.tsx
    blog/page.tsx
    blog/[slug]/page.tsx
    editor/new/page.tsx
    editor/[id]/page.tsx
    me/posts/page.tsx
    admin/page.tsx
    admin/schedule/page.tsx
    admin/users/page.tsx
    admin/tags/page.tsx
    admin/analytics/page.tsx
  api/
    auth/callback/route.ts
    media/signed-url/route.ts
components/
  auth/
  dashboard/
  editor/
  blog/
  media/
  admin/
  layout/
  ui/
lib/
  supabase/
    client.ts
    server.ts
    middleware.ts
  auth/
    roles.ts
    guards.ts
  db/
    posts.ts
    profiles.ts
    media.ts
    tags.ts
  editor/
    extensions.ts
    serialization.ts
    sanitize.ts
  utils/
    dates.ts
    slugs.ts
    read-time.ts
    file-validation.ts
supabase/
  migrations/
  seed.sql
middleware.ts
.env.example
README.md
```

Adjust as needed for the chosen Next.js version and conventions.

---

## Environment Variables

Create `.env.example` with:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_ALLOWED_EMAIL_DOMAIN=convegenius.ai
APP_MANAGER_EMAIL=manager@convegenius.ai
APP_AUTHOR_EMAILS=author1@convegenius.ai,author2@convegenius.ai,author3@convegenius.ai,author4@convegenius.ai
NEXT_PUBLIC_REQUIRE_MANAGER_REVIEW=false
NEXT_PUBLIC_MAX_UPLOAD_MB=50
```

Add notes in README:

- `SUPABASE_SERVICE_ROLE_KEY` must only be used server-side.
- Configure the same variables in Vercel project settings.
- Configure Supabase redirect URLs for local and deployed domains.

---

## Data Validation

Implement robust validation with Zod.

Validate:

- Email domain
- Role values
- Post title length
- Slug format
- Excerpt length
- Content JSON shape where practical
- Status transitions
- Weekday range 1-5
- File MIME type
- File size
- External embed URLs by allowlisted provider

Show user-friendly form errors.

---

## Media Security and XSS Requirements

Because the app accepts rich content, security must be explicit.

Implement:

- Sanitize or safely render editor output.
- Prefer storing Tiptap JSON as source of truth.
- Store HTML only if sanitized or generated server-side from trusted editor schema.
- Do not allow arbitrary scripts.
- Do not allow arbitrary iframe HTML.
- Convert allowed video URLs into controlled embed components.
- Add conservative Content Security Policy if feasible.
- Use `rel="noopener noreferrer"` for external links.
- Use `target="_blank"` only where appropriate.

---

## Free-Tier-Friendly Design Constraints

Design this app to stay practical on Vercel + Supabase free tiers.

- Avoid video transcoding.
- Avoid background workers unless necessary.
- Avoid paid search services.
- Avoid public traffic assumptions; this is an internal app.
- Use Postgres search first.
- Keep media uploads reasonable and configurable.
- Use signed URLs with expiry instead of public buckets.
- Keep analytics simple and aggregate from existing tables.

---

## Implementation Plan for Claude Code

Execute in this order:

### Phase 1: Project Audit / Bootstrap

1. Inspect the repository.
2. If no app exists, create a Next.js TypeScript app with App Router.
3. Install required dependencies.
4. Configure Tailwind, shadcn/ui, ESLint, TypeScript strict mode.
5. Create base layout, theme tokens, and navigation shell.

### Phase 2: Supabase Foundation

1. Add Supabase client utilities for browser/server/middleware.
2. Add auth callback route if OAuth/magic link needs it.
3. Add middleware to refresh sessions and protect app routes.
4. Create Supabase migrations with schema, enums, indexes, triggers, and RLS.
5. Add seed data for default tags and weekly template.
6. Add README setup instructions for Supabase.

### Phase 3: Auth and RBAC

1. Build login page.
2. Implement domain validation.
3. Implement profile bootstrap.
4. Implement role detection and guards.
5. Build unauthorized page.
6. Protect routes by role.
7. Add admin-only and author-only UI gates.

### Phase 4: Blog Reading Experience

1. Build dashboard.
2. Build blog feed.
3. Build post detail page.
4. Add search/filter UI.
5. Add author and weekly grouping cards.
6. Ensure published media plays correctly.

### Phase 5: CMS Editor

1. Build post editor page with Tiptap.
2. Add toolbar features.
3. Add post metadata fields.
4. Add weekly template insertion.
5. Add autosave.
6. Add preview.
7. Add status workflow.
8. Add slug generation.

### Phase 6: Media Uploads and Embeds

1. Create upload UI.
2. Validate MIME and size.
3. Upload to Supabase Storage.
4. Create media asset records.
5. Insert media blocks into editor.
6. Render uploaded video/audio with native controls.
7. Add safe external URL embed support.

### Phase 7: Admin Tools

1. Build admin dashboard.
2. Build schedule manager.
3. Build user/role manager.
4. Build tag manager.
5. Build simple analytics page.
6. Add audit logging for manager actions.

### Phase 8: Testing and Hardening

1. Add unit tests for role/domain helpers.
2. Add tests for file validation.
3. Add tests for slug/read-time utilities.
4. Add Playwright tests for login, viewer access, author post creation, and manager admin access.
5. Verify RLS manually and document test cases.
6. Run lint, typecheck, and tests.
7. Fix issues.

### Phase 9: Deployment Readiness

1. Add Vercel deployment instructions.
2. Add Supabase setup checklist.
3. Add environment variable checklist.
4. Add post-deployment smoke test checklist.
5. Add notes about optional Render backend only if required.

---

## UI Component Details

### Navigation

Role-aware top navigation:

- Dashboard
- Blog
- My Posts, authors/managers only
- New Post, authors/managers only
- Admin, manager only
- Profile menu
- Sign out

### Dashboard Cards

Implement cards for:

- Today\'s author
- This week\'s completion
- Recent posts
- My draft
- Missed updates
- Pending review, manager only
- Quick create button

### Blog Cards

Blog card content:

- Title
- Excerpt
- Author
- Date/week
- Tags
- Media indicators
- Read time
- Status badge if manager/author

### Editor Layout

Suggested layout:

- Main editing canvas centered.
- Sticky editor toolbar.
- Right sidebar for metadata:
  - status
  - week
  - tags
  - cover media
  - author
  - save/publish actions
- Preview button.
- Autosave indicator.

### Admin Analytics

Show simple metrics:

- Posts published this week
- Completion percentage
- Posts by author
- Missed assigned days
- Top tags
- Media posts count
- Current streak per author

Do not overengineer analytics.

---

## Acceptance Criteria

The implementation is complete when all of the following are true:

### Auth and Access

- A non-authenticated user is redirected to login.
- A non-`@convegenius.ai` email cannot access app content.
- A valid domain viewer can log in and only view published posts.
- A viewer cannot access editor/admin routes.
- An author can create and edit their own posts.
- An author cannot edit someone else\'s posts.
- A manager can manage all posts, users, schedule, and tags.
- RLS blocks unauthorized direct database access.

### CMS

- A user can write a formatted post.
- Bold, italic, headings, lists, colors, links, and highlights work.
- Autosave works.
- Preview works.
- Post publishing works.
- Weekly template insertion works.

### Media

- Image upload works.
- Video upload/embed works and can be played.
- Audio upload/embed works and can be played.
- Invalid files are rejected with clear errors.
- Private media is accessed through signed URLs or secure mechanisms.

### Weekly Workflow

- Each of the 5 team members can be assigned a weekday.
- Dashboard highlights today\'s assigned person.
- Manager can see completed/missed posts for the week.

### Deployment

- App runs locally with documented commands.
- Migrations are included.
- `.env.example` is complete.
- README explains Supabase and Vercel setup.
- The app can be deployed to Vercel.

### Quality

- TypeScript passes.
- Lint passes.
- Key tests pass.
- UI is responsive and accessible.
- No service role key is exposed client-side.

---

## Edge Cases to Handle

Handle these scenarios gracefully:

- User logs in with uppercase email domain.
- User is valid domain but not in author allowlist.
- Author tries to edit another author\'s post.
- Viewer manually navigates to `/editor/new`.
- Media upload fails halfway.
- Unsupported video/audio format is uploaded.
- Post has no media.
- Post has multiple media blocks.
- Author misses assigned day.
- Manager changes an author\'s weekday.
- Slug collision occurs.
- Autosave conflict occurs across two tabs.
- User session expires while editing.
- Storage signed URL expires.
- Supabase returns RLS permission error.
- App is loaded on mobile.

---

## Performance Requirements

- Use server-side fetching where appropriate.
- Paginate blog feed.
- Lazy-load heavy editor only on editor routes.
- Lazy-load media where possible.
- Use image optimization for cover images if compatible with signed URLs.
- Keep dashboard queries efficient.
- Add useful indexes:
  - `posts(status, published_at)`
  - `posts(author_id, week_start_date)`
  - `posts(slug)`
  - `profiles(email)`
  - `post_tags(post_id, tag_id)`

---

## Suggested Commands

If bootstrapping from scratch, use commands similar to:

```bash
npx create-next-app@latest convegenius-team-blog --ts --eslint --tailwind --app --src-dir=false
cd convegenius-team-blog
npm install @supabase/supabase-js @supabase/ssr zod date-fns lucide-react sonner react-hook-form @hookform/resolvers
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/extension-underline @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/extension-image
npm install -D vitest @testing-library/react @testing-library/jest-dom playwright
```

If using shadcn/ui:

```bash
npx shadcn@latest init
npx shadcn@latest add button card input textarea badge dropdown-menu dialog sheet tabs table select form avatar separator tooltip progress alert
```

Adjust package manager based on the repo.

---

## README Requirements

Create a README that includes:

1. Product overview.
2. Tech stack.
3. Local setup.
4. Supabase project setup.
5. Database migration steps.
6. Storage bucket setup.
7. Auth provider setup.
8. Environment variables.
9. Role allowlist setup.
10. Running tests.
11. Vercel deployment.
12. Optional Render backend guidance.
13. Security notes.
14. Troubleshooting.

---

## Vercel Deployment Checklist

Add this checklist to README:

- Push repository to GitHub.
- Import project into Vercel.
- Add environment variables.
- Configure Supabase site URL and redirect URLs.
- Run Supabase migrations.
- Create private `blog-media` storage bucket.
- Add manager and author emails.
- Deploy.
- Smoke test login, viewer access, author post creation, media playback, and manager admin pages.

---

## Supabase Setup Checklist

Add this checklist to README:

- Create Supabase project.
- Copy project URL and publishable key.
- Apply migrations.
- Enable Auth provider: Google OAuth or magic link.
- Configure redirect URLs:
  - `http://localhost:3000/api/auth/callback`
  - production Vercel callback URL
- Create private storage bucket `blog-media`.
- Verify RLS is enabled.
- Verify seed data exists.
- Test allowlisted manager and authors.
- Test viewer domain account.

---

## Output Expectations for Claude Code

After implementation, provide:

1. Summary of what was built.
2. Files changed/created.
3. Commands to run locally.
4. Supabase migration instructions.
5. Required environment variables.
6. Deployment steps.
7. Known limitations or TODOs.
8. Security notes.
9. Test results.

Do not stop at pseudocode. Implement the application files, migrations, UI, and core workflows. If something cannot be fully implemented because credentials are missing, create the code and document the exact setup step required.

---

## Final Product Vision

The final app should feel like an internal operating rhythm product for the team: every week, each person has a clear publishing day, a simple but powerful editor, rich media support, and a beautiful archive of work progress. The manager gets visibility into team execution, blockers, outcomes, and missed updates. Viewers across the ConveGenius.ai domain get transparent access to published team updates without being able to change data.

Prioritize secure role-based access, strong UX, editor quality, and deployment readiness.
