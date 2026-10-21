import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  startStripeConnectOnboarding,
  syncStripeAccountStatus,
} from "@/app/actions/stripe-connect";

export default async function StripeConnectPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageStripeConnect;

  // See syncStripeAccountStatus's comment: don't rely solely on the
  // account.updated webhook having already landed by the time the owner is
  // looking at this page. The action re-derives the garage/account from
  // the session itself rather than trusting garage.stripe_account_id
  // passed in from here.
  let chargesEnabled = garage.stripe_charges_enabled;
  if (garage.stripe_account_id && !chargesEnabled) {
    const synced = await syncStripeAccountStatus(lang);
    if (synced) {
      chargesEnabled = synced.chargesEnabled;
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; {d.backToDashboard}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {d.title}
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          {chargesEnabled ? (
            <p className="text-sm text-green-700 dark:text-green-500">
              &#10003; {d.enabledPrefix} {garage.name}.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {d.description}
              </p>
              <form action={startStripeConnectOnboarding}>
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="rounded-full bg-foreground px-5 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                >
                  {d.connectWithStripe}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
