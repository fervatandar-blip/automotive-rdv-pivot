"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, type Locale } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/remember-locale";

const LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };
const NAMES: Record<Locale, string> = { fr: "Français", en: "English" };

/** [ FR | EN ] for public pages; keeps the current path. */
export function LanguageSwitcher({ lang, tone = "default" }: { lang: Locale; tone?: "default" | "dark" }) {
  const pathname = usePathname();
  const rest = pathname.split("/").slice(2).join("/");
  const dark = tone === "dark";

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      className={`inline-flex rounded-lg p-0.5 ring-1 ${dark ? "bg-white/10 ring-white/15" : "bg-subtle ring-hairline"}`}
    >
      {locales.map((locale) => {
        const active = locale === lang;
        return (
          <Link
            key={locale}
            href={`/${locale}${rest ? `/${rest}` : ""}`}
            onClick={() => {
              if (!active) rememberLocale(locale);
            }}
            lang={locale}
            aria-label={NAMES[locale]}
            aria-current={active ? "true" : undefined}
            className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
              active
                ? dark
                  ? "bg-white text-zinc-900"
                  : "bg-surface text-ink shadow-sm ring-1 ring-hairline"
                : dark
                  ? "text-white/70 hover:text-white"
                  : "text-ink-muted hover:text-ink"
            }`}
          >
            {LABELS[locale]}
          </Link>
        );
      })}
    </div>
  );
}
