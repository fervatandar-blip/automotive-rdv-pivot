// Keeps profiles.preferred_locale (0046) -- the language emails and push
// notifications are written in -- equal to the language the user last used
// the app in. Two writers:
//   - lib/supabase/proxy.ts on full page loads, and
//   - app/api/locale/route.ts when the user picks FR/EN in a switcher.
// LOCALE_SYNC_COOKIE remembers what was last written for which user, so the
// profile is only written when the language actually changes.

export const LOCALE_SYNC_COOKIE = "rdv_locale_synced";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function localeSyncValue(userId: string, locale: string) {
  return `${userId}:${locale}`;
}
