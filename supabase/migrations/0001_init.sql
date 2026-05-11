-- ConveGenius Team Blog — initial schema, enums, helpers, RLS
-- Apply via Supabase SQL editor or `supabase db push`.

create extension if not exists "pgcrypto";

-- ============================================================
-- Enums
-- ============================================================
do $$ begin
  create type app_role as enum ('viewer', 'author', 'manager');
exception when duplicate_object then null; end $$;

do $$ begin
  create type post_status as enum ('draft', 'submitted', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_type as enum ('image', 'video', 'audio', 'document');
exception when duplicate_object then null; end $$;

do $$ begin
  create type media_source_type as enum ('upload', 'external_url');
exception when duplicate_object then null; end $$;

-- ============================================================
-- App settings (singleton row keyed by id=1) — manager-managed runtime config
-- ============================================================
create table if not exists public.app_settings (
  id smallint primary key default 1,
  allowed_domain text not null default 'convegenius.ai',
  require_manager_review boolean not null default false,
  max_upload_mb int not null default 50,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ============================================================
-- Profiles
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  avatar_url text,
  role app_role not null default 'viewer',
  weekly_post_day smallint check (weekly_post_day between 1 and 5),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_role_idx on public.profiles (role);

-- ============================================================
-- Authorized users allowlist
-- ============================================================
create table if not exists public.authorized_users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  role app_role not null,
  weekly_post_day smallint check (weekly_post_day between 1 and 5),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Tags
-- ============================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Post templates
-- ============================================================
create table if not exists public.post_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  content_json jsonb not null,
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Posts
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete restrict,
  title text not null,
  slug text unique not null,
  excerpt text,
  content_json jsonb not null default '{}'::jsonb,
  content_html text not null default '',
  status post_status not null default 'draft',
  week_start_date date not null,
  assigned_weekday smallint check (assigned_weekday between 1 and 5),
  published_at timestamptz,
  scheduled_for timestamptz,
  cover_media_id uuid,
  read_time_minutes int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);
create index if not exists posts_status_published_idx on public.posts (status, published_at desc);
create index if not exists posts_author_week_idx on public.posts (author_id, week_start_date);
create index if not exists posts_slug_idx on public.posts (slug);

-- ============================================================
-- Media assets
-- ============================================================
create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  post_id uuid references public.posts(id) on delete set null,
  storage_bucket text,
  storage_path text,
  source_type media_source_type not null,
  media_type media_type not null,
  mime_type text,
  size_bytes bigint,
  external_url text,
  provider text,
  title text,
  alt_text text,
  duration_seconds int,
  created_at timestamptz not null default now()
);
create index if not exists media_assets_post_idx on public.media_assets (post_id);
create index if not exists media_assets_owner_idx on public.media_assets (owner_id);

alter table public.posts
  add constraint posts_cover_media_fk
  foreign key (cover_media_id) references public.media_assets(id) on delete set null
  deferrable initially deferred;

-- ============================================================
-- Post tags
-- ============================================================
create table if not exists public.post_tags (
  post_id uuid references public.posts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (post_id, tag_id)
);

-- ============================================================
-- Audit logs
-- ============================================================
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

-- ============================================================
-- Triggers — updated_at maintenance
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute procedure public.tg_set_updated_at();

drop trigger if exists posts_set_updated_at on public.posts;
create trigger posts_set_updated_at before update on public.posts
  for each row execute procedure public.tg_set_updated_at();
