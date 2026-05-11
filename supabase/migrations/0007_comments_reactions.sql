-- Public comments + reactions for published posts.
--
-- Both tables are written by server actions running with the service-role
-- client, which performs its own authorization. RLS is enabled anyway for
-- defense-in-depth — should anything ever attempt to query these tables
-- via the user-session client, only the safe paths succeed.

-- ============================================================
-- comments
-- ============================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Snapshot of identity at comment time. Keeps the discussion stable even
  -- if the user later deletes their account or changes name.
  author_name text not null,
  author_avatar_url text,
  body text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users(id),
  constraint comments_body_length check (length(trim(body)) between 1 and 100)
);
create index if not exists comments_post_idx on public.comments (post_id, created_at desc);
create index if not exists comments_user_idx on public.comments (user_id);

-- ============================================================
-- reactions
-- ============================================================
create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  constraint reactions_emoji_allowed
    check (emoji in ('👍','❤️','😂','🎉','👀','🚀')),
  unique (post_id, user_id, emoji)
);
create index if not exists reactions_post_idx on public.reactions (post_id);

-- ============================================================
-- RLS — defense in depth
-- ============================================================
alter table public.comments enable row level security;
alter table public.reactions enable row level security;

drop policy if exists comments_read_published on public.comments;
create policy comments_read_published on public.comments
  for select using (
    deleted_at is null
    and exists (select 1 from public.posts p where p.id = comments.post_id and p.status = 'published')
  );

drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments
  for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = comments.post_id and p.status = 'published')
  );

-- Soft delete: comment author, post author, or manager.
drop policy if exists comments_soft_delete on public.comments;
create policy comments_soft_delete on public.comments
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.posts p where p.id = comments.post_id and p.author_id = auth.uid())
    or public.is_manager()
  );

drop policy if exists reactions_read on public.reactions;
create policy reactions_read on public.reactions
  for select using (
    exists (select 1 from public.posts p where p.id = reactions.post_id and p.status = 'published')
  );

drop policy if exists reactions_insert_self on public.reactions;
create policy reactions_insert_self on public.reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists reactions_delete_self on public.reactions;
create policy reactions_delete_self on public.reactions
  for delete using (auth.uid() = user_id);
