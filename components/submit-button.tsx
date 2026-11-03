"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button that disables itself while its form's server action is
 * running, so a double click can't send the same booking twice. Must be
 * rendered inside the <form> it submits.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
}: {
  children: ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className={`${className ?? ""} disabled:cursor-wait disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
