-- One-shot rewrite: replace embedded short-lived signed URLs with the stable
-- /api/media/file?path=... pattern. Safe to re-run (matches only the legacy
-- shape; rewritten rows look like `/api/media/file?path=...` and don't match).
--
-- Background: the original /api/media/upload route returned a 7-day signed
-- URL like https://<ref>.supabase.co/storage/v1/object/sign/blog-media/<path>?token=...
-- and that URL was embedded directly into post HTML. After 7 days the URL
-- 404s. The new /api/media/file route re-signs on demand from the storage
-- path. This migration converts existing HTML to the new form so already-
-- published posts keep playing.

update public.posts
set content_html = regexp_replace(
  content_html,
  -- Capture group 1: the storage path inside the signed URL.
  E'https?://[^"\\s]+/storage/v1/object/sign/blog-media/([^"?]+)\\?token=[^"\\s]+',
  E'/api/media/file?path=\\1',
  'g'
)
where content_html ~ '/storage/v1/object/sign/blog-media/';
