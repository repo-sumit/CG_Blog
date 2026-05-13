-- Save / publish performance indexes.
--
-- These are not strictly required at small data sizes — the planner already
-- happily seq-scans the posts table when it has a handful of rows. Adding
-- them now means we don't have a slow-query regression once authors actually
-- start posting weekly.
--
-- All `create index if not exists`, so re-running the file is idempotent.

-- `listOwnPosts` orders by `updated_at DESC`. Without this index the planner
-- sorts the whole filtered set; with it the sort is free.
create index if not exists posts_updated_at_idx
  on public.posts (updated_at desc);

-- The publish-scheduled cron filters `where status = 'scheduled' and scheduled_for <= now()`.
-- The existing `posts_status_published_idx` indexes (status, published_at)
-- which doesn't help that query.
create index if not exists posts_scheduled_for_idx
  on public.posts (scheduled_for)
  where status = 'scheduled' and scheduled_for is not null;

-- Admin analytics filters `post_views.viewer_id` when computing logged-in
-- vs anonymous mix. The existing (post_id, session_id, created_at desc)
-- composite doesn't help that scan.
create index if not exists post_views_viewer_id_idx
  on public.post_views (viewer_id)
  where viewer_id is not null;
