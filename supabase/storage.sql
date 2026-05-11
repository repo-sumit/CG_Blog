-- Create the private `blog-media` bucket. Run once.
insert into storage.buckets (id, name, public)
values ('blog-media', 'blog-media', false)
on conflict (id) do nothing;
