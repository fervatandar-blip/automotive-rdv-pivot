import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

const DEFAULT_SELECT =
  "rounded-md border border-hairline bg-surface px-3 py-2 pr-9 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";

/**
 * Native select with a custom chevron. `className` adds to the default
 * look; `variant="bare"` drops it so the caller styles the box completely
 * (e.g. the compact selects in a toolbar). `wrapperClassName` sizes the
 * wrapper, which is what a flex parent lays out.
 */
export function StyledSelect({
  className = "",
  wrapperClassName = "",
  variant = "default",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  wrapperClassName?: string;
  variant?: "default" | "bare";
}) {
  return (
    <div className={`relative ${wrapperClassName}`}>
      <select
        {...props}
        className={`w-full appearance-none ${variant === "default" ? DEFAULT_SELECT : ""} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
      />
    </div>
  );
}
