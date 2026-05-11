import { cn } from "@/lib/utils/cn";
import { SystemLabel } from "./SystemLabel";

interface Props {
  items: string[];
  className?: string;
}

/**
 * Marquee ticker — the signature header element. Doubles the items so the
 * CSS animation can loop seamlessly. Respects prefers-reduced-motion via the
 * `.ticker-track` keyframe handling in globals.css.
 */
export function Ticker({ items, className }: Props) {
  if (items.length === 0) return null;
  const doubled = [...items, ...items];
  return (
    <div
      className={cn(
        "portal-ticker relative overflow-hidden",
        className,
      )}
      role="status"
      aria-label="System status"
    >
      <div className="ticker-track">
        {doubled.map((item, idx) => (
          <span key={`${item}-${idx}`} className="inline-flex items-center gap-3">
            <span className="signal-dot" aria-hidden />
            <SystemLabel className="text-portal-text">{item}</SystemLabel>
          </span>
        ))}
      </div>
    </div>
  );
}
