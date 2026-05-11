-- Seed default tags and the weekly post template.
-- Safe to run multiple times.

insert into public.tags (name, slug) values
  ('Product', 'product'),
  ('Design', 'design'),
  ('Engineering', 'engineering'),
  ('QA', 'qa'),
  ('Research', 'research'),
  ('Customer Success', 'customer-success'),
  ('Analytics', 'analytics'),
  ('AI', 'ai'),
  ('Sprint Update', 'sprint-update'),
  ('Blocker', 'blocker'),
  ('Launch', 'launch'),
  ('Experiment', 'experiment')
on conflict (slug) do nothing;

insert into public.post_templates (name, description, content_json, is_default)
values (
  'Weekly Update',
  'Default template for weekly team updates.',
  $$
  {
    "type": "doc",
    "content": [
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Focus of the Week"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "What was your main focus?"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Key Work Completed"}]},
      {"type": "bulletList", "content": [
        {"type": "listItem", "content": [{"type": "paragraph"}]},
        {"type": "listItem", "content": [{"type": "paragraph"}]},
        {"type": "listItem", "content": [{"type": "paragraph"}]}
      ]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Impact / Outcome"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "What changed because of this work?"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Learnings"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "What did you learn?"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Blockers / Risks"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "Any blockers that need manager/team attention?"}]},
      {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Plan for Next Week"}]},
      {"type": "paragraph", "content": [{"type": "text", "text": "What will you work on next?"}]}
    ]
  }
  $$::jsonb,
  true
)
on conflict do nothing;

-- Allowlist — current team. Note: the `manager` role is shown as "Admin" in
-- the UI but stored as `manager` in the DB enum (keeps RLS helpers stable).
insert into public.authorized_users (email, role, weekly_post_day) values
  ('sumit.kumar@convegenius.ai',   'manager', 1),  -- Monday  · Admin
  ('aditya.c@convegenius.ai',      'manager', 2),  -- Tuesday · Admin (promoted)
  ('om.kumar@convegenius.ai',      'author',  3),  -- Wednesday
  ('insha.naseem@convegenius.ai',  'author',  4),  -- Thursday
  ('aryan.singh@convegenius.ai',   'author',  5)   -- Friday
on conflict (email) do update
  set role = excluded.role,
      weekly_post_day = excluded.weekly_post_day;

-- Promote the matching profile rows too, in case the user has already signed in.
update public.profiles
  set role = au.role,
      weekly_post_day = au.weekly_post_day
  from public.authorized_users au
  where lower(public.profiles.email) = lower(au.email);
