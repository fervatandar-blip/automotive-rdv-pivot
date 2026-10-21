import Link from "next/link";
import { headers } from "next/headers";
import { getGarageMembership } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { GarageSidebar, GarageTopBar } from "@/components/garage-nav";
import { AnimatedLogo } from "@/components/animated-logo";

// /garage/login and /garage/signup are public -- an anonymous visitor must
// be able to reach them (see lib/supabase/proxy.ts's publicGarageRoutes,
// which deliberately excludes these two from the otherwise-protected
// "/garage" prefix). Every other route under this layout still requires
// garage membership, enforced below via the unconditional
// getGarageMembership call. Mirrors (client)/layout.tsx's
// isPublicDiscoveryRoute for /garages.
function isPublicGarageAuthRoute(pathname: string, lang: string) {
  const withoutLocale = pathname.replace(`/${lang}`, "") || "/";
  return withoutLocale === "/garage/login" || withoutLocale === "/garage/signup";
}

export default async function GarageLayout({
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

  if (isPublicGarageAuthRoute(pathname, lang)) {
    return <>{children}</>;
  }

  const membership = await getGarageMembership(lang);

  // No garage membership at all (wrong role, or a mecanicien removed from
  // staff) -- pass through untouched. Each page under /garage/* already
  // calls requireGarageMember/requireGarageOwner itself and handles the
  // redirect; this layout doesn't duplicate that logic.
  if (!membership) {
    return <>{children}</>;
  }

  const { garage, isOwner } = membership;

  if (!garage.platform_terms_accepted_at) {
    return (
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-center gap-4 px-6 py-6">
          <Link href={`/${lang}/dashboard`}>
            <AnimatedLogo size={40} />
          </Link>
          <Link
            href={`/${lang}/dashboard`}
            className="text-sm font-medium underline"
          >
            &larr; Back to dashboard
          </Link>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <GarageSidebar lang={lang} isOwner={isOwner} />
      <div className="flex flex-1 flex-col">
        <GarageTopBar lang={lang} garageName={garage.name} status={garage.status} />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
