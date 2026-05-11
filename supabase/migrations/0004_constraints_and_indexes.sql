-- Helpful indexes added after the initial migrations. Safe to re-run.
-- (We intentionally do NOT add a unique constraint on weekly_post_day — the
-- application surface enforces "one person per weekday" with friendly errors,
-- so swapping people's days doesn't fail with an opaque unique-violation.)

-- Speed up the /me/posts query.
create index if not exists posts_author_status_updated_idx
  on public.posts (author_id, status, updated_at desc);

-- Speed up the inner-join filter used by listPublishedPosts when filtering by tag.
create index if not exists post_tags_tag_id_idx on public.post_tags (tag_id);
