import { Check } from "lucide-react";

export function CheckboxChip({
  id,
  name,
  value = "on",
  label,
  defaultChecked,
}: {
  id?: string;
  name: string;
  value?: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-black/[.08] transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40 peer-focus-visible:ring-offset-2 dark:border-white/[.145] [&>svg]:opacity-0 [&>svg]:transition-opacity peer-checked:[&>svg]:opacity-100">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}
