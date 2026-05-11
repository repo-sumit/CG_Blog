-- Newsletter subscribers — driven by Resend integration.
-- Single opt-in: a row exists ⇒ they get the weekly digest.
-- `unsubscribed_at` set ⇒ excluded from the digest send.
-- `unsubscribe_token` is the random secret embedded in the one-click
-- unsubscribe link, so anyone with that link can opt out without auth.

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  unsubscribe_token uuid not null default gen_random_uuid(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  source text                            -- optional: where they signed up
);

create index if not exists subscribers_unsub_idx on public.subscribers (unsubscribed_at);
create index if not exists subscribers_token_idx on public.subscribers (unsubscribe_token);

-- RLS — table is private. All reads/writes happen via server actions or
-- routes using the service-role client, which bypasses RLS entirely.
alter table public.subscribers enable row level security;

-- No policies — only service-role can touch this table. Anon clients
-- requesting subscribers will get an empty result, which is what we want.
