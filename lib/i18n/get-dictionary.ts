import type { Locale } from "@/lib/i18n/config";

const dictionaries = {
  en: () => import("@/lib/i18n/dictionaries/en.json").then((m) => m.default),
  fr: () => import("@/lib/i18n/dictionaries/fr.json").then((m) => m.default),
};

export async function getDictionary(locale: Locale) {
  return dictionaries[locale]();
}

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
