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
      className="inline-flex h-10 cursor-pointer select-none items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-subtle hover:text-ink has-[:checked]:bg-subtle has-[:checked]:text-ink has-[:checked]:ring-1 has-[:checked]:ring-inset has-[:checked]:ring-hairline has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30 [&:has(:checked)>svg]:block"
    >
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="sr-only" />
      <Check aria-hidden className="hidden h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      {/* Screen readers get the full wording instead of the abbreviation. */}
      <span aria-hidden={title ? true : undefined}>{label}</span>
      {title && <span className="sr-only">{title}</span>}
    </label>
  );
}
