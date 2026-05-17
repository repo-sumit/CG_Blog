import * as React from "react";
import { cn } from "@/lib/utils/cn";

// Inputs use rounded-lg so the multi-line <Textarea> shares the same radius
// without looking like a stretched pill. Buttons keep `rounded-pill` because
// they're the action element and benefit from standing out.
const fieldFocus =
  "focus-visible:outline-none focus-visible:border-portal-blue focus-visible:ring-2 focus-visible:ring-portal-blue focus-visible:ring-offset-2 focus-visible:ring-offset-portal-main";

const inputBase = [
  "flex h-11 w-full rounded-lg border-2 border-portal-border-muted bg-portal-panel-soft",
  "px-4 py-2 text-sm font-ui text-portal-text",
  "placeholder:text-portal-text-soft",
  fieldFocus,
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
      "flex min-h-[88px] w-full rounded-lg border-2 border-portal-border-muted bg-portal-panel-soft",
      "px-4 py-2.5 text-sm font-ui text-portal-text",
      "placeholder:text-portal-text-soft",
      fieldFocus,
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
