import Link from "next/link";
import { Car } from "lucide-react";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { ClientSidebar, ClientMobileNav } from "@/components/client-nav";
import { ClientPageTitle } from "@/components/client-page-title";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { GarageSidebar, GarageTopBar } from "@/components/garage-nav";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
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
  const profile = await getAuthedProfile(lang);

  // /dashboard lives in this route group regardless of role, but garage
  // layout chrome (components/garage-nav.tsx) lives under app/[lang]/garage/
  // -- a sibling folder that layout can't reach. Rendering it here too is
  // what gives admin_garage/mecanicien identical chrome on /dashboard as on
  // every /garage/* page, instead of only after their first click into one.
  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    const membership = await getGarageMembership(lang);

    if (membership?.garage.platform_terms_accepted_at) {
      return (
        <div className="flex flex-1">
          <GarageSidebar lang={lang} />
          <div className="flex flex-1 flex-col">
            <GarageTopBar
              lang={lang}
              garageName={membership.garage.name}
              status={membership.garage.status}
            />
            <main className="flex flex-1 flex-col">{children}</main>
          </div>
        </div>
      );
    }

    // No membership, or not yet onboarded -- /dashboard's own admin_garage
    // branch already redirects the not-onboarded case to
    // /garage/onboarding, which the garage layout itself renders the
    // minimal pre-onboarding header for. Nothing to add here.
    return <>{children}</>;
  }

  if (profile.role !== "client") {
    return <>{children}</>;
  }

  const initials = initialsFor(profile.full_name || profile.email);

  return (
    <div className="flex flex-1">
      <ClientSidebar lang={lang} />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-black/[.08] bg-white px-6 py-4 dark:border-white/[.145] dark:bg-zinc-950 sm:px-8">
          <ClientPageTitle />
          <div className="flex items-center gap-4">
            <ClientMobileNav lang={lang} />
            <PushNotificationOptIn />
            <Link
              href={`/${lang}/vehicles`}
              aria-label="Vehicles"
              className="hidden text-zinc-600 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50 sm:block"
            >
              <Car className="h-5 w-5" strokeWidth={1.5} />
            </Link>
            <Link
              href={`/${lang}/account`}
              aria-label="Account"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
            >
              {initials}
            </Link>
          </div>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
