import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-11 w-full rounded-pill border-2 border-portal-border-muted bg-portal-panel-soft",
      "px-4 py-2 text-sm font-ui text-portal-text",
      "focus-visible:outline-none focus-visible:border-portal-blue focus-visible:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      // Native select arrow looks ugly in dark mode — use background-image arrow.
      "appearance-none pr-9 bg-no-repeat bg-[length:14px] bg-[position:right_14px_center]",
      "bg-[image:url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6' fill='none'%3e%3cpath d='M1 1l4 4 4-4' stroke='%23a8a294' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e\")]",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";
