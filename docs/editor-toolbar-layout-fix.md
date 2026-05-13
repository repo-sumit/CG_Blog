# Editor toolbar + layout fix

## Root cause: why the toolbar was never actually sticky

`position: sticky` pins an element relative to the **nearest scrolling
ancestor**. Per the CSS spec, an ancestor counts as "scrolling" if it has
`overflow: hidden`, `auto`, `scroll`, or `overlay` — **even when no actual
scroll happens**.

The editor was structured as:

```
<body>
  <main>
    <div class="grid …">
      <Card class="portal-panel">      ← .portal-panel sets overflow: hidden
        <EditorToolbar class="sticky top-16" />
        <CardContent>
          <Title /> <Body />
        </CardContent>
      </Card>
    </div>
  </main>
</body>
```

The `.portal-panel` CSS class (which `Card` applies) includes
`overflow: hidden`. That made the Card the toolbar's "scrolling ancestor",
so sticky pinned to the Card's top edge — and when the Card scrolled off-
screen, the toolbar went with it. Removing the Tailwind utility
`overflow-hidden` didn't help because the base `.portal-panel` rule still
applied.

## Fix: move the toolbar OUT of the Card

```
<body>
  <main>
    <div class="grid …">
      <div class="flex flex-col gap-3">  ← non-clipping flex column
        <EditorToolbar class="sticky top-16 z-30" />
        <Card class="portal-panel">       ← stays overflow-hidden (rounded corners)
          <CardContent>
            <Title /> <Body />
          </CardContent>
        </Card>
      </div>
    </div>
  </main>
</body>
```

The toolbar is now a SIBLING of the Card. Its nearest scrolling ancestor is
the body (no clipping `<div>` between them). Sticky pins to the viewport like
intended, and the Card keeps its rounded-corner clipping behaviour.

## Files changed

- [components/editor/PostEditor.tsx](../components/editor/PostEditor.tsx)
  - Restructured the left column of the editor grid: toolbar + card are now
    siblings inside a `flex min-w-0 flex-col gap-3` wrapper.
  - Removed `previewMode` state and the bottom "Preview" toggle button (the
    in-editor preview was crashing the page by toggling `EditorContent` +
    `BubbleMenu` mid-render).
  - Added `useEffect` that attaches a paste listener to the editor's DOM:
    bare video URLs (no surrounding text) become `EmbedBlock` nodes; mixed
    pastes still fall through to TipTap's normal link auto-detection.
  - `handleEmbed` rewritten to use the typed `insertVideoEmbed` helper —
    the previous raw-HTML path triggered the same `removeChild` errors that
    used to plague audio uploads.
- [components/editor/EditorToolbar.tsx](../components/editor/EditorToolbar.tsx)
  - Already had `sticky top-16 z-30`; no functional change this round — its
    behaviour now works because the parent isn't a clipping ancestor.
- [lib/editor/media-extensions.ts](../lib/editor/media-extensions.ts)
  - New `EmbedBlock` Node extension. Atomic + draggable + selectable, like
    `AudioBlock`/`VideoBlock`.
  - `parseHTML` recognises both the new shape (`<div data-video-embed>`)
    and the legacy shape (`<div data-embed>`) so old saved posts load
    correctly.
  - `renderHTML` wraps the iframe in a 16:9 responsive container with the
    `video-embed-frame` class.
  - Helper export `insertVideoEmbed(editor, { src, provider })` for callers.
- [lib/editor/extensions.ts](../lib/editor/extensions.ts) — registered the new
  EmbedBlock alongside AudioBlock / VideoBlock.
- [lib/env.ts](../lib/env.ts) — `maxVideoUploadMb` default reverted to 50.
- [app/globals.css](../app/globals.css) — `.video-embed-frame` styling +
  selected-node outline.

## Why the in-editor preview was removed

The bottom-right "Preview" toggle swapped `<EditorContent>` for a
`dangerouslySetInnerHTML` block. The BubbleMenu component (mounted as a
sibling of `EditorContent`) holds onto the editor's DOM node — when the
parent ternary unmounted both at once, ProseMirror's tippy.js positioning
tried to read from a node that React had already removed and the page
crashed. The fix is to drop the in-editor preview entirely; authors who
want a preview can use the public post URL after Save Draft.

## Video upload cap

Reverted to **50 MB** for upload (`NEXT_PUBLIC_MAX_VIDEO_UPLOAD_MB=50` is
the default). Larger video files should be hosted externally and embedded
via the toolbar's "Embed video" button or by pasting the URL into the
editor.

## External video embeds

Supported providers (allowlist in
[lib/utils/embeds.ts](../lib/utils/embeds.ts)):

| Provider | Input URL shape | Rendered as |
|---|---|---|
| YouTube | `youtube.com/watch?v=ID` · `youtu.be/ID` · `youtube.com/shorts/ID` | `youtube.com/embed/ID` |
| Vimeo | `vimeo.com/ID` (numeric) | `player.vimeo.com/video/ID` |
| Loom | `loom.com/share/ID` · `loom.com/embed/ID` | `loom.com/embed/ID` |
| Google Drive | `drive.google.com/file/d/ID/view` | `drive.google.com/file/d/ID/preview` |

Anything outside the allowlist is rejected by `parseEmbedUrl`. Raw iframes
are NEVER rendered from user input — only pre-validated provider URLs make
it into the saved HTML, and the server-side `sanitizeHtml` runs a second
allowlist check before persisting.

## Paste-to-embed UX

```
Paste a bare URL like https://www.youtube.com/watch?v=abc
  → inserted as <EmbedBlock>, toast "Video embed added."

Paste "Check this out https://youtu.be/abc" (mixed text)
  → TipTap's autolink kicks in, leaves a plain hyperlink. No embed.

Paste an unsupported domain bare URL
  → falls through to normal paste behaviour (becomes a link).
```

The handler attaches to `editor.view.dom` so it sees the paste event before
TipTap's internal logic. When the URL matches a provider, we
`preventDefault` and insert the embed node directly.

## QA checklist

- [x] Toolbar stays pinned `top-16` while scrolling a long post.
- [x] No white space above the toolbar — toolbar is the first visible
      element after the action-bar row.
- [x] Word + read-time stats row still shown at the bottom of the Card;
      Preview toggle is gone.
- [x] Video upload cap is 50 MB (env default reverted).
- [x] YouTube / Loom / Vimeo / Drive URLs render as playable iframes in the
      editor AND on the published post page.
- [x] Paste-only video URL → embed; mixed-content paste → link.
- [x] Mobile: iframe wrapper uses `padding-bottom: 56.25%` for 16:9 scaling
      with `width: 100%`.
- [x] Audio + image upload still works (typed nodes from prior pass).
