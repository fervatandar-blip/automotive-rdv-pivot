import type { Locale } from "@/lib/i18n/config";

/**
 * Fire-and-forget from a language switcher's onClick: the link itself does
 * the navigation; this records the choice (app/api/locale/route.ts).
 * keepalive lets it finish even as the page changes.
 */
export function rememberLocale(locale: Locale) {
  void fetch("/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ locale }),
    keepalive: true,
  }).catch(() => {
    // Best effort: the proxy re-syncs on the next full page load.
  });
}
