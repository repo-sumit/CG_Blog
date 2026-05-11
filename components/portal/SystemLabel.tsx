import { cn } from "@/lib/utils/cn";

interface Props extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: "muted" | "orange" | "blue" | "green";
  dot?: boolean;
}

const TONE = {
  muted: "text-portal-text-muted",
  orange: "text-portal-orange",
  blue: "text-portal-blue",
  green: "text-portal-green",
} as const;

/**
 * Uppercase monospace UI label — the system-status / metadata typography that
 * shows up everywhere in the design ("SYSTEM ONLINE", "001 // FEATURED", etc.).
 */
export function SystemLabel({ tone = "muted", dot, className, children, ...rest }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-ui text-[11px] uppercase tracking-label",
        TONE[tone],
        className,
      )}
      {...rest}
    >
      {dot ? <span className="signal-dot" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function JapaneseLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-ui text-[11px] text-portal-text-soft tracking-wider", className)} aria-hidden>
      {children}
    </span>
  );
}
