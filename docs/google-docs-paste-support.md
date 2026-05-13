# Google Docs paste support

When a user pastes content from Google Docs, Microsoft Word, or a generic
website, the rich content is preserved but garbage markup is stripped.
Pasted text feels native to the CG SIGNAL editor while keeping the semantic
hierarchy the author intended.

## What gets preserved

- Headings (`h1` → `h3`)
- Bold, italic, underline, strikethrough
- Links (`<a href>` with `rel="noopener noreferrer"`)
- Ordered + unordered lists
- Blockquotes
- Inline code, code blocks
- Paragraph spacing
- Inline text color (when the source set one)
- Inline `text-align` on paragraphs

## What gets stripped

- `<script>`, `<style>`, `<meta>`, `<link>`, `<head>` blocks
- All `class` and `id` attributes (Google Docs ships dozens of vendor classes)
- `data-*` attributes
- Inline `font-family`, `font-size`, `line-height`, page margins
- Google Docs `<b style="font-weight:normal">` wrappers (auto-unwrapped)
- Bare `<span>` elements left after attribute stripping
- Layout containers (Google Docs wraps everything in nested divs)

## Implementation

[`lib/editor/paste-sanitize.ts`](../lib/editor/paste-sanitize.ts) exposes
`sanitizePastedHtml(input)` which is wired to TipTap via
`editorProps.transformPastedHTML` in [`PostEditor.tsx`](../components/editor/PostEditor.tsx).

The function runs in the browser only — there's a `typeof window` guard for
SSR safety. It uses native `DOMParser` to walk the paste fragment, strips
incompatible attributes/elements, and returns the cleaned HTML string. The
result is then fed into ProseMirror's parser, which drops any tag not in
the editor schema.

The cleanup runs **before** ProseMirror sees the paste, so users never see a
visual flash of broken styling.

## Defense in depth

The server-side [`sanitizeHtml`](../lib/editor/sanitize.ts) still runs on
every save. Even if a stray `<script>` made it through the paste sanitizer,
it would be stripped before the row is written.

## Allowed shortlist (re-stated for ops)

Tags that ProseMirror's schema accepts after our paste pass:

```
p h1 h2 h3 h4 strong b em i u
ul ol li a blockquote code pre br span
```

Styles we keep on those tags:

```
color background-color font-weight font-style text-decoration text-align
```

Everything else is discarded.
