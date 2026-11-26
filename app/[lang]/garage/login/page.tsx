import type { Metadata } from "next";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "@/app/[lang]/login/login-form";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const dictionary = await getDictionary(resolveLocale(lang));
  return { title: dictionary.garageAuth.login.title };
}

export default async function GarageLoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);

  return (
    <AuthShell lang={lang} dictionary={dictionary} audience="workshop">
      <LoginForm lang={lang} dictionary={dictionary} audience="workshop" />
    </AuthShell>
  );
}
