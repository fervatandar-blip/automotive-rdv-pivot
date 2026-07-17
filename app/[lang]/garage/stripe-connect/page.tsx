import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { startStripeConnectOnboarding } from "@/app/actions/stripe-connect";

export default async function StripeConnectPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Payments
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          {garage.stripe_charges_enabled ? (
            <p className="text-sm text-green-700 dark:text-green-500">
              &#10003; Payments enabled. Clients can book and pay for
              services at {garage.name}.
            </p>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Connect a Stripe account to start accepting payments. Clients
                pay when they book; Stripe automatically sends your share
                (minus RDV&apos;s commission) to this account.
              </p>
              <form action={startStripeConnectOnboarding}>
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="rounded-full bg-foreground px-5 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                >
                  Connect with Stripe
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
