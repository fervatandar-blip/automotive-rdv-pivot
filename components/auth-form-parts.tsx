import type { ReactNode } from "react";

// Building blocks for the auth forms (login, signup, password pages), so
// they look and behave the same everywhere.

export const AUTH_INPUT =
  "h-11 w-full rounded-xl border border-hairline bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-muted/70 transition-colors focus:border-ink/40 focus:outline-none focus:ring-4 focus:ring-ink/[.06] aria-[invalid=true]:border-red-400 aria-[invalid=true]:focus:ring-red-500/10";

export const AUTH_SUBMIT =
  "inline-flex h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-[15px] font-semibold text-surface transition-colors hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-wait disabled:opacity-60";

export const AUTH_LINK = "font-semibold text-ink underline decoration-hairline underline-offset-4 transition-colors hover:decoration-current";

export function AuthHeading({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-display text-[1.75rem] font-bold leading-tight tracking-[-0.02em] text-ink">{title}</h1>
      {description && <p className="text-[15px] text-ink-muted">{description}</p>}
    </div>
  );
}

export function AuthField({
  id,
  label,
  errors,
  aside,
  children,
}: {
  id: string;
  label: string;
  errors?: string[];
  // Right of the label (e.g. "Forgot password?").
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {errors && errors.length > 0 && (
        <ul id={`${id}-error`} className="flex flex-col gap-0.5 text-sm text-red-600 dark:text-red-400">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AuthNotice({ tone, children }: { tone: "error" | "success"; children: ReactNode }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-3.5 py-2.5 text-sm ${
        tone === "error"
          ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
      }`}
    >
      {children}
    </p>
  );
}

/** Secondary routes under the form, separated by a hairline. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2 border-t border-hairline pt-5 text-sm text-ink-muted">{children}</div>;
}
