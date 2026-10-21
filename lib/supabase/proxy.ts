import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/config";

// "/garages" (plural) is deliberately absent: /garages and /garages/[id] are
// the public discovery/booking pages -- an anonymous visitor must be able to
// browse and reach the booking form, see app/[lang]/(client)/layout.tsx and
// the two page components. Only submitting the booking itself
// (bookAppointment) requires a session.
//
// "/garage" (singular, the garage-owner/staff portal -- dashboard, calendar,
// invoices, staff, client PII) stays protected. Matching is strict-boundary
// (see isProtectedPath below), so this entry matches "/garage" and
// "/garage/..." only -- it does NOT also match "/garages" the way the old
// naive `.startsWith("/garage")` check did.
const protectedRoutes = [
  "/dashboard",
  "/garage",
  "/admin",
  "/set-password",
  "/appointments",
  "/vehicles",
  "/account",
];

// Exceptions within the otherwise-protected "/garage" prefix: the
// garage-owner login/signup pages must be reachable by an anonymous
// visitor -- that's the entire point of a signup/login page. Checked
// before the prefix match below, so these two specific paths are public
// while the rest of "/garage/*" (dashboard, calendar, invoices, ...) stays
// fully protected.
const publicGarageRoutes = ["/garage/login", "/garage/signup"];

// Strict path-segment matching: a route matches only the exact path or a
// "/"-bounded child of it. Plain .startsWith("/garage") would also match
// "/garages" and a hypothetical "/garage-comparison" -- neither is intended.
function isProtectedPath(pathname: string) {
  if (publicGarageRoutes.includes(pathname)) return false;
  return protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function updateSession(request: NextRequest, locale: Locale) {
  // Forwarded so Server Components (see (client)/layout.tsx) can read the
  // current pathname -- there's no built-in API for that outside proxy.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathWithoutLocale =
    request.nextUrl.pathname.replace(`/${locale}`, "") || "/";

  if (isProtectedPath(pathWithoutLocale) && !user) {
    const url = request.nextUrl.clone();
    // An anonymous visit to a protected garage-portal page (dashboard,
    // calendar, staff, ...) lands on the garage-branded login rather than
    // the generic client one -- isProtectedPath already boundary-checked
    // this against "/garage"/"/garage/...", so a plain startsWith here is
    // safe (it can't also match "/garages", which was never protected to
    // begin with).
    url.pathname = pathWithoutLocale.startsWith("/garage")
      ? `/${locale}/garage/login`
      : `/${locale}/login`;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
