import Link from "next/link";
import { getAuthedProfile } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import {
  requestAccountDeletion,
  cancelAccountDeletion,
} from "@/app/actions/account";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "@/lib/account-deletion";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const isGarageRole =
    profile.role === "admin_garage" || profile.role === "mecanicien";

  const requestedAt = profile.deletion_requested_at
    ? new Date(profile.deletion_requested_at)
    : null;
  const eligibleAt = requestedAt
    ? new Date(
        requestedAt.getTime() +
          ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000
      )
    : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Account
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-black dark:text-zinc-50">
            {profile.full_name}
          </p>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {profile.email}
          </p>
        </div>

        {isGarageRole && (
          <section className="flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
            <h2 className="font-semibold text-black dark:text-zinc-50">
              Notifications
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Get notified about new bookings and messages on this device.
            </p>
            <PushNotificationOptIn />
          </section>
        )}

        {profile.role === "admin_garage" && (
          <section className="flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
            <h2 className="font-semibold text-black dark:text-zinc-50">
              Team access
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Manage which mécaniciens can access your garage&apos;s
              dashboard.
            </p>
            <Link
              href={`/${lang}/garage/staff`}
              className="self-start rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Manage staff
            </Link>
          </section>
        )}

        <section className="flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Security
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Manage your account&apos;s security and data.
          </p>

          <h3 className="font-medium text-black dark:text-zinc-50">
            Delete account
          </h3>

          {requestedAt && eligibleAt ? (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                Your account is scheduled for deletion on{" "}
                {eligibleAt.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                . You can cancel this any time before then.
              </p>
              <form action={cancelAccountDeletion}>
                <button
                  type="submit"
                  className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Cancel deletion request
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Requesting deletion schedules your account and profile
                information to be anonymized after a{" "}
                {ACCOUNT_DELETION_GRACE_PERIOD_DAYS}-day grace period, during
                which you can cancel the request. Invoices and payment
                records tied to your account are retained as required by
                law and are not affected.
              </p>
              <form action={requestAccountDeletion}>
                <button
                  type="submit"
                  className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Delete my account
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
