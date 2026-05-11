import { cn } from "@/lib/utils/cn";

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
};

export function Avatar({ src, name, email, size = "md", className }: AvatarProps) {
  const label = (name || email || "?").trim();
  const initials = label
    .split(/[\s.@_-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";

  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={label}
        className={cn(
          "inline-block rounded-pill object-cover border-2 border-portal-border-soft",
          SIZE[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-pill border-2 border-portal-border-soft bg-portal-panel-raised font-ui font-bold uppercase text-portal-text",
        SIZE[size],
        className,
      )}
      aria-label={label}
    >
      {initials}
    </span>
  );
}
