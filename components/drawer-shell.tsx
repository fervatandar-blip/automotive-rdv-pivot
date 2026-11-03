"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Frame for the appointment detail panel. The panel itself is server-
 * rendered from ?appt= (so it survives refreshes and its forms are plain
 * server actions); this adds what needs the browser: Esc closes, focus moves
 * into the panel on open, and the page behind doesn't scroll.
 */
export function DrawerShell({
  closeHref,
  closeLabel,
  title,
  children,
}: {
  closeHref: string;
  closeLabel: string;
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") router.replace(closeHref, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeHref, router]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <Link
        href={closeHref}
        scroll={false}
        aria-label={closeLabel}
        tabIndex={-1}
        className="absolute inset-0 bg-black/30 backdrop-blur-[1px] dark:bg-black/60"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl outline-none dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="truncate text-base font-semibold text-black dark:text-zinc-50">{title}</h2>
          <Link
            href={closeHref}
            scroll={false}
            aria-label={closeLabel}
            className="rounded-full p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
