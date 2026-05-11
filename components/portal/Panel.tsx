import { cn } from "@/lib/utils/cn";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "raised" | "bright" | "soft";
  pattern?: "grid" | "none";
}

/**
 * Outlined dark surface — the building block of every section in the design.
 * Variants:
 *  - default  : standard panel
 *  - raised   : slightly lifted background (cards inside cards)
 *  - bright   : warm off-white border (used for featured / hero blocks)
 *  - soft     : darkest surface (used for inputs, sub-sections)
 */
export function Panel({ variant = "default", pattern = "none", className, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        variant === "bright" && "portal-panel-bright",
        variant === "raised" && "portal-panel-raised",
        variant === "default" && "portal-panel",
        variant === "soft" && "rounded-panel border-2 border-portal-border-soft bg-portal-panel-soft shadow-portal",
        pattern === "grid" && "grid-overlay-sm",
        className,
      )}
      {...rest}
    />
  );
}

export function PanelHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b-2 border-portal-border-soft px-6 py-4",
        className,
      )}
      {...rest}
    />
  );
}

export function PanelBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...rest} />;
}
