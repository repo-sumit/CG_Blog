-- Seed the founding subscriber(s). Idempotent.
-- Run after migration 0008_subscribers.sql.

insert into public.subscribers (email, source)
values
  ('sumit.kumar@convegenius.ai', 'seed')
on conflict (email) do update
  set unsubscribed_at = null;
