import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Dark-portal button system. All variants are pill-shaped, mono-uppercase,
// outlined — matches the design system spec.
//
// CONTRAST RULES (audited 2026-05-13, fixed for hover invisibility bug):
//
//   1. Every variant's HOVER state MUST flip the foreground colour together
//      with the background. A "New Transmission" button whose surface goes
//      cream-on-hover but whose text stays cream becomes invisible — that
//      was the bug. Each variant below stamps an explicit `hover:text-*`.
//
//   2. Cream surfaces (bg-portal-inverse) → text-portal-text-inverse (near-black).
//   3. Dark surfaces (bg-[#08090d]) → text-portal-text (cream).
//   4. Red/destructive → white ink (WCAG-safe pairing).
//   5. Icons inherit `currentColor` — never set a fixed text colour on an
//      icon inside a button.
//
// Disabled buttons are dimmed (`opacity-55`) but keep their high-contrast
// text-on-bg pairing so the label stays readable even when the action is
// unavailable.
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-ui text-[11px] uppercase tracking-label",
    "rounded-pill border",
    "transition-[transform,box-shadow,background,color,border-color,opacity] duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
    "disabled:pointer-events-none disabled:opacity-55 disabled:cursor-not-allowed",
    "hover:-translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        // Primary CTA — cream surface, near-black ink. Hover deepens the
        // surface tint but ink stays near-black; both states pass contrast.
        default:
          "bg-portal-inverse text-portal-text-inverse border-[rgba(17,17,17,0.12)] hover:bg-[#fffcef] hover:text-portal-text-inverse hover:border-[rgba(17,17,17,0.32)]",

        // Outline — dark transparent surface, light ink. Hover paints a
        // soft panel underneath and explicitly KEEPS the light ink so the
        // label survives the colour swap.
        outline:
          "bg-transparent text-portal-text border-portal-border-muted hover:border-portal-text hover:bg-portal-panel-soft hover:text-portal-text",

        // Secondary — quiet dark fill, light ink. Same rule on hover.
        secondary:
          "bg-portal-panel-raised text-portal-text border-portal-border-soft hover:bg-portal-panel hover:border-portal-border-muted hover:text-portal-text",

        // Ghost — no fill, no border. Muted ink turns full-strength on hover.
        ghost:
          "border-transparent bg-transparent text-portal-text-muted hover:text-portal-text hover:bg-portal-panel-soft",

        // Destructive — red surface, white ink. Hover darkens the red but
        // keeps white ink (WCAG-safe pair holds at both shades).
        destructive:
          "bg-portal-red text-white border-portal-red hover:bg-[#ff3d50] hover:text-white",

        // Link — no fill, blue ink, no border. Hover underlines instead of
        // swapping colours.
        link:
          "border-transparent bg-transparent text-portal-blue hover:underline underline-offset-4 hover:text-portal-blue px-0",
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
