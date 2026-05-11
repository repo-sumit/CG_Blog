"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { setViewMode } from "@/app/(app)/actions/viewMode";
import { cn } from "@/lib/utils/cn";

interface Props {
  active: boolean;
  className?: string;
}

/**
 * Toggle between admin/author view and member view. Disabled state during
 * the transition so the toggle can't flap.
 */
export function ViewModeButton({ active, className }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      await setViewMode(!active);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={active ? "Exit view mode" : "View as member"}
      aria-label={active ? "Exit view mode" : "View as member"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-ui text-[11px] uppercase tracking-wider transition-colors",
        active
          ? "border border-portal-yellow/40 bg-portal-yellow/10 text-portal-yellow hover:bg-portal-yellow/15"
          : "border border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted hover:text-portal-text",
        pending && "opacity-60",
        className,
      )}
    >
      {active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      <span className="hidden lg:inline">{active ? "Exit view mode" : "View as member"}</span>
      <span className="lg:hidden">{active ? "Exit" : "View"}</span>
    </button>
  );
}
