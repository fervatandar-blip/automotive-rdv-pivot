"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";

const LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

export function LanguageSwitcher({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <div className="flex items-center gap-1 text-sm font-medium">
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-1">
          <Link
            href={`/${locale}${rest ? `/${rest}` : ""}`}
            className={
              locale === lang
                ? "text-black dark:text-zinc-50"
                : "text-zinc-400 transition-colors hover:text-black dark:text-zinc-600 dark:hover:text-zinc-50"
            }
          >
            {LABELS[locale]}
          </Link>
          {index < locales.length - 1 && (
            <span className="text-zinc-300 dark:text-zinc-700">/</span>
          )}
        </span>
      ))}
    </div>
  );
}
