import { NextResponse, type NextRequest } from "next/server";
import { locales } from "@/lib/i18n/config";
import { getLocaleFromRequest } from "@/lib/i18n/get-locale";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Non-localized routes (Supabase email callback, API routes/webhooks,
  // etc.) pass through untouched -- locale-prefixing them would break
  // server-to-server callers like Stripe that hit an exact URL.
  if (pathname.startsWith("/auth") || pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const pathnameHasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
  );

  if (!pathnameHasLocale) {
    const locale = getLocaleFromRequest(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  const locale = pathname.split("/")[1] as (typeof locales)[number];
  return await updateSession(request, locale);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
