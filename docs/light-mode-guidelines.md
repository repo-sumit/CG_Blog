# Light mode guidelines

CG SIGNAL's light mode is intentionally **editorial paper**, not generic SaaS
white. The goal is to keep the dark-portal personality — system labels,
mono-UI, Japanese accents, technical decorations — alive on a warm cream
surface that still feels like an editorial OS.

## Surfaces

| Token | Light value | Use |
|---|---|---|
| `--bg-main` | `#f6f2e9` | Page-level background. Warm cream. |
| `--bg-page` | `#fffdf8` | Slightly brighter "page" surface for hero areas. |
| `--bg-panel` | `#ffffff` | Plain panel cards (white over cream). |
| `--bg-panel-raised` | `#fffefa` | Elevated panels (modals, dialogs). |
| `--bg-panel-soft` | `#f0ebe2` | Recessed panels — text inputs, toolbar wells. |
| `--bg-inverse` | `#11141b` | Inverse surface (rare — for "primary CTA on cream"). |

## Text

| Token | Light value | Notes |
|---|---|---|
| `--text-main` | `#111111` | Near-black ink. ≥ 12:1 on cream. |
| `--text-muted` | `#4d4d4d` | Body / meta. ≥ 7:1. |
| `--text-soft` | `#6f6a5f` | Captions / disabled. ≥ 4.5:1. |
| `--text-inverse` | `#f5f1e8` | Ink on inverse surfaces. |

## Borders

Light borders are deliberately **softer** than dark — the portal's
"luminous outlined panels" become "soft pencil-grid panels" in light mode.

- `--border-main` (`#111111`) → only on hero callouts and key panels.
- `--border-muted` (`#d5d0c7`) → default panel border.
- `--border-soft` (`#e7e1d4`) → internal dividers.

## Accents

Brand colours are dialled back ~10–15% saturation for light so they don't
"buzz" against the cream surface.

| Token | Dark | Light |
|---|---|---|
| `--accent-orange` | `#ff5a1f` | `#e6491b` |
| `--accent-blue` | `#4f8cff` | `#2563eb` |
| `--accent-green` | `#35d07f` | `#059669` |
| `--accent-yellow` | `#ffd166` | `#c2810f` |
| `--accent-red` | `#ff4d5e` | `#dc2626` |

## Patterns

- `.grid-overlay` becomes a faint warm pencil-grid (`rgba(17,17,17,0.05)`)
  instead of a luminous off-white grid.
- `.scanlines`, `.concentric`, `.checker` all inherit from the same
  `--grid-line` / `--pixel-light` variables, so they re-tint automatically.

## Shadows

Light mode uses **soft warm shadows**, not the dark mode's hard 50% blacks:

- `--shadow-soft` → `0 14px 40px rgba(17, 17, 17, 0.08)`
- `--shadow-panel` → `0 8px 24px rgba(17, 17, 17, 0.07)`
- `--shadow-glow` → soft blue tint instead of orange.

## Decorative gradients

Two places use inline `radial-gradient` with hard-coded RGBA brand colours
(landing page hero, optional subscribe section). These deliberately stay
brand-coloured in both themes — they paint as luminescence on dark and as a
soft tint on cream. If they ever feel too saturated in light mode, dial the
alpha down (currently `0.16`, try `0.10`).

## What NOT to do in light mode

- ❌ Don't use pure `#000` text — use `--text-main` (`#111`) so the contrast
  feels editorial, not absolute.
- ❌ Don't use pure `#fff` page backgrounds — use `--bg-main` (`#f6f2e9`).
  The cream is what makes the portal feel like newsprint instead of a doc.
- ❌ Don't drop the system labels (`001 // SIGNAL`, Japanese kanji, etc.).
  They're the brand voice; they just render in `--text-muted` instead of
  glowing orange.
- ❌ Don't draw thin 1px borders on `--bg-panel-soft` (cream-on-cream blur).
  Use 2px on `--border-muted` to keep the panels reading as panels.

## Button rules (light mode)

The button system in [components/ui/Button.tsx](../components/ui/Button.tsx)
uses `bg-portal-inverse text-portal-text-inverse` for the primary variant.

- In **dark mode**: `bg-portal-inverse` = cream surface, `text-portal-text-inverse` = near-black ink.
- In **light mode**: `bg-portal-inverse` = dark surface (`#11141b`), `text-portal-text-inverse` = cream ink (`#f5f1e8`).

Both modes ship a high-contrast primary CTA without per-component overrides.
