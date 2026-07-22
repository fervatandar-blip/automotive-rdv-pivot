"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Wrench,
  Clock,
  ListPlus,
  UserCog,
  FileText,
  Receipt,
  CreditCard,
  Landmark,
  Building2,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import { AnimatedLogo } from "@/components/animated-logo";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

function primaryItems(lang: Locale) {
  return [
    { href: `/${lang}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${lang}/garage/calendar`, label: "Calendar", icon: Calendar },
    { href: `/${lang}/garage/clients`, label: "Clients", icon: Users },
    { href: `/${lang}/garage/services`, label: "Services", icon: Wrench },
    {
      href: `/${lang}/garage/availability`,
      label: "Availability",
      icon: Clock,
    },
    { href: `/${lang}/garage/waitlist`, label: "Waitlist", icon: ListPlus },
  ];
}

function secondaryItems(lang: Locale) {
  return [
    { href: `/${lang}/garage/staff`, label: "Staff", icon: UserCog },
    { href: `/${lang}/garage/documents`, label: "Documents", icon: FileText },
    { href: `/${lang}/garage/invoices`, label: "Invoices", icon: Receipt },
    { href: `/${lang}/garage/payments`, label: "Payments", icon: CreditCard },
    {
      href: `/${lang}/garage/stripe-connect`,
      label: "Stripe Setup",
      icon: Landmark,
    },
    {
      href: `/${lang}/garage/onboarding`,
      label: "Garage Profile",
      icon: Building2,
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  approved:
    "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  rejected: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export function GarageTopBar({
  lang,
  garageName,
  status,
}: {
  lang: Locale;
  garageName: string;
  status: string;
}) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-black/[.08] bg-white px-6 py-4 dark:border-white/[.145] dark:bg-zinc-950 sm:px-8">
      <div className="flex items-center gap-3">
        <Link href={`/${lang}/dashboard`}>
          <AnimatedLogo size={32} />
        </Link>
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
          {garageName}
        </h1>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_BADGE[status] ?? ""}`}
      >
        {status}
      </span>
    </header>
  );
}

function SidebarLocaleToggle({
  lang,
  pathname,
}: {
  lang: Locale;
  pathname: string;
}) {
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

export function GarageSidebar({ lang }: { lang: Locale }) {
  const pathname = usePathname();
  const primary = primaryItems(lang);
  const secondary = secondaryItems(lang);

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

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {primary.map((item) => {
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

        <span className="mt-6 border-t border-white/[.08] px-3 pb-2 pt-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Business
        </span>
        {secondary.map((item) => {
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
