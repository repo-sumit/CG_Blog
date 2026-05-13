-- Post-level view tracking. Vercel Analytics gives us page-view totals, but
-- the in-app analytics dashboard needs per-post breakdowns + author-aware
-- "who saw this" stats, which Vercel can't surface. This table is the
-- internal record.
--
-- Inserts happen from /api/analytics/post-view via the service-role client,
-- so RLS only needs to allow READ for the right roles (manager + owner).
-- Raw IPs are never stored — only a salted hash of the IP, computed
-- server-side using IP_HASH_SECRET (env var).

create table if not exists public.post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  viewer_id uuid references auth.users(id) on delete set null,
  session_id text,
  user_agent text,
  referrer text,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists post_views_post_id_idx
  on public.post_views (post_id);
create index if not exists post_views_created_at_idx
  on public.post_views (created_at desc);
-- Speeds up the 30-minute dedupe lookup in /api/analytics/post-view.
create index if not exists post_views_post_session_idx
  on public.post_views (post_id, session_id, created_at desc);

alter table public.post_views enable row level security;

-- Managers see every row. Anonymous + non-manager users can't read this
-- table at all — aggregated counts are queried through the service-role
-- client in server components, so RLS being strict here is the right call.
drop policy if exists post_views_manager_read on public.post_views;
create policy post_views_manager_read on public.post_views
  for select using (public.is_manager());

-- A post's author can read their own post's views (for "Views on your post"
-- counts in /me/posts and the editor sidebar).
drop policy if exists post_views_author_read on public.post_views;
create policy post_views_author_read on public.post_views
  for select using (
    exists (
      select 1 from public.posts p
      where p.id = post_views.post_id and p.author_id = auth.uid()
    )
  );
