import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { SetPasswordForm } from "./set-password-form";

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);

  return <SetPasswordForm lang={lang} dictionary={dictionary} />;
}
