import { Check } from "lucide-react";

/**
 * A checkbox drawn as a compact on/off pill, for toolbars. The native input
 * stays in the label (visually hidden), so it still submits with the form,
 * toggles with Space and shows a focus ring via has-[:focus-visible].
 * `title` carries the long wording when `label` is an abbreviation.
 */
export function TogglePill({
  name,
  value = "1",
  label,
  title,
  defaultChecked,
}: {
  name: string;
  value?: string;
  label: string;
  title?: string;
  defaultChecked: boolean;
}) {
  return (
    <label
      title={title}
      className="inline-flex h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/40 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50 dark:has-[:checked]:bg-brand-500/15 dark:has-[:checked]:text-brand-400 [&:has(:checked)>svg]:block"
    >
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      <Check aria-hidden className="hidden h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      {/* Screen readers get the full wording instead of the abbreviation. */}
      <span aria-hidden={title ? true : undefined}>{label}</span>
      {title && <span className="sr-only">{title}</span>}
    </label>
  );
}
