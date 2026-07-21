"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LayoutDashboard, User, Car, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import { AnimatedLogo } from "@/components/animated-logo";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

function navItems(lang: Locale) {
  return [
    { href: `/${lang}/garages`, label: "Find a Garage", icon: Search },
    { href: `/${lang}/dashboard`, label: "My Dashboard", icon: LayoutDashboard },
    { href: `/${lang}/account`, label: "Account", icon: User },
    { href: `/${lang}/vehicles`, label: "Vehicles", icon: Car },
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
              locale === lang
                ? "text-zinc-50"
                : "text-zinc-500 transition-colors hover:text-zinc-200"
            }
          >
            {LOCALE_LABELS[locale]}
          </Link>
          {index < locales.length - 1 && (
            <span className="text-zinc-700">|</span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ClientSidebar({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const items = navItems(lang);

  return (
    <aside className="hidden w-60 shrink-0 flex-col bg-zinc-950 px-4 py-6 sm:flex">
      <Link
        href={`/${lang}/dashboard`}
        className="mb-8 flex items-center gap-2 px-2"
      >
        <AnimatedLogo size={32} />
        <span className="text-lg font-bold tracking-tight text-zinc-50">
          RDV
        </span>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? "flex items-center gap-3 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white"
                  : "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[.06] hover:text-zinc-50"
              }
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 border-t border-white/[.08] pt-4">
        <SidebarLocaleToggle lang={lang} pathname={pathname} />
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[.06] hover:text-zinc-50"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.5} />
            Log out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function ClientMobileNav({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const items = navItems(lang);

  return (
    <nav className="flex items-center gap-1 sm:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            className={
              active
                ? "flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"
                : "flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]"
            }
          >
            <Icon className="h-5 w-5" strokeWidth={1.5} />
          </Link>
        );
      })}
    </nav>
  );
}
