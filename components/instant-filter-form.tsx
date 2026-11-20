"use client";

import { useEffect, useRef, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

const TYPING_DELAY_MS = 300;

/**
 * A GET filter form that applies itself: selects and checkboxes update the
 * URL on change, text fields after a short typing pause. The server page
 * re-renders the results from the new search params. Without JavaScript it
 * still works as a plain GET form (Enter submits).
 *
 * Inputs stay uncontrolled, so a re-render never steals focus or the caret
 * while someone types. Reset clears them by hand for the same reason.
 */
export function InstantFilterForm({
  children,
  className,
  resetLabel,
  showReset,
  keepOnReset = [],
}: {
  children: ReactNode;
  className?: string;
  resetLabel: string;
  showReset: boolean;
  /** Params a reset keeps (e.g. the vehicle being booked for). */
  keepOnReset?: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function navigate(params: URLSearchParams) {
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    });
  }

  function apply() {
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") params.set(key, value.trim());
    }
    navigate(params);
  }

  function schedule(delay: number) {
    if (timer.current) clearTimeout(timer.current);
    if (delay === 0) apply();
    else timer.current = setTimeout(apply, delay);
  }

  function reset() {
    const form = formRef.current;
    if (!form) return;
    if (timer.current) clearTimeout(timer.current);
    const params = new URLSearchParams();
    for (const element of Array.from(form.elements)) {
      if (element instanceof HTMLInputElement) {
        if (element.type === "hidden") {
          if (keepOnReset.includes(element.name) && element.value) params.set(element.name, element.value);
        } else if (element.type === "checkbox") {
          element.checked = false;
        } else {
          element.value = "";
        }
      } else if (element instanceof HTMLSelectElement) {
        element.selectedIndex = 0;
      }
    }
    navigate(params);
  }

  return (
    <form
      ref={formRef}
      method="GET"
      aria-busy={pending}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        schedule(0);
      }}
      onChange={(event) => {
        const target = event.target;
        const typing =
          target instanceof HTMLInputElement && (target.type === "text" || target.type === "search");
        schedule(typing ? TYPING_DELAY_MS : 0);
      }}
    >
      {children}
      {showReset && (
        <button
          type="button"
          onClick={reset}
          className="self-start text-sm font-medium text-zinc-500 underline-offset-2 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {resetLabel}
        </button>
      )}
    </form>
  );
}
