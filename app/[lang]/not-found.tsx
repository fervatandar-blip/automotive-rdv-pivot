"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale } from "@/lib/i18n/config";
import enDictionary from "@/lib/i18n/dictionaries/en.json";
import frDictionary from "@/lib/i18n/dictionaries/fr.json";

function useNotFoundDictionary() {
  const pathname = usePathname();
  const segment = pathname.split("/")[1] ?? "";
  const lang = isLocale(segment) ? segment : defaultLocale;
  return (lang === "fr" ? frDictionary : enDictionary).notFoundPage;
}

export default function NotFound() {
  const d = useNotFoundDictionary();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {d.title}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {d.description}
        </p>
        <Link
          href="/"
          className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          {d.backToHome}
        </Link>
      </div>
    </div>
  );
}
