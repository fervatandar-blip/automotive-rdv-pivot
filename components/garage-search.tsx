"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Search } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

/**
 * Global client search in the garage top bar. A GET form to the client
 * directory (?q=), which does the actual matching -- name, phone, plate,
 * VIN -- instantly as the user keeps typing there. next/form keeps the
 * submission a client-side navigation and still works without JS.
 * "/" focuses the field from anywhere outside a text input.
 */
export function GarageSearch({
  lang,
  placeholder,
  label,
}: {
  lang: Locale;
  placeholder: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
      ) {
        return;
      }
      // Hidden below md (the icon link takes over), so nothing to focus.
      if (!inputRef.current || inputRef.current.offsetParent === null) return;
      event.preventDefault();
      inputRef.current.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const action = `/${lang}/garage/clients`;

  return (
    <>
      <Form action={action} role="search" className="relative hidden w-full max-w-sm md:block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500"
          strokeWidth={1.75}
        />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder={placeholder}
          aria-label={label}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="h-9 w-full rounded-lg border border-zinc-200/80 bg-zinc-50 pl-10 pr-10 text-sm text-black placeholder:text-zinc-400 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-800/60 dark:bg-zinc-900/40 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-brand-500 dark:focus:bg-zinc-900"
        />
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-zinc-200 px-1.5 font-sans text-[11px] text-zinc-400 lg:block dark:border-zinc-700 dark:text-zinc-500"
        >
          /
        </kbd>
      </Form>
      {/* Phones: no room for a field in the bar; the directory has one. */}
      <Link
        href={action}
        aria-label={label}
        title={label}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-black md:hidden dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <Search className="h-4 w-4" strokeWidth={2} />
      </Link>
    </>
  );
}
