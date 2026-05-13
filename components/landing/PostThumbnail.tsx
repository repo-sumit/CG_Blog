import { cn } from "@/lib/utils/cn";

interface Props {
  /** Real cover image URL, or null when the author didn't pick one. */
  url: string | null;
  /** Post title — used both for `alt` text and the placeholder initials. */
  title: string;
  /** Slug — seeds the placeholder palette + section number deterministically. */
  slug: string;
  className?: string;
}

/**
 * Cover image for a post card. When the author supplied a thumbnail we render
 * it with a thin design-system overlay (section number + brand mark) so even
 * uploaded photos read as part of the dark portal language. When no cover is
 * set we fall back to a richly decorated HTML placeholder — section number,
 * Japanese micro label, concentric pattern, scanlines, signal dot, dotted
 * inset frame — all pure CSS so the placeholder server-renders cleanly into
 * the static feed.
 *
 * All decorative chrome is deterministic per-slug so the same post always
 * looks the same across reloads.
 */
export function PostThumbnail({ url, title, slug, className }: Props) {
  const seed = hashString(slug);
  const sectionNumber = String((seed % 999) + 1).padStart(3, "0");
  const jpLabel = JP_LABELS[seed % JP_LABELS.length]!;

  if (url) {
    return (
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden bg-portal-panel-soft",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {/* Bottom gradient — keeps the section/brand chip legible regardless
            of how bright the photo is in the lower-left corner. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent"
        />
        <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-black/55 px-2 py-0.5 font-ui text-[10px] uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
          {sectionNumber} <span aria-hidden className="text-portal-orange">{"//"}</span> Signal
        </span>
        <span className="pointer-events-none absolute right-3 top-3 font-ui text-[10px] uppercase tracking-[0.16em] text-white/65 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          {jpLabel}
        </span>
        <span className="pointer-events-none absolute bottom-3 left-3 font-ui text-[10px] uppercase tracking-[0.22em] text-white/85 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          CG <span aria-hidden className="text-portal-orange">·</span> Signal
        </span>
        <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 font-ui text-[9px] uppercase tracking-[0.18em] text-white/70 drop-shadow-[0_1px_4px_rgba(0,0,0,0.7)]">
          <span aria-hidden className="signal-dot inline-block h-1.5 w-1.5 rounded-full bg-portal-green" />
          Live
        </span>
      </div>
    );
  }

  const palette = PLACEHOLDER_PALETTES[seed % PLACEHOLDER_PALETTES.length]!;
  const initials = deriveInitials(title);

  return (
    <div
      className={cn(
        "group/thumb relative aspect-video w-full overflow-hidden",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
      aria-label={title}
      role="img"
    >
      {/* ── Pattern stack — layered back-to-front, all pointer-events:none ── */}
      <div aria-hidden className="absolute inset-0 grid-overlay-sm opacity-25" />
      <div
        aria-hidden
        className="absolute -right-16 -top-16 h-56 w-56 concentric opacity-25 mix-blend-screen"
      />
      <div aria-hidden className="absolute inset-0 scanlines opacity-40" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.14), transparent 55%)",
        }}
      />

      {/* Wireframe triangle in the lower right — pure SVG so it scales crisply. */}
      <svg
        aria-hidden
        viewBox="0 0 100 100"
        className="absolute -bottom-6 -right-6 h-32 w-32 opacity-25 mix-blend-screen"
      >
        <polygon
          points="50,8 92,88 8,88"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-white"
        />
        <polygon
          points="50,28 78,80 22,80"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-white"
        />
      </svg>

      {/* ── Foreground content ─────────────────────────────────────────── */}

      {/* Dotted inset frame — design system spec calls for "dotted lines" as
          decorative shapes; this lifts the placeholder above the gradient. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-2 rounded-md border border-dashed border-white/20 sm:inset-3"
      />

      {/* Big slug-derived initials, dead-centre. */}
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <span
          className="font-hero text-6xl font-black uppercase tracking-tighter text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.4)] sm:text-7xl"
          style={{ letterSpacing: "-0.05em" }}
        >
          {initials}
        </span>
      </div>

      {/* Top-left — section number in the design-system "001 // SIGNAL" idiom. */}
      <span className="absolute left-3 top-3 font-ui text-[10px] uppercase tracking-[0.18em] text-white/80">
        {sectionNumber} <span aria-hidden className="text-portal-orange">{"//"}</span> Signal
      </span>

      {/* Top-right — Japanese micro label per the brand voice. */}
      <span className="absolute right-3 top-3 font-ui text-[10px] uppercase tracking-[0.16em] text-white/65">
        {jpLabel}
      </span>

      {/* Bottom-left — wordmark. */}
      <span className="absolute bottom-3 left-3 font-ui text-[10px] uppercase tracking-[0.22em] text-white/80">
        CG <span aria-hidden className="text-portal-orange">·</span> Signal
      </span>

      {/* Bottom-right — pulsing signal dot to telegraph "live transmission". */}
      <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 font-ui text-[9px] uppercase tracking-[0.18em] text-white/70">
        <span
          aria-hidden
          className="signal-dot inline-block h-1.5 w-1.5 rounded-full bg-portal-green"
        />
        Online
      </span>
    </div>
  );
}

function deriveInitials(title: string): string {
  const cleaned = title.trim();
  if (!cleaned) return "CG";
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

/** Deterministic 32-bit-ish hash so the same slug always picks the same palette. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Curated palettes tuned for the dark portal. Each pairs a deep brand-adjacent
// base with a brighter accent so the white initials and chrome stay legible.
const PLACEHOLDER_PALETTES = [
  { from: "#1a2540", to: "#4f8cff" }, // signal blue
  { from: "#3a1810", to: "#ff5a1f" }, // signal orange
  { from: "#0f2820", to: "#35d07f" }, // signal green
  { from: "#3a1820", to: "#ff4d5e" }, // signal red
  { from: "#1a1830", to: "#7c3aed" }, // signal purple
  { from: "#2a2410", to: "#ffd166" }, // signal yellow
  { from: "#0f1f30", to: "#22d3ee" }, // signal cyan
] as const;

// Japanese micro labels straight from the design system's brand-voice list.
// We rotate through these per-slug so two adjacent placeholders don't show
// the same kanji.
const JP_LABELS = ["ポータル", "記事", "システム", "通信", "暗号", "信号"] as const;
