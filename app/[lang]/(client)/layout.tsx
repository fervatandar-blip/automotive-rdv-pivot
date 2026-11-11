import Link from "next/link";
import { headers } from "next/headers";
import {
  getAuthedProfile,
  getOptionalAuthedProfile,
  getGarageMembership,
} from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ClientSidebar, ClientTabBar } from "@/components/client-nav";
import { ClientPageTitle } from "@/components/client-page-title";
import { GarageSidebar, GarageTopBar } from "@/components/garage-nav";
import { AnimatedLogo } from "@/components/animated-logo";

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
  const { clientNav } = await getDictionary(lang);

  return (
    <div className="flex flex-1">
      <ClientSidebar lang={lang} labels={clientNav} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Push opt-in lives on the Account page; the tab bar replaces the
            old header icon row on phones. */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200/80 bg-white px-4 dark:border-zinc-800/60 dark:bg-zinc-950 md:px-8">
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href={`/${lang}/dashboard`} className="shrink-0 md:hidden">
              <AnimatedLogo size={28} />
            </Link>
            <ClientPageTitle labels={clientNav} />
          </div>
          <Link
            href={`/${lang}/account`}
            aria-label={clientNav.account}
            title={clientNav.account}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white transition-opacity hover:opacity-90 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {initials}
          </Link>
        </header>
        <main className="flex flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </main>
      </div>
      <ClientTabBar lang={lang} labels={clientNav} />
    </div>
  );
}
