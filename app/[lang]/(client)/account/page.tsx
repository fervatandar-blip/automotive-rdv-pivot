import Link from "next/link";
import { getAuthedProfile } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import {
  requestAccountDeletion,
  cancelAccountDeletion,
} from "@/app/actions/account";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "@/lib/account-deletion";
import { APP_TIME_ZONE } from "@/lib/timezone";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.account;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
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
              &larr; {d.backToDashboard}
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {d.title}
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
              {d.notifications}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.notificationsDescription}
            </p>
            <PushNotificationOptIn
              enableLabel={d.enablePush}
              enablingLabel={d.enablingPush}
            />
          </section>
        )}

        {profile.role === "admin_garage" && (
          <section className="flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
            <h2 className="font-semibold text-black dark:text-zinc-50">
              {d.teamAccess}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.teamAccessDescription}
            </p>
            <Link
              href={`/${lang}/garage/staff`}
              className="self-start rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.manageStaff}
            </Link>
          </section>
        )}

        <section className="flex flex-col gap-3 border-t border-black/[.08] pt-6 dark:border-white/[.145]">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            {d.security}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {d.securityDescription}
          </p>

          <h3 className="font-medium text-black dark:text-zinc-50">
            {d.deleteAccount}
          </h3>

          {requestedAt && eligibleAt ? (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                {d.scheduledForDeletionPrefix}{" "}
                {eligibleAt.toLocaleDateString(dateLocale, {
                  timeZone: APP_TIME_ZONE,
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
                {d.scheduledForDeletionSuffix}
              </p>
              <form action={cancelAccountDeletion}>
                <button
                  type="submit"
                  className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  {d.cancelDeletionRequest}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {d.deletionExplanationPrefix}{" "}
                {ACCOUNT_DELETION_GRACE_PERIOD_DAYS}
                {d.deletionExplanationSuffix}
              </p>
              <form action={requestAccountDeletion}>
                <button
                  type="submit"
                  className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  {d.deleteMyAccount}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
