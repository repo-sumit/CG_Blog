import Link from "next/link";
import { BRAND_ICON_URL } from "@/lib/brand";
import { cn } from "@/lib/utils/cn";

interface Props {
  size?: "sm" | "md" | "lg";
  href?: string;
  withSubtitle?: boolean;
  className?: string;
}

const SIZE = {
  sm: { icon: 24, name: "text-sm", sub: "text-[10px]", gap: "gap-2.5" },
  md: { icon: 32, name: "text-base", sub: "text-[11px]", gap: "gap-3" },
  lg: { icon: 56, name: "text-2xl", sub: "text-xs", gap: "gap-4" },
} as const;

/**
 * Brand lockup — "CG SIGNAL" + Team Blog Portal subtitle.
 * Flex baseline ensures the icon optically aligns with the wordmark cap
 * height, fixing the cramped/off-center alignment of earlier versions.
 */
export function BrandLockup({ size = "md", href, withSubtitle = true, className }: Props) {
  const s = SIZE[size];
  const inner = (
    <span className={cn("inline-flex items-center", s.gap, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_ICON_URL}
        alt=""
        width={s.icon}
        height={s.icon}
        className="shrink-0 rounded-md"
        style={{ width: s.icon, height: s.icon }}
      />
      <span className="flex flex-col leading-none">
        <span className={cn("font-hero font-bold uppercase text-portal-text", s.name)} style={{ letterSpacing: "0.02em" }}>
          CG&nbsp;Signal
        </span>
        {withSubtitle ? (
          <span className={cn("mt-1 font-ui uppercase text-portal-text-muted", s.sub)} style={{ letterSpacing: "0.16em" }}>
            Team&nbsp;Blog&nbsp;Newsletter
          </span>
        ) : null}
      </span>
    </span>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="inline-flex rounded-md outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main"
      >
        {inner}
      </Link>
    );
  }
  return inner;
}
