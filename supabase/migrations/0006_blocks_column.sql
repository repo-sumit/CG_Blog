-- Block-based CMS: store post content as a typed CMSBlock[] array alongside
-- the existing Tiptap content_json / content_html. Posts are either
-- block-based (blocks IS NOT NULL and length > 0) or Tiptap-based (legacy).
-- The post detail page picks the renderer based on which is present.

alter table public.posts
  add column if not exists blocks jsonb not null default '[]'::jsonb;

-- GIN index for future jsonb-based searches (tag-by-block, etc.). Inexpensive
-- on free tier given the small post volume.
create index if not exists posts_blocks_gin on public.posts using gin (blocks);
