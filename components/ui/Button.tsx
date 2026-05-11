import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Dark-portal button system. All variants are pill-shaped, mono-uppercase,
// outlined — matches the design system spec.
//
// CONTRAST RULES (audited 2026-05-11):
//   - Cream surfaces (bg-portal-inverse, bg-portal-text) MUST use
//     text-portal-text-inverse (near-black) — never text-portal-text (cream).
//   - Dark surfaces MUST use text-portal-text (cream).
//   - Hairline rgba border on cream buttons gives the pill definition against
//     the dark page background without adding visual weight.
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-ui text-[11px] uppercase tracking-label",
    "rounded-pill border",
    "transition-[transform,box-shadow,background,color,border-color,opacity] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
    "disabled:pointer-events-none disabled:opacity-50",
    "hover:-translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — cream surface, near-black ink, hairline border.
        default:
          "bg-portal-inverse text-portal-text-inverse border-[rgba(17,17,17,0.12)] hover:bg-[#fffcef]",
        // Outline — dark transparent, light ink. Adds presence on hover.
        outline:
          "bg-transparent text-portal-text border-portal-border-muted hover:border-portal-text hover:bg-portal-panel-soft",
        // Secondary — quiet dark fill, light ink.
        secondary:
          "bg-portal-panel-raised text-portal-text border-portal-border-soft hover:bg-portal-panel hover:border-portal-border-muted",
        // Ghost — no fill, no border.
        ghost:
          "border-transparent bg-transparent text-portal-text-muted hover:text-portal-text hover:bg-portal-panel-soft",
        // Destructive — red surface, light ink (white on red is the WCAG-safe pairing).
        destructive:
          "bg-portal-red text-white border-portal-red hover:bg-[#ff3d50]",
        // Link — no fill, blue ink, no border.
        link:
          "border-transparent bg-transparent text-portal-blue hover:underline underline-offset-4 px-0",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 px-4 text-[10px]",
        lg: "h-12 px-7 text-xs",
        icon: "h-10 w-10 px-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />;
  },
);
Button.displayName = "Button";

export { buttonVariants };
