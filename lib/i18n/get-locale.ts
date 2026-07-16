import { type NextRequest } from "next/server";
import { defaultLocale, locales, type Locale } from "@/lib/i18n/config";

export function getLocaleFromRequest(request: NextRequest): Locale {
  const acceptLanguage = request.headers.get("accept-language");
  if (!acceptLanguage) return defaultLocale;

  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase());

  for (const lang of preferred) {
    if ((locales as readonly string[]).includes(lang)) {
      return lang as Locale;
    }
  }

  return defaultLocale;
}
