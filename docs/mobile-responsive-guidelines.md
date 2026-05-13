# Mobile + responsive guidelines

What the app already does, what to keep doing, and what to watch for.

## Breakpoints

Tailwind defaults — we don't override.

| Name | min-width | Use |
|---|---|---|
| (none) | 0 | Mobile-first base styles |
| `sm` | 640px | Small tablets, large phones in landscape |
| `md` | 768px | Tablets |
| `lg` | 1024px | Small laptops |
| `xl` | 1280px | Standard laptops |
| `2xl` | 1536px | Large desktops |

Most layouts switch from 1-column to 2-column at `sm`, and to 3-column at `lg`.

## Layout primitives

- **Container** — `mx-auto w-full max-w-screen-xl px-3 sm:px-4` (or use the
  Tailwind container plugin, which is configured to 1360px max).
- **Grid** — `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` for
  card feeds. Always combine with `min-w-0` on the cell when the cell
  contains long unbreakable strings.
- **Sidebar layout** — `grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]`
  so the editor + dashboard collapse cleanly under `lg`.

## Overflow defence

Three layers, applied site-wide:

1. `html, body { overflow-x: hidden }` in `globals.css`.
2. `min-w-0` on grid cells whose content might be wider than the cell.
3. `overflow-wrap: anywhere` on the editor's `.ProseMirror` to prevent long
   URLs from blowing out the layout.

If a page still scrolls horizontally on mobile, **find the actual offender**
(usually a `min-w-[...]` on a table or a fixed-width image) — don't just
add another `overflow-hidden`.

## Typography

Headings use responsive `text-*` ramps:

```html
<h1 class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl">
```

Body copy stays at `text-base` (15–16px) regardless of breakpoint — the cap
of `max-w-prose` on long-form content keeps line length comfortable.

The editor title input is `text-2xl sm:text-3xl md:text-4xl` so it reads
prominently on mobile without overflowing.

## Touch targets

Minimum 44×44px for any interactive element on mobile. The button system
ships `h-11` (44px) by default at the `default` size; `sm` size is `h-9`
(36px) and should only be used on desktop where pointers are precise.

The compact `ThemeToggle` icon button is `h-9 w-9` (36px) — acceptable for
secondary actions in a top nav, but anything primary should be `h-11`.

## Editor on mobile

- **Toolbar** wraps + horizontally scrolls (`overflow-x-auto flex-wrap`).
- **Sidebar** stacks below the canvas at `<lg`. Thumbnail picker grid
  becomes 3-col regardless of breakpoint so existing-image thumbnails stay
  scannable.
- **Three publish actions** stack vertically on mobile (`flex-col`), become
  a horizontal row on `sm+`. Each button is full-width on mobile so touch
  targets stay generous.
- **Schedule modal** uses native `datetime-local` — OS picker on mobile,
  fast on every device.

## Mobile nav

`TopNav` has a separate mobile horizontal-scroll nav strip at
`<md` (`md:hidden` on the main desktop nav, `md:hidden` on the bottom
strip). Theme toggle uses the compact variant under `md`.

`PublicNav` shrinks gracefully — the brand + sign-in button stay; the
"Signal Feed" link drops under `md` (it's accessible via the brand link
anyway).

## Performance

- `prefers-reduced-motion` disables the ticker scroll, signal-dot pulse,
  and demo-counter pulse via the `@media (prefers-reduced-motion: reduce)`
  block in `globals.css`.
- The decorative `.concentric` background uses `repeating-radial-gradient`
  which is cheap to paint. Don't add more than 2 per viewport.
- Images use `loading="lazy"` (cover thumbnails) so feeds don't block
  initial paint.

## Don'ts

- ❌ Don't use `min-w-[800px]` on a table without a horizontal-scroll wrapper.
- ❌ Don't apply `overflow: hidden` as a "fix" — find the actual width offender.
- ❌ Don't use fixed pixel margins (`mb-16`, `py-20`) for section spacing on
  mobile. Use responsive variants (`pb-10 sm:pb-16`).
- ❌ Don't omit the `min-w-0` on flexbox / grid cells containing truncate
  utilities — `truncate` is silently a no-op without it.
