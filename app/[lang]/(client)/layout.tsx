import Link from "next/link";
import { headers } from "next/headers";
import {
  getAuthedProfile,
  getOptionalAuthedProfile,
  getGarageMembership,
} from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import {
  ClientHeaderControls,
  ClientSidebar,
  ClientTabBar,
  UnreadMessagesWatcher,
} from "@/components/client-nav";
import { createClient } from "@/lib/supabase/server";
import { getClientUnreadCounts, totalUnread } from "@/lib/unread-messages";
import { ClientPageTitle } from "@/components/client-page-title";
import { GarageSidebar, GarageTopBar } from "@/components/garage-nav";
import { BrandMark } from "@/components/brand-mark";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// /garages and /garages/[id] are public discovery/booking pages -- an
// anonymous visitor must be able to reach them (see
// lib/supabase/proxy.ts's protectedRoutes, which deliberately excludes
// "/garages"). Every other route in this group still requires a session,
// enforced below via the unconditional getAuthedProfile call.
function isPublicDiscoveryRoute(pathname: string, lang: string) {
  const withoutLocale = pathname.replace(`/${lang}`, "") || "/";
  return withoutLocale === "/garages" || withoutLocale.startsWith("/garages/");
}

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const profile = isPublicDiscoveryRoute(pathname, lang)
    ? await getOptionalAuthedProfile()
    : await getAuthedProfile(lang);

  if (!profile) {
    // Only reachable for an anonymous visitor on a public discovery route --
    // getAuthedProfile above always redirects rather than returning null.
    return <>{children}</>;
  }

  // This route group also covers /account (role-agnostic, no chrome of its
  // own) plus /garages, /garages/[id] and /vehicles -- a garage owner or
  // mechanic can land on any of these directly (e.g. from the new "Account"
  // sidebar item), and garage layout chrome (components/garage-nav.tsx)
  // lives under app/[lang]/garage/, a sibling folder that layout can't
  // reach. Render the same sidebar/top bar here instead of passing through.
  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    const membership = await getGarageMembership(lang);

    if (membership?.garage.platform_terms_accepted_at) {
      const { garageProfile, garageNav } = await getDictionary(lang);
      return (
        <div className="flex flex-1">
          <GarageSidebar
            lang={lang}
            isOwner={membership.isOwner}
            needsVerification={membership.garage.status !== "approved"}
            labels={garageNav}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <GarageTopBar
              lang={lang}
              garageName={membership.garage.name}
              nav={{
                isOwner: membership.isOwner,
                needsVerification: membership.garage.status !== "approved",
                labels: garageNav,
              }}
              status={membership.garage.status}
              statusLabels={{
                approved: garageProfile.statusApproved,
                pending: garageProfile.statusPending,
                rejected: garageProfile.statusRejected,
              }}
            />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </div>
      );
    }

    // No membership, or not yet onboarded -- nothing to wrap with, same as
    // app/[lang]/garage/layout.tsx's own pre-onboarding passthrough.
    return <>{children}</>;
  }

  if (profile.role !== "client") {
    return <>{children}</>;
  }

  const initials = initialsFor(profile.full_name || profile.email);
  const [{ clientNav }, unreadCounts] = await Promise.all([
    getDictionary(lang),
    getClientUnreadCounts(await createClient()),
  ]);
  const unread = totalUnread(unreadCounts);

  return (
    <div className="flex flex-1 bg-canvas">
      <ClientSidebar
        lang={lang}
        labels={clientNav}
        unread={unread}
        user={{ name: profile.full_name || profile.email, email: profile.email, initials }}
      />
      <UnreadMessagesWatcher userId={profile.id} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phones only: from md the sidebar carries the logo, the user and
            the controls, and pages use the full viewport height. */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-surface px-4 md:hidden">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href={`/${lang}/dashboard`} aria-label="RDV" className="shrink-0">
              <BrandMark size={30} />
            </Link>
            <ClientPageTitle labels={clientNav} />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ClientHeaderControls lang={lang} labels={clientNav} />
            <Link
              href={`/${lang}/account`}
              aria-label={clientNav.account}
              title={clientNav.account}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-surface transition-opacity hover:opacity-90"
            >
              {initials}
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <ClientTabBar lang={lang} labels={clientNav} unread={unread} />
    </div>
  );
}
