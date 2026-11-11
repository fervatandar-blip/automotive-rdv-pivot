"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LayoutDashboard, User, Car, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { AnimatedLogo } from "@/components/animated-logo";

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

function SidebarLocaleToggle({ lang, pathname }: { lang: Locale; pathname: string }) {
  const rest = pathname.split("/").slice(2).join("/");

  return (
    <div className="flex items-center gap-2 px-3 text-sm font-medium">
      {locales.map((locale, index) => (
        <span key={locale} className="flex items-center gap-2">
          <Link
            href={`/${locale}${rest ? `/${rest}` : ""}`}
            className={
              locale === lang ? "text-zinc-50" : "text-zinc-500 transition-colors hover:text-zinc-200"
            }
          >
            {LOCALE_LABELS[locale]}
          </Link>
          {index < locales.length - 1 && <span className="text-zinc-700">|</span>}
        </span>
      ))}
    </div>
  );
}

const NAV_ITEM_BASE =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600";
const NAV_ITEM_ACTIVE = "bg-zinc-800/60 font-medium text-white";
const NAV_ITEM_IDLE = "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100";

/** Desktop (md and up): same look as the garage portal's sidebar. */
export function ClientSidebar({ lang, labels }: { lang: Locale; labels: ClientNavLabels }) {
  const pathname = usePathname();
  const items = navItems(lang, labels);

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-zinc-950 px-4 py-6 md:flex">
      <Link href={`/${lang}/dashboard`} className="mb-8 flex items-center gap-2 px-2">
        <AnimatedLogo size={32} />
        <span className="text-lg font-bold tracking-tight text-zinc-50">RDV</span>
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

      <div className="flex flex-col gap-3 border-t border-zinc-800/60 pt-4">
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button type="submit" className={`${NAV_ITEM_BASE} ${NAV_ITEM_IDLE} w-full`}>
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {labels.logOut}
          </button>
        </form>
        <SidebarLocaleToggle lang={lang} pathname={pathname} />
      </div>
    </aside>
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
