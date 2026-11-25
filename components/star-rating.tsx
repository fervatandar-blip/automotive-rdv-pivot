import { Star } from "lucide-react";

/**
 * Five stars, the first `rating` filled. Decorative: the label says the
 * value in words for screen readers (and as a tooltip).
 */
export function StarRating({
  rating,
  label,
  size = "sm",
}: {
  rating: number;
  /** e.g. "4 out of 5" */
  label: string;
  size?: "sm" | "md";
}) {
  const rounded = Math.max(0, Math.min(5, Math.round(rating)));
  const box = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((index) => (
        <Star
          key={index}
          aria-hidden
          strokeWidth={1.5}
          className={`${box} ${
            index < rounded ? "fill-amber-400 text-amber-400" : "fill-transparent text-zinc-300 dark:text-zinc-600"
          }`}
        />
      ))}
    </span>
  );
}

/** Amber "★ 4.6 (12)" pill with a real icon, or nothing without reviews. */
export function RatingPill({ average, count, label }: { average: number; count: number; label: string }) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <Star aria-hidden className="h-3.5 w-3.5 fill-amber-400 text-amber-400" strokeWidth={1.5} />
      <span aria-hidden>
        {average.toFixed(1)}
        <span className="font-medium opacity-75"> ({count})</span>
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
