"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, LayoutDashboard, User, Car, LogOut, MessageSquare, CalendarDays } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logout } from "@/app/actions/auth";
import { locales, type Locale } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/remember-locale";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { BrandLogo } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";

const LOCALE_LABELS: Record<Locale, string> = { fr: "FR", en: "EN" };

export type ClientNavLabels = Dictionary["clientNav"];

/**
 * The client area's six destinations. `label` is the sidebar wording;
 * `short` fits the phone tab bar, which holds the first five (~75px each):
 * on phones Account is the avatar in the top bar. Only Messages carries a
 * count.
 */
function navItems(lang: Locale, t: ClientNavLabels, unread: number) {
  return [
    { href: `/${lang}/dashboard`, label: t.dashboard, short: t.dashboardShort, icon: LayoutDashboard, unread: 0 },
    { href: `/${lang}/appointments`, label: t.appointments, short: t.appointmentsShort, icon: CalendarDays, unread: 0 },
    { href: `/${lang}/garages`, label: t.findGarage, short: t.findGarageShort, icon: Search, unread: 0 },
    { href: `/${lang}/messages`, label: t.messages, short: t.messages, icon: MessageSquare, unread },
    { href: `/${lang}/vehicles`, label: t.vehicles, short: t.vehiclesShort, icon: Car, unread: 0 },
    { href: `/${lang}/account`, label: t.account, short: t.account, icon: User, unread: 0 },
  ];
}

const TAB_BAR_ITEMS = 5;

function unreadLabel(labels: ClientNavLabels, count: number) {
  return labels.unreadMessages.replace("{count}", String(count));
}

/**
 * Re-renders the layout (and its unread badge) when a workshop replies in
 * any of the client's threads. Realtime applies the messages RLS, so only
 * the client's own threads arrive; their own sends are ignored.
 */
export function UnreadMessagesWatcher({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    // Same JWT-before-subscribe dance as components/chat-thread.tsx.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      if (session) supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`unread:${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
          if ((payload.new as { sender_id?: string }).sender_id !== userId) router.refresh();
        })
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
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
      className="flex rounded-lg bg-subtle p-0.5 ring-1 ring-hairline"
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
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors ${
              active ? "bg-surface text-ink shadow-sm ring-1 ring-hairline" : "text-ink-muted hover:text-ink"
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
  "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30";
const NAV_ITEM_ACTIVE = "bg-subtle font-semibold text-ink";
const NAV_ITEM_IDLE = "text-ink-muted hover:bg-subtle/70 hover:text-ink";

/**
 * Desktop (md and up): a fixed 240px rail, full viewport height. Pages fit
 * the viewport next to it, so there is no top bar: the signed-in user,
 * theme, language and logout sit in its footer.
 */
export function ClientSidebar({
  lang,
  labels,
  unread,
  user,
}: {
  lang: Locale;
  labels: ClientNavLabels;
  unread: number;
  user: { name: string; email: string; initials: string };
}) {
  const pathname = usePathname();
  const items = navItems(lang, labels, unread);

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-hairline bg-surface px-3 py-5 md:flex">
      <Link href={`/${lang}/dashboard`} aria-label="RDV" className="mb-8 flex items-center px-3 pt-1">
        <BrandLogo size={34} />
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
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-ink" : ""}`} strokeWidth={active ? 2 : 1.75} />
              <span className="flex-1">{item.label}</span>
              {item.unread > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-ink px-1.5 font-mono text-[11px] font-semibold text-surface">
                  <span aria-hidden>{item.unread > 99 ? "99+" : item.unread}</span>
                  <span className="sr-only">{unreadLabel(labels, item.unread)}</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mb-3 flex items-center justify-between gap-2 px-1">
        <ThemeToggle labels={themeLabels(labels)} tone="adaptive" />
        <LocaleSwitch lang={lang} labels={labels} />
      </div>

      <div className="flex items-center gap-2 border-t border-hairline px-1 pt-3">
        <Link
          href={`/${lang}/account`}
          title={labels.accountSettings}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-subtle/60"
        >
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-surface"
          >
            {user.initials}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-ink">{user.name}</span>
            <span className="truncate text-xs text-ink-muted">{user.email}</span>
          </span>
        </Link>
        <form action={logout}>
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            aria-label={labels.logOut}
            title={labels.logOut}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40"
          >
            <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.75} />
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
export function ClientTabBar({
  lang,
  labels,
  unread,
}: {
  lang: Locale;
  labels: ClientNavLabels;
  unread: number;
}) {
  const pathname = usePathname();
  const items = navItems(lang, labels, unread).slice(0, TAB_BAR_ITEMS);

  return (
    <nav
      aria-label={labels.mainNav}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                <span className="relative">
                  <Icon aria-hidden className="h-5 w-5" strokeWidth={active ? 2 : 1.75} />
                  {item.unread > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-brand-600 ring-2 ring-surface"
                    />
                  )}
                </span>
                <span className="max-w-full truncate px-1">{item.short}</span>
                {item.unread > 0 && <span className="sr-only">{unreadLabel(labels, item.unread)}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
