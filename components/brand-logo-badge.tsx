import { siAudi, siBmw, siRenault, siTesla, siVolkswagen } from "simple-icons";

const ICONS: Record<string, { path: string; hex: string }> = {
  volkswagen: siVolkswagen,
  audi: siAudi,
  bmw: siBmw,
  tesla: siTesla,
  renault: siRenault,
};

export function BrandLogoBadge({
  htmlFor,
  slug,
  name,
  selected,
}: {
  htmlFor: string;
  slug: string;
  name: string;
  selected: boolean;
}) {
  const icon = ICONS[slug];

  return (
    <label
      htmlFor={htmlFor}
      className={
        selected
          ? "flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-brand-600 bg-brand-50 p-3 text-center ring-2 ring-brand-600/20 dark:border-brand-500 dark:bg-brand-950"
          : "flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-black/[.08] bg-white p-3 text-center transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
      }
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          className="h-9 w-9"
          fill={`#${icon.hex}`}
          aria-hidden
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[.04] text-xs font-semibold text-zinc-600 dark:bg-white/[.06] dark:text-zinc-300">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span
        className={
          selected
            ? "text-xs font-medium text-brand-700 dark:text-brand-400"
            : "text-xs font-medium text-zinc-700 dark:text-zinc-300"
        }
      >
        {name}
      </span>
    </label>
  );
}
