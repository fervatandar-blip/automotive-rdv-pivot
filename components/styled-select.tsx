import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function StyledSelect({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className={`w-full appearance-none rounded-md border border-black/[.08] bg-white px-3 py-2 pr-9 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-white/[.145] dark:bg-black ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
      />
    </div>
  );
}
