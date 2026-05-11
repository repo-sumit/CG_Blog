import * as React from "react";
import { cn } from "@/lib/utils/cn";

const inputBase = [
  "flex h-11 w-full rounded-pill border-2 border-portal-border-muted bg-portal-panel-soft",
  "px-4 py-2 text-sm font-ui text-portal-text",
  "placeholder:text-portal-text-soft",
  "focus-visible:outline-none focus-visible:border-portal-blue focus-visible:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "transition-colors",
].join(" ");

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} ref={ref} className={cn(inputBase, className)} {...props} />
  ),
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[88px] w-full rounded-md border-2 border-portal-border-muted bg-portal-panel-soft",
      "px-4 py-2.5 text-sm font-ui text-portal-text",
      "placeholder:text-portal-text-soft",
      "focus-visible:outline-none focus-visible:border-portal-blue focus-visible:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
