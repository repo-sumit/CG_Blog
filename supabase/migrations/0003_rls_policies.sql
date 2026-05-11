-- Row-level security policies.

alter table public.app_settings    enable row level security;
alter table public.profiles        enable row level security;
alter table public.authorized_users enable row level security;
alter table public.tags            enable row level security;
alter table public.post_templates  enable row level security;
alter table public.posts           enable row level security;
alter table public.media_assets    enable row level security;
alter table public.post_tags       enable row level security;
alter table public.audit_logs      enable row level security;

-- ----------------------------------------------------------------
-- app_settings
-- ----------------------------------------------------------------
drop policy if exists app_settings_read on public.app_settings;
create policy app_settings_read on public.app_settings
  for select using (public.is_convegenius_user());

drop policy if exists app_settings_write on public.app_settings;
create policy app_settings_write on public.app_settings
  for update using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- profiles
-- Authenticated convegenius users can read active profiles.
-- Users can update limited self fields. Manager can update anything.
-- ----------------------------------------------------------------
drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles
  for select using (public.is_convegenius_user() and (is_active or public.is_manager()));

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid() and public.is_convegenius_user());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (
    id = auth.uid()
    -- Self-update may not escalate role / activation / weekday / email — manager only.
    and role          = (select role          from public.profiles where id = auth.uid())
    and is_active     = (select is_active     from public.profiles where id = auth.uid())
    and email         = (select email         from public.profiles where id = auth.uid())
    and weekly_post_day is not distinct from (select weekly_post_day from public.profiles where id = auth.uid())
  );

drop policy if exists profiles_manager_all on public.profiles;
create policy profiles_manager_all on public.profiles
  for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- authorized_users — manager only
-- ----------------------------------------------------------------
drop policy if exists authorized_users_manager on public.authorized_users;
create policy authorized_users_manager on public.authorized_users
  for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- tags
-- ----------------------------------------------------------------
drop policy if exists tags_read on public.tags;
create policy tags_read on public.tags
  for select using (public.is_convegenius_user());

drop policy if exists tags_manager on public.tags;
create policy tags_manager on public.tags
  for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- post_templates
-- ----------------------------------------------------------------
drop policy if exists templates_read on public.post_templates;
create policy templates_read on public.post_templates
  for select using (public.is_convegenius_user());

drop policy if exists templates_manager on public.post_templates;
create policy templates_manager on public.post_templates
  for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- posts
-- ----------------------------------------------------------------
drop policy if exists posts_read_published on public.posts;
create policy posts_read_published on public.posts
  for select using (
    public.is_convegenius_user()
    and (
      status = 'published'
      or author_id = auth.uid()
      or public.is_manager()
    )
  );

drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts
  for insert with check (
    public.is_convegenius_user()
    and author_id = auth.uid()
    and public.is_author_or_manager()
  );

drop policy if exists posts_update_own on public.posts;
create policy posts_update_own on public.posts
  for update using (
    author_id = auth.uid() and public.is_author_or_manager()
  ) with check (
    author_id = auth.uid()
  );

drop policy if exists posts_manager_all on public.posts;
create policy posts_manager_all on public.posts
  for all using (public.is_manager()) with check (public.is_manager());

-- ----------------------------------------------------------------
-- media_assets
-- ----------------------------------------------------------------
drop policy if exists media_read on public.media_assets;
create policy media_read on public.media_assets
  for select using (
    public.is_convegenius_user()
    and (
      owner_id = auth.uid()
      or public.is_manager()
      or exists (
        select 1 from public.posts p
        where p.id = media_assets.post_id and p.status = 'published'
      )
    )
  );

drop policy if exists media_insert_self on public.media_assets;
create policy media_insert_self on public.media_assets
  for insert with check (
    owner_id = auth.uid() and public.is_author_or_manager()
  );

drop policy if exists media_update_own on public.media_assets;
create policy media_update_own on public.media_assets
  for update using (owner_id = auth.uid() or public.is_manager())
  with check (owner_id = auth.uid() or public.is_manager());

drop policy if exists media_delete_own on public.media_assets;
create policy media_delete_own on public.media_assets
  for delete using (owner_id = auth.uid() or public.is_manager());

-- ----------------------------------------------------------------
-- post_tags
-- ----------------------------------------------------------------
drop policy if exists post_tags_read on public.post_tags;
create policy post_tags_read on public.post_tags
  for select using (
    exists (
      select 1 from public.posts p where p.id = post_tags.post_id and (
        p.status = 'published' or p.author_id = auth.uid() or public.is_manager()
      )
    )
  );

drop policy if exists post_tags_write on public.post_tags;
create policy post_tags_write on public.post_tags
  for all using (
    exists (
      select 1 from public.posts p where p.id = post_tags.post_id and (
        p.author_id = auth.uid() or public.is_manager()
      )
    )
  ) with check (
    exists (
      select 1 from public.posts p where p.id = post_tags.post_id and (
        p.author_id = auth.uid() or public.is_manager()
      )
    )
  );

-- ----------------------------------------------------------------
-- audit_logs — manager read, system insert via service role only
-- ----------------------------------------------------------------
drop policy if exists audit_manager_read on public.audit_logs;
create policy audit_manager_read on public.audit_logs
  for select using (public.is_manager());

-- ----------------------------------------------------------------
-- Storage policies for the private `blog-media` bucket.
-- Path convention: {user_id}/{post_id}/{timestamp}-{filename}
-- ----------------------------------------------------------------
drop policy if exists storage_blog_media_insert_own on storage.objects;
create policy storage_blog_media_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'blog-media'
    and public.is_author_or_manager()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists storage_blog_media_read_own on storage.objects;
create policy storage_blog_media_read_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'blog-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_manager()
    )
  );

drop policy if exists storage_blog_media_update_own on storage.objects;
create policy storage_blog_media_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'blog-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_manager()
    )
  );

drop policy if exists storage_blog_media_delete_own on storage.objects;
create policy storage_blog_media_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'blog-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_manager()
    )
  );
