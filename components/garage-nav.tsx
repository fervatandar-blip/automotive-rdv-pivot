"use client";

import Link from "next/link";
import { QuickWalkInButton } from "@/components/quick-walk-in-modal";
import { AddClientButton } from "@/components/add-client-modal";
import { BlockTimeButton } from "@/components/block-time-modal";
import { GarageSearch } from "@/components/garage-search";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Clock,
  MessageSquare,
  Wrench,
  Building2,
  FileText,
  Bell,
  User,
  UserCog,
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

type NavLabels = Dictionary["garageNav"];

/**
 * The garage portal menu. Operations is the day-to-day trio; everything
 * you set up once lives under Settings. Pages taken out of the menu
 * (Reviews, Waitlist, and Finance during the pay-on-site pilot, 0040)
 * still work by URL -- the waitlist keeps notifying clients on
 * cancellations regardless.
 */
function navGroups(lang: Locale, isOwner: boolean, t: NavLabels) {
  return [
    {
      label: t.operations,
      items: [
        { href: `/${lang}/garage/dashboard`, label: t.dashboard, icon: LayoutDashboard },
        { href: `/${lang}/garage/calendar`, label: t.calendar, icon: Calendar },
        { href: `/${lang}/garage/clients`, label: t.clients, icon: Users },
      ],
    },
    {
      label: t.communication,
      items: [
        { href: `/${lang}/garage/messages`, label: t.messages, icon: MessageSquare },
        { href: `/${lang}/garage/services`, label: t.services, icon: Wrench },
      ],
    },
    {
      label: t.settings,
      items: [
        { href: `/${lang}/garage/profile`, label: t.profile, icon: Building2 },
        { href: `/${lang}/garage/availability`, label: t.hours, icon: Clock },
        { href: `/${lang}/garage/documents`, label: t.verification, icon: FileText },
        // Owner-only: the staff page gates on requireGarageOwner, so a
        // mecanicien would only hit a redirect.
        ...(isOwner ? [{ href: `/${lang}/garage/staff`, label: t.staff, icon: UserCog }] : []),
        { href: `/${lang}/garage/notifications`, label: t.notifications, icon: Bell },
        { href: `/${lang}/account`, label: t.account, icon: User },
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
  statusLabels,
  actions,
}: {
  lang: Locale;
  garageName: string;
  status: string;
  // Localized approval-status names (garageProfile.status*).
  statusLabels: { approved: string; pending: string; rejected: string };
  // Add client / Block time / Walk-in. Offered from the garage area only
  // (the client-area layout renders this bar without them).
  actions?: {
    walkIn: Dictionary["walkIn"];
    addClient: Dictionary["addClient"];
    blockTime: Dictionary["blockTime"];
    addClientLabel: string;
    blockTimeLabel: string;
    groupLabel: string;
    today: string; // "YYYY-MM-DD" in APP_TIME_ZONE, for the block form
    searchPlaceholder: string;
    searchLabel: string;
  };
}) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-950 sm:px-8">
      <div className="flex min-w-0 shrink items-center gap-3">
        <Link href={`/${lang}/garage/dashboard`} className="shrink-0">
          <AnimatedLogo size={32} />
        </Link>
        <p className="truncate text-base font-semibold text-black dark:text-zinc-50 sm:text-lg">
          {garageName}
        </p>
        <span
          className={`hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium xl:inline ${STATUS_BADGE[status] ?? ""}`}
        >
          {statusLabels[status as keyof typeof statusLabels] ?? status}
        </span>
      </div>
      {actions && (
        <div className="flex flex-1 justify-end md:justify-center md:px-2">
          <GarageSearch
            lang={lang}
            placeholder={actions.searchPlaceholder}
            label={actions.searchLabel}
          />
        </div>
      )}
      {actions && (
        <div className="flex shrink-0 items-center gap-2">
          <div
            role="group"
            aria-label={actions.groupLabel}
            className="flex items-center gap-0.5 rounded-full border border-zinc-200 bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/60"
          >
            <AddClientButton
              lang={lang}
              d={actions.addClient}
              label={actions.addClientLabel}
              variant="ghost"
              collapseLabel
            />
            <BlockTimeButton
              lang={lang}
              d={actions.blockTime}
              label={actions.blockTimeLabel}
              today={actions.today}
              variant="ghost"
              collapseLabel
            />
          </div>
          <QuickWalkInButton lang={lang} d={actions.walkIn} />
        </div>
      )}
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

export function GarageSidebar({
  lang,
  isOwner,
  labels,
}: {
  lang: Locale;
  isOwner: boolean;
  labels: NavLabels;
}) {
  const pathname = usePathname();
  const groups = navGroups(lang, isOwner, labels);

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
          aria-label={collapsed ? labels.expand : labels.collapse}
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
            title={collapsed ? labels.logOut : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[.06] hover:text-zinc-50 ${
              collapsed ? "w-full justify-center" : "w-full"
            }`}
          >
            <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            {!collapsed && labels.logOut}
          </button>
        </form>
      </div>
    </aside>
  );
}
