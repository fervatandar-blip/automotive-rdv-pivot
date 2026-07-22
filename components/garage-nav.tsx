"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Star,
  Clock,
  ListPlus,
  MessageSquare,
  Wrench,
  Receipt,
  Landmark,
  Building2,
  FileText,
  User,
  PanelLeft,
  PanelLeftClose,
  LogOut,
} from "lucide-react";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import { AnimatedLogo } from "@/components/animated-logo";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };
const COLLAPSE_STORAGE_KEY = "garage-sidebar-collapsed";

// Tiny external store for the collapsed preference: localStorage has no
// native change event, so writes notify subscribers directly rather than
// going through an effect (avoids the "setState in effect" cascading-render
// footgun -- same "safe default, resolve after mount" shape as
// components/push-notification-opt-in.tsx's useSyncExternalStore usage).
type Listener = () => void;
let collapseListeners: Listener[] = [];

function subscribeCollapsed(callback: Listener) {
  collapseListeners.push(callback);
  return () => {
    collapseListeners = collapseListeners.filter((listener) => listener !== callback);
  };
}

function getCollapsedSnapshot() {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}

function getCollapsedServerSnapshot() {
  return false;
}

function setCollapsed(value: boolean) {
  window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(value));
  for (const listener of collapseListeners) listener();
}

function navGroups(lang: Locale) {
  return [
    {
      label: "Operations",
      items: [
        { href: `/${lang}/garage/dashboard`, label: "Dashboard", icon: LayoutDashboard },
        { href: `/${lang}/garage/calendar`, label: "Calendar & Agenda", icon: Calendar },
        { href: `/${lang}/garage/clients`, label: "Client Directory", icon: Users },
        { href: `/${lang}/garage/reviews`, label: "Reviews", icon: Star },
        { href: `/${lang}/garage/availability`, label: "Availability", icon: Clock },
        { href: `/${lang}/garage/waitlist`, label: "Waitlist", icon: ListPlus },
      ],
    },
    {
      label: "Communication & Services",
      items: [
        { href: `/${lang}/garage/messages`, label: "Messages", icon: MessageSquare },
        { href: `/${lang}/garage/services`, label: "Services & Pricing", icon: Wrench },
      ],
    },
    {
      label: "Finance",
      items: [
        { href: `/${lang}/garage/invoices`, label: "Invoices & Financials", icon: Receipt },
        { href: `/${lang}/garage/stripe-connect`, label: "Stripe Setup", icon: Landmark },
      ],
    },
    {
      label: "Settings & Compliance",
      items: [
        { href: `/${lang}/garage/onboarding`, label: "Garage Profile", icon: Building2 },
        { href: `/${lang}/garage/documents`, label: "Verification & KYC", icon: FileText },
        { href: `/${lang}/account`, label: "Account Settings", icon: User },
      ],
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
        <Link href={`/${lang}/garage/dashboard`}>
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
  const groups = navGroups(lang);

  // Server always renders expanded; the real preference (if any) is only
  // known client-side, so it's resolved after mount to avoid a hydration
  // mismatch -- same "safe default, resolve after mount" shape already used
  // by components/push-notification-opt-in.tsx's useSyncExternalStore.
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getCollapsedServerSnapshot
  );

  function toggleCollapsed() {
    setCollapsed(!collapsed);
  }

  return (
    <aside
      className={`hidden shrink-0 flex-col bg-zinc-950 py-6 transition-[width] duration-150 sm:flex ${
        collapsed ? "w-16 px-2" : "w-60 px-4"
      }`}
    >
      <div
        className={
          collapsed
            ? "mb-8 flex flex-col items-center gap-2"
            : "mb-8 flex items-center justify-between gap-2 px-2"
        }
      >
        <Link
          href={`/${lang}/garage/dashboard`}
          className="flex items-center gap-2"
        >
          <AnimatedLogo size={32} />
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight text-zinc-50">
              RDV
            </span>
          )}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/[.06] hover:text-zinc-50"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {groups.map((group, groupIndex) => (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && (
              <span
                className={
                  groupIndex === 0
                    ? "px-3 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500"
                    : "mt-6 border-t border-white/[.08] px-3 pb-2 pt-4 text-xs font-medium uppercase tracking-wide text-zinc-500"
                }
              >
                {group.label}
              </span>
            )}
            {collapsed && groupIndex > 0 && (
              <div className="mx-2 my-2 border-t border-white/[.08]" />
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={
                    active
                      ? `flex items-center gap-3 rounded-lg bg-brand-600 px-3 py-2.5 text-sm font-medium text-white ${collapsed ? "justify-center" : ""}`
                      : `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[.06] hover:text-zinc-50 ${collapsed ? "justify-center" : ""}`
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
                  {!collapsed && item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-3 border-t border-white/[.08] pt-4">
        {!collapsed && <SidebarLocaleToggle lang={lang} pathname={pathname} />}
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            title={collapsed ? "Log out" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[.06] hover:text-zinc-50 ${
              collapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            {!collapsed && "Log out"}
          </button>
        </form>
      </div>
    </aside>
  );
}
