# Editor toolbar + collaboration upgrade

## Shipped in this pass

### Sticky toolbar

The format toolbar at the top of the editor now sticks to `top: 64px` (just
under the 64px-tall `TopNav`) while scrolling through a long post. Implementation
is a single Tailwind change in
[components/editor/EditorToolbar.tsx](../components/editor/EditorToolbar.tsx):

```tsx
className="sticky top-16 z-30 -mx-px flex max-w-full flex-wrap items-center
           gap-1 overflow-x-auto border-b bg-background/95 p-2 backdrop-blur"
```

`z-30` sits below the nav (`z-40`) but above the editor body. On narrow
phones the row wraps; if wrapping fails (e.g. inside a flex parent that
won't shrink) it horizontally scrolls so no buttons clip.

### Floating selection (BubbleMenu)

Selecting text in the editor now pops a compact bubble with Bold / Italic /
Underline / Highlight / Link. Implementation uses TipTap's
[`@tiptap/extension-bubble-menu`](https://tiptap.dev/api/extensions/bubble-menu)
via the `BubbleMenu` React wrapper from `@tiptap/react`. Tippy.js handles
positioning, scroll-hide, and outside-click behaviour automatically.

Bubble chrome lives in `globals.css` under `.bubble-menu` — themed against
the dark portal palette via CSS variables so it adapts to light mode too.

### Hyperlink styling

Links in the editor AND in the published article now render as solid blue
with underline in both themes. Light mode `#2563eb`, dark mode `#4f8cff`,
both from the existing `--accent-blue` token. Implementation in
[app/globals.css](../app/globals.css) under `.ProseMirror a` and
`.article-body a` selectors. `!important` is used to override any inline
`color:` left over from pasted content.

### Em-dash / en-dash normalisation

Save now passes title + excerpt + HTML through `normalizePostText` /
`normalizePostHtml` (see [lib/utils/normalize-text.ts](../lib/utils/normalize-text.ts))
which converts `—` and `–` to `-`. Text inside `<a href="…">…</a>` anchors
is preserved untouched so URL paths with intentional dashes are safe.

### Video upload limit

Image / audio / document caps stay at 50 MB (`NEXT_PUBLIC_MAX_UPLOAD_MB`).
Video gets its own raised cap of 150 MB via `NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB`,
read in [lib/env.ts](../lib/env.ts) and enforced both client-side (in
`PostEditor.tsx`) and server-side (in `app/api/media/upload/route.ts`).

The `validateFile` helper now accepts either a single byte cap (back-compat)
or a per-media-type map and picks the right limit for the uploaded mime.

### Inline tag creation

The editor sidebar's Tags card has a new input field. Type a tag name, press
Enter, and the new tag is created server-side and immediately selected for
the post. Implementation:

- Server action [`createTagAsAuthor`](../app/(app)/editor/actions.ts) — author/manager-callable, validates length (≤30 chars), case-insensitively dedupes by slug, returns the existing row when a duplicate is requested so the editor can select it without a second round-trip.
- Limits enforced in both client (`MAX_TAG_LENGTH = 30`, `MAX_TAGS_PER_POST = 10`) and server (zod schema).
- Service-role client used after `requireSession()` auth check — the existing `tags` table RLS policy (`tags_manager`) doesn't allow author inserts, and broadening it would widen the attack surface.

## Deferred to a follow-up pass

The spec also called for a full collaboration suite — **invites with editor/reviewer roles**, **one-person-at-a-time editing locks** with heartbeat, and **draft review comments** that auto-purge on publish. These need:

- Three new DB tables (`post_collaborators`, `post_edit_locks`, `post_review_comments`) with RLS policies that interact with the existing posts policies.
- Three API routes for the lock lifecycle (acquire / heartbeat / release).
- Client wiring for the heartbeat ticker + "locked by X" UX in the editor.
- A review-comments panel with delete-on-publish hook in `savePost`.
- Permission gates so reviewers can comment but not save.

That's a meaningful design pass on its own and got cut to keep this round's scope reviewable. The DB migrations + RLS + API + UI are ready to be written next; the entry points are:

- [app/(app)/editor/actions.ts](../app/(app)/editor/actions.ts) — add lock check inside `savePost` before the update.
- [components/editor/PostEditor.tsx](../components/editor/PostEditor.tsx) — sidebar slot for the Collaborators panel sits next to the Tags card.
- [supabase/migrations/](../supabase/migrations/) — new `0012_collaboration.sql` for the three tables + RLS.

See the relevant spec sections (7, 8, 9 in the upgrade brief) for the exact schema and behaviour expected when the follow-up lands.
