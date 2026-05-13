import { cn } from "@/lib/utils/cn";

interface Props {
  /** Real cover image URL, or null when the author didn't pick one. */
  url: string | null;
  /** Post title — used both for `alt` text and the placeholder initials. */
  title: string;
  /** Slug — seeds the placeholder palette deterministically. */
  slug: string;
  className?: string;
}

/**
 * Renders the cover image for a post card. Falls back to a deterministic HTML
 * placeholder when `url` is null — using the post's first two letters as the
 * focal mark and a slug-hashed gradient so different posts get visually
 * distinct stand-ins. No external image library; pure HTML/CSS so it
 * server-renders cleanly into the static feed.
 */
export function PostThumbnail({ url, title, slug, className }: Props) {
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
      </div>
    );
  }

  const palette = PLACEHOLDER_PALETTES[hashString(slug) % PLACEHOLDER_PALETTES.length]!;
  const initials = deriveInitials(title);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden",
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`,
      }}
      aria-label={title}
      role="img"
    >
      {/* Soft grid texture so the placeholder feels at home in the dark portal */}
      <div aria-hidden className="absolute inset-0 grid-overlay-sm opacity-25" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 25% 30%, rgba(255,255,255,0.12), transparent 55%)",
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-4">
        <span
          className="font-hero text-5xl font-bold uppercase tracking-tighter text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:text-6xl"
          style={{ letterSpacing: "-0.04em" }}
        >
          {initials}
        </span>
      </div>
      <div className="absolute bottom-2 left-3 font-ui text-[9px] uppercase tracking-[0.18em] text-white/55">
        CG · Signal
      </div>
    </div>
  );
}

function deriveInitials(title: string): string {
  const cleaned = title.trim();
  if (!cleaned) return "CG";
  // Prefer the first letter of the first two words ("Weekly Update" → "WU").
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0]![0]! + words[1]![0]!).toUpperCase();
  }
  // Single word — use the first two letters.
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

// Curated palettes tuned for the dark portal — every option pairs a deep
// brand-adjacent base with a brighter accent so the white initials stay
// legible regardless of which one a post lands on.
const PLACEHOLDER_PALETTES = [
  { from: "#1a2540", to: "#4f8cff" }, // signal blue
  { from: "#3a1810", to: "#ff5a1f" }, // signal orange
  { from: "#0f2820", to: "#35d07f" }, // signal green
  { from: "#3a1820", to: "#ff4d5e" }, // signal red
  { from: "#1a1830", to: "#7c3aed" }, // signal purple
  { from: "#2a2410", to: "#ffd166" }, // signal yellow
  { from: "#0f1f30", to: "#22d3ee" }, // signal cyan
] as const;
