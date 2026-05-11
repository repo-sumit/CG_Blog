import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Mono uppercase pill badges — the "001 // DESIGN" + status indicator chips
// that show up on every card.
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 font-ui text-[10px] uppercase tracking-label transition-colors",
  {
    variants: {
      variant: {
        default: "border-portal-orange/40 bg-portal-orange/10 text-portal-orange",
        secondary: "border-portal-border-soft bg-portal-panel-soft text-portal-text-muted",
        outline: "border-portal-border-muted text-portal-text",
        success: "border-portal-green/40 bg-portal-green/10 text-portal-green",
        warning: "border-portal-yellow/40 bg-portal-yellow/10 text-portal-yellow",
        destructive: "border-portal-red/40 bg-portal-red/10 text-portal-red",
        muted: "border-portal-border-soft bg-portal-panel text-portal-text-muted",
        blue: "border-portal-blue/40 bg-portal-blue/10 text-portal-blue",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
