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

-- Allowlist seed — ConveGenius team.
-- The auth callback also reconciles APP_MANAGER_EMAIL / APP_AUTHOR_EMAILS into
-- this table on each sign-in, but seeding here makes everyone visible in
-- /admin/users immediately, even before they've signed in for the first time.
insert into public.authorized_users (email, role, weekly_post_day) values
  ('sumit.kumar@convegenius.ai',   'manager', 1),  -- Monday
  ('aditya.c@convegenius.ai',      'author',  2),  -- Tuesday
  ('om.kumar@convegenius.ai',      'author',  3),  -- Wednesday
  ('insha.naseem@convegenius.ai',  'author',  4),  -- Thursday
  ('aryan.singh@convegenius.ai',   'author',  5)   -- Friday
on conflict (email) do nothing;
