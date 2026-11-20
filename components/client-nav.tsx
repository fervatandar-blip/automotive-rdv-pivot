"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LayoutDashboard, User, Car, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/remember-locale";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { AnimatedLogo } from "@/components/animated-logo";
import { ThemeToggle } from "@/components/theme-toggle";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

export type ClientNavLabels = Dictionary["clientNav"];

/**
 * The client area's four destinations. `label` is the sidebar wording;
 * `short` fits the phone tab bar (four tabs at ~90px each).
 */
function navItems(lang: Locale, t: ClientNavLabels) {
  return [
    { href: `/${lang}/dashboard`, label: t.dashboard, short: t.dashboardShort, icon: LayoutDashboard },
    { href: `/${lang}/garages`, label: t.findGarage, short: t.findGarageShort, icon: Search },
    { href: `/${lang}/vehicles`, label: t.vehicles, short: t.vehicles, icon: Car },
    { href: `/${lang}/account`, label: t.account, short: t.account, icon: User },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** The current page in another language (keeps the path after the locale). */
function localeHref(pathname: string, locale: Locale) {
  const rest = pathname.split("/").slice(2).join("/");
  return `/${locale}${rest ? `/${rest}` : ""}`;
}

function themeLabels(labels: ClientNavLabels) {
  return {
    light: labels.themeLight,
    dark: labels.themeDark,
    switchToLight: labels.switchToLight,
    switchToDark: labels.switchToDark,
  };
}

/**
 * [ FR | EN ] segmented control. rememberLocale records the choice for
 * unprefixed URLs and for the language of the user's notifications.
 */
export function LocaleSwitch({ lang, labels }: { lang: Locale; labels: Pick<ClientNavLabels, "language"> }) {
  const pathname = usePathname();

  return (
    <div
      role="group"
      aria-label={labels.language}
      className="flex rounded-full bg-zinc-200/60 p-0.5 ring-1 ring-zinc-200 dark:bg-zinc-900 dark:ring-zinc-800"
    >
      {locales.map((locale) => {
        const active = locale === lang;
        return (
          <Link
            key={locale}
            href={localeHref(pathname, locale)}
            onClick={() => {
              if (!active) rememberLocale(locale);
            }}
            aria-current={active ? "true" : undefined}
            lang={locale}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide transition-colors ${
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            }`}
          >
            {LOCALE_LABELS[locale]}
          </Link>
        );
      })}
    </div>
  );
}

const NAV_ITEM_BASE =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:focus-visible:ring-zinc-600";
const NAV_ITEM_ACTIVE =
  "bg-white font-medium text-zinc-900 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800/60 dark:text-white dark:shadow-none dark:ring-0";
const NAV_ITEM_IDLE =
  "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/40 dark:hover:text-zinc-100";

/**
 * Desktop (md and up). Follows the theme: light zinc panel in light mode,
 * the garage portal's near-black panel in dark mode.
 */
export function ClientSidebar({ lang, labels }: { lang: Locale; labels: ClientNavLabels }) {
  const pathname = usePathname();
  const items = navItems(lang, labels);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 px-4 py-6 text-zinc-700 md:flex dark:border-zinc-800/60 dark:bg-zinc-950 dark:text-zinc-400">
      <Link href={`/${lang}/dashboard`} className="mb-8 flex items-center gap-2 px-2">
        <AnimatedLogo size={32} />
        <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-50">RDV</span>
      </Link>

      <nav aria-label={labels.mainNav} className="flex flex-1 flex-col gap-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`${NAV_ITEM_BASE} ${active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE}`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <ThemeToggle labels={themeLabels(labels)} tone="adaptive" />
        <LocaleSwitch lang={lang} labels={labels} />
      </div>

      <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800/60">
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className={`${NAV_ITEM_BASE} ${NAV_ITEM_IDLE} w-full`}>
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {labels.logOut}
          </button>
        </form>
      </div>
    </aside>
  );
}

/**
 * Phones (below md) have no sidebar, so theme and language sit in the top
 * bar next to the account avatar.
 */
export function ClientHeaderControls({ lang, labels }: { lang: Locale; labels: ClientNavLabels }) {
  return (
    <div className="flex items-center gap-1.5 md:hidden">
      <ThemeToggle labels={themeLabels(labels)} tone="adaptive" collapsed />
      <LocaleSwitch lang={lang} labels={labels} />
    </div>
  );
}

/**
 * Phones (below md): a fixed bottom tab bar -- the thumb-reachable pattern
 * clients know from every booking app. Honors the iOS home-indicator inset;
 * the layout pads <main> by the same height so nothing hides behind it.
 */
export function ClientTabBar({ lang, labels }: { lang: Locale; labels: ClientNavLabels }) {
  const pathname = usePathname();
  const items = navItems(lang, labels);

  return (
    <nav
      aria-label={labels.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-zinc-800/60 dark:bg-zinc-950/95"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                <span className="max-w-full truncate px-1">{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
