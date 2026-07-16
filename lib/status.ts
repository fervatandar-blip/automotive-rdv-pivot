// Status colors from the dataviz skill's fixed status palette (good/warning/
// critical). "Completed" isn't a severity signal, so it gets a neutral muted
// treatment instead of borrowing one of the three reserved hues.
export const STATUS_STYLES: Record<
  string,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  confirmed: {
    label: "Confirmed",
    dot: "#0ca30c",
    text: "text-green-800 dark:text-green-400",
    bg: "bg-green-50 dark:bg-green-950",
    border: "border-green-200 dark:border-green-900",
  },
  pending: {
    label: "Pending",
    dot: "#fab219",
    text: "text-amber-800 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950",
    border: "border-amber-200 dark:border-amber-900",
  },
  cancelled: {
    label: "Cancelled",
    dot: "#d03b3b",
    text: "text-red-800 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950",
    border: "border-red-200 dark:border-red-900",
  },
  completed: {
    label: "Completed",
    dot: "#898781",
    text: "text-zinc-600 dark:text-zinc-400",
    bg: "bg-zinc-100 dark:bg-zinc-900",
    border: "border-zinc-200 dark:border-zinc-800",
  },
};

export const DEFAULT_STATUS_STYLE = STATUS_STYLES.pending;
