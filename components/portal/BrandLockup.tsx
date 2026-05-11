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
  sm: { icon: 28, name: "text-sm", sub: "text-[10px]" },
  md: { icon: 36, name: "text-base", sub: "text-[11px]" },
  lg: { icon: 56, name: "text-2xl", sub: "text-xs" },
} as const;

/**
 * Brand lockup — "CG SIGNAL" + Team Blog Portal. Composed of the favicon
 * mark and the mono wordmark. Click target is the entire lockup when `href`
 * is supplied.
 */
export function BrandLockup({ size = "md", href, withSubtitle = true, className }: Props) {
  const s = SIZE[size];
  const inner = (
    <span className={cn("inline-flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BRAND_ICON_URL}
        alt=""
        width={s.icon}
        height={s.icon}
        className="rounded-md ring-1 ring-portal-border-muted"
      />
      <span className="flex flex-col leading-tight">
        <span className={cn("font-hero font-bold tracking-tighter uppercase text-portal-text", s.name)}>
          CG&nbsp;Signal
        </span>
        {withSubtitle ? (
          <span className={cn("font-ui text-portal-text-muted tracking-label uppercase", s.sub)}>
            Team Blog Portal
          </span>
        ) : null}
      </span>
    </span>
  );
  if (href) return <Link href={href} className="inline-flex">{inner}</Link>;
  return inner;
}
