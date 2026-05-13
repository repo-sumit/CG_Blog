# Mobile spacing fixes (May 2026)

What the right-side clipping bug actually was, what the fix is, and how to
spot the same regression in the future.

## Root cause of the right-side clipping

A single utility class on the landing filter strip caused the whole page to
behave broken from the contributor cards down:

```tsx
// BEFORE — app/page.tsx, search input wrapper
<div className="relative min-w-[240px] flex-1">
```

`min-w-[240px]` made the search field's flex parent unable to shrink below
240px. Combined with the surrounding flex row (search input + "Search"
button + optional "Clear" button), the row became wider than the viewport
on phones ≤ 375px. That widened the entire ancestor chain — section,
container, body. The global `overflow-x: hidden` then clipped the right
side off-screen.

Below the filter strip every `width: 100%` container inherited the wider
body width, which is why the contributor cards lower on the page looked
clipped at their right edge even though they had no fixed width of their
own. Classic mobile-overflow signature.

## Fix

```tsx
// AFTER
<div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
```

- `min-w-0` lets the flex parent shrink to fit narrow viewports.
- `basis-full sm:basis-auto` forces the search field to take a full row on
  mobile (input on its own line, buttons below via `flex-wrap`), and revert
  to the original inline layout from `sm` up.

## Reinforcement layers

In `app/globals.css`:

```css
html, body {
  max-width: 100%;
  overflow-x: clip;        /* preferred over hidden — keeps sticky working */
}
*, *::before, *::after {
  box-sizing: border-box;  /* explicit even though Tailwind preflight sets it */
}
```

These are belt-and-suspenders — once the actual overflow source is fixed
they should be a no-op, but they guarantee a regression doesn't visually
break the page until the next deploy.

## Contributor card layout

Was: `<header className="flex items-start gap-3">` with the name column as
`<div className="min-w-0 flex-1">`. Worked on most names but couldn't
guarantee truncation under tight viewports because flex children can resist
shrinking past their `min-content` width.

Now: CSS Grid with `grid-template-columns: auto minmax(0, 1fr) auto`. The
`minmax(0, 1fr)` floor of 0 (instead of the default `min-content` of `auto`)
forces the name column to honour `truncate` instead of pushing the badge
column off-screen. The role badge gets `shrink-0` so it never wraps either.

## How to spot a future overflow regression

1. Open DevTools, switch to a 320×568 viewport.
2. In the console, paste this:

```js
[...document.querySelectorAll('*')]
  .filter(el => el.scrollWidth > document.documentElement.clientWidth)
  .slice(0, 5)
```

The first 5 elements that report `scrollWidth` wider than the viewport are
the culprits. The fix is almost always one of:
- `min-w-[Xpx]` → `min-w-0`
- A hard `width: 100vw` or `w-screen` → `w-full max-w-full`
- A fixed-size image without `w-full h-auto` constraints
- A flex row with an intrinsically wide child that lacks `min-w-0`

## Mobile QA checklist

Test at these breakpoints:

- 320px (iPhone SE)
- 360px (small Android)
- 375px (iPhone Mini)
- 390px (iPhone 14)
- 414px (Plus-size phones)
- 768px (iPad portrait)

For each:

- [ ] No horizontal scroll
- [ ] No clipped content on the right edge
- [ ] Contributor cards centred with equal left/right padding
- [ ] Role badges fit inside the card
- [ ] Subscribe form input + button stack cleanly
- [ ] Top nav theme toggle fits without overlapping the brand
- [ ] Dashboard cards span full width with consistent gutters
