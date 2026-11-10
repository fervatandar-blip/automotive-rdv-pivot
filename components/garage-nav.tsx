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
 * The garage portal menu: three groups, nothing else. Pages taken out of
 * the menu (Reviews, Waitlist, and Finance during the pay-on-site pilot,
 * 0040) still work by URL -- the waitlist keeps notifying clients on
 * cancellations regardless. Verification is listed only while the garage
 * is not yet approved: it's a one-time onboarding step, but an unapproved
 * garage must still be able to reach it. Notifications and Account live in
 * the sidebar footer (personal settings, not garage settings).
 */
function navGroups(
  lang: Locale,
  { isOwner, needsVerification }: { isOwner: boolean; needsVerification: boolean },
  t: NavLabels
) {
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
      label: t.servicesGroup,
      items: [
        { href: `/${lang}/garage/services`, label: t.services, icon: Wrench },
        { href: `/${lang}/garage/messages`, label: t.messages, icon: MessageSquare },
      ],
    },
    {
      label: t.settings,
      items: [
        { href: `/${lang}/garage/profile`, label: t.profile, icon: Building2 },
        { href: `/${lang}/garage/availability`, label: t.hours, icon: Clock },
        // Owner-only: the staff page gates on requireGarageOwner, so a
        // mecanicien would only hit a redirect.
        ...(isOwner ? [{ href: `/${lang}/garage/staff`, label: t.staff, icon: UserCog }] : []),
        ...(needsVerification && isOwner
          ? [{ href: `/${lang}/garage/documents`, label: t.verification, icon: FileText }]
          : []),
      ],
    },
  ];
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const NAV_ITEM_BASE =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600";
const NAV_ITEM_ACTIVE = "bg-zinc-800/60 font-medium text-white";
const NAV_ITEM_IDLE = "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-100";

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`${NAV_ITEM_BASE} ${active ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE} ${
        collapsed ? "justify-center" : ""
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
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
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white px-4 dark:border-zinc-800/60 dark:bg-zinc-950 sm:px-6">
      <div className="flex min-w-0 shrink items-center gap-2.5">
        {/* The sidebar carries the logo from sm up; phones have no sidebar. */}
        <Link href={`/${lang}/garage/dashboard`} className="shrink-0 sm:hidden">
          <AnimatedLogo size={28} />
        </Link>
        <p className="truncate text-sm font-semibold text-black dark:text-zinc-50">{garageName}</p>
        {status !== "approved" && (
          <span
            className={`hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium lg:inline ${STATUS_BADGE[status] ?? ""}`}
          >
            {statusLabels[status as keyof typeof statusLabels] ?? status}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex flex-1 justify-end md:justify-center md:px-4">
          <GarageSearch
            lang={lang}
            placeholder={actions.searchPlaceholder}
            label={actions.searchLabel}
          />
        </div>
      )}
      {actions && (
        <div className="flex shrink-0 items-center gap-1">
          <div role="group" aria-label={actions.groupLabel} className="flex items-center gap-0.5">
            <AddClientButton
              lang={lang}
              d={actions.addClient}
              label={actions.addClientLabel}
              variant="icon"
            />
            <BlockTimeButton
              lang={lang}
              d={actions.blockTime}
              label={actions.blockTimeLabel}
              today={actions.today}
              variant="icon"
            />
          </div>
          <span aria-hidden className="mx-1.5 h-5 w-px bg-zinc-200 dark:bg-zinc-800" />
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
  needsVerification,
  labels,
}: {
  lang: Locale;
  isOwner: boolean;
  // Garage not approved yet: keep the verification page in the menu.
  needsVerification: boolean;
  labels: NavLabels;
}) {
  const pathname = usePathname();
  const groups = navGroups(lang, { isOwner, needsVerification }, labels);
  const footerLinks = [
    { href: `/${lang}/garage/notifications`, label: labels.notifications, icon: Bell },
    { href: `/${lang}/account`, label: labels.account, icon: User },
  ];

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
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800/40 hover:text-zinc-100"
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <span className="sr-only">{group.label}</span>
            ) : (
              <span className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {group.label}
              </span>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                active={isActive(pathname, item.href)}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-zinc-800/60 pt-4">
        {footerLinks.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={isActive(pathname, item.href)}
            collapsed={collapsed}
          />
        ))}
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            title={collapsed ? labels.logOut : undefined}
            className={`${NAV_ITEM_BASE} ${NAV_ITEM_IDLE} w-full ${collapsed ? "justify-center" : ""}`}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
            {!collapsed && labels.logOut}
          </button>
        </form>
        {!collapsed && (
          <div className="mt-3">
            <SidebarLocaleToggle lang={lang} pathname={pathname} />
          </div>
        )}
      </div>
    </aside>
  );
}
