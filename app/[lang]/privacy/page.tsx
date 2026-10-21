import Link from "next/link";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        {title}
      </h2>
      <div className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.privacy;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link href={`/${lang}`} className="text-sm font-medium underline">
              &larr; {d.back}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {d.title}
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.intro}</p>

        <Section title={d.whatWeCollectTitle}>
          <p>
            <strong>{d.accountDataLabel}</strong> &mdash; {d.accountDataBody}
          </p>
          <p>
            <strong>{d.vehicleDataLabel}</strong> &mdash; {d.vehicleDataBody}
          </p>
          <p>
            <strong>{d.bookingDataLabel}</strong> &mdash; {d.bookingDataBody}
          </p>
          <p>
            <strong>{d.paymentDataLabel}</strong> &mdash; {d.paymentDataBody}
          </p>
          <p>
            <strong>{d.garageBusinessDataLabel}</strong> &mdash;{" "}
            {d.garageBusinessDataBody}
          </p>
          <p>
            <strong>{d.locationDataLabel}</strong> &mdash; {d.locationDataBody}
          </p>
          <p>
            <strong>{d.deviceDataLabel}</strong> &mdash; {d.deviceDataBody}
          </p>
        </Section>

        <Section title={d.whoWeShareTitle}>
          <p>{d.whoWeShareBody}</p>
        </Section>

        <Section title={d.howLongTitle}>
          <p>{d.howLongBody1}</p>
          <p>{d.howLongBody2}</p>
        </Section>

        <Section title={d.yourRightsTitle}>
          <p>
            {d.yourRightsBodyPrefix}{" "}
            <Link href={`/${lang}/account`} className="underline">
              {d.accountSettingsLink}
            </Link>
            {d.yourRightsBodySuffix}
          </p>
        </Section>

        <Section title={d.bookingTermsTitle}>
          <p>{d.bookingTermsBody}</p>
        </Section>
      </div>
    </div>
  );
}
