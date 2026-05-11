import { cn } from "@/lib/utils/cn";

export interface AvatarProps {
  src?: string | null;
  name?: string | null;
  email?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE: Record<NonNullable<AvatarProps["size"]>, string> = {
  sm: "h-7 w-7 text-xs",
  md: "h-9 w-9 text-sm",
  lg: "h-12 w-12 text-base",
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
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={label}
        className={cn("inline-block rounded-full object-cover ring-1 ring-border", SIZE[size], className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full bg-primary/10 text-primary font-semibold ring-1 ring-border",
        SIZE[size],
        className,
      )}
      aria-label={label}
    >
      {initials}
    </span>
  );
}
