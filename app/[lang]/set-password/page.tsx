import type { Metadata } from "next";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AuthShell } from "@/components/auth-shell";
import { SetPasswordForm } from "./set-password-form";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(resolveLocale(lang));
  return { title: dictionary.setPassword.setTitle };
}

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);

  return (
    <AuthShell lang={lang} dictionary={dictionary}>
      <SetPasswordForm lang={lang} dictionary={dictionary} />
    </AuthShell>
  );
}
