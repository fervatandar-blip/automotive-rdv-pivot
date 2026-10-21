import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { GarageSignupForm } from "./garage-signup-form";

export default async function GarageSignupPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);

  return <GarageSignupForm lang={lang} dictionary={dictionary} />;
}
