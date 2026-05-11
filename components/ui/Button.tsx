import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

// Dark-portal button system. All variants are pill-shaped, mono-uppercase,
// 2px outlined — matches the design system's primary/secondary spec.
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-ui text-[11px] uppercase tracking-label",
    "rounded-pill border-2",
    "transition-[transform,box-shadow,background,color,border-color] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main",
    "disabled:pointer-events-none disabled:opacity-50",
    "hover:-translate-y-px",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-portal-text text-portal-inverse border-portal-border-main hover:shadow-glow",
        outline:
          "bg-transparent text-portal-text border-portal-border-muted hover:border-portal-border-main hover:shadow-glow",
        secondary:
          "bg-portal-panel-raised text-portal-text border-portal-border-soft hover:border-portal-border-muted",
        ghost:
          "border-transparent bg-transparent text-portal-text-muted hover:text-portal-text hover:bg-portal-panel-soft",
        destructive:
          "bg-portal-red text-portal-inverse border-portal-red hover:shadow-[0_0_18px_rgba(255,77,94,0.45)]",
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
