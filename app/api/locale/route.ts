import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { LOCALE_COOKIE_MAX_AGE, LOCALE_SYNC_COOKIE, localeSyncValue } from "@/lib/i18n/locale-sync";

/**
 * Called by the FR/EN switchers (lib/i18n/remember-locale.ts) alongside the
 * client-side navigation. Remembers the language for unprefixed URLs and,
 * for a signed-in user, makes it the language of their notifications.
 */
export async function POST(request: NextRequest) {
  // Same-origin only: a cross-site form can't flip someone's email language.
  const origin = request.headers.get("origin");
  if (!origin || new URL(origin).host !== request.nextUrl.host) {
    return new NextResponse(null, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
  const locale = body?.locale;
  if (typeof locale !== "string" || !isLocale(locale)) {
    return new NextResponse(null, { status: 400 });
  }

  const response = new NextResponse(null, { status: 204 });
  const cookieOptions = { path: "/", maxAge: LOCALE_COOKIE_MAX_AGE, sameSite: "lax" as const };
  response.cookies.set(LOCALE_COOKIE, locale, cookieOptions);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return response;

  // RLS pins the row to the caller; 0046 grants this one column.
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("id", user.id);

  if (error) {
    console.error("[locale] preferred_locale update failed:", error);
    return response;
  }

  response.cookies.set(LOCALE_SYNC_COOKIE, localeSyncValue(user.id, locale), {
    ...cookieOptions,
    httpOnly: true,
  });
  return response;
}
