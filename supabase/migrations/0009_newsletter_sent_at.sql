-- Per-post newsletter idempotency. We only ever email subscribers ONCE per
-- post — even if the post is republished or the cron retries. The column is
-- nullable so existing rows are treated as "not yet sent".

alter table public.posts
  add column if not exists newsletter_sent_at timestamptz;

-- Partial index — only useful when we look up unsent posts, which is what
-- both the publish cron and the Post Now action care about.
create index if not exists posts_newsletter_unsent_idx
  on public.posts (id)
  where newsletter_sent_at is null;
