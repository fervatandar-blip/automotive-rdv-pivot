import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { requestAccountDeletion, cancelAccountDeletion } from "@/app/actions/account";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "@/lib/account-deletion";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { NotificationPrefsForm, ProfileDetailsForm } from "./profile-forms";

const SECTION =
  "flex flex-col gap-5 rounded-xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-zinc-800/60 dark:bg-transparent";
const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const SECONDARY_BUTTON =
  "inline-flex items-center gap-1.5 self-start rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-zinc-700/80 dark:text-zinc-50 dark:hover:bg-zinc-800/60";

function SectionHeader({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 id={id} className={SECTION_LABEL}>
        {title}
      </h2>
      {description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>}
    </div>
  );
}

export default async function AccountPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.account;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const isClient = profile.role === "client";

  // Fields added in 0044, read here rather than in the shared profile
  // loader so every other page keeps its narrow select.
  const supabase = await createClient();
  const { data: extra } = await supabase
    .from("profiles")
    .select("phone, notify_repair_updates, notify_waitlist")
    .eq("id", profile.id)
    .maybeSingle();

  const requestedAt = profile.deletion_requested_at ? new Date(profile.deletion_requested_at) : null;
  const eligibleAt = requestedAt
    ? new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-3xl">
            {d.title}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.subtitle}</p>
        </header>

        {requestedAt && eligibleAt && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <p>
              {d.scheduledForDeletionPrefix}{" "}
              <strong>
                {eligibleAt.toLocaleDateString(dateLocale, {
                  timeZone: APP_TIME_ZONE,
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </strong>
              {d.scheduledForDeletionSuffix}
            </p>
            <form action={cancelAccountDeletion}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-full bg-amber-900 px-3.5 py-1.5 text-sm font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
              >
                {d.cancelDeletionRequest}
              </button>
            </form>
          </div>
        )}

        <section aria-labelledby="details-title" className={SECTION}>
          <SectionHeader id="details-title" title={d.profileTitle} description={d.profileDescription} />
          <ProfileDetailsForm
            d={d}
            fullName={profile.full_name ?? ""}
            email={profile.email}
            phone={(extra?.phone as string | null | undefined) ?? null}
          />
        </section>

        <section aria-labelledby="notifications-title" className={SECTION}>
          <SectionHeader
            id="notifications-title"
            title={d.notifications}
            description={isClient ? d.notificationsDescriptionClient : d.notificationsDescription}
          />
          {isClient && (
            <NotificationPrefsForm
              d={d}
              repairUpdates={(extra?.notify_repair_updates as boolean | undefined) ?? true}
              waitlist={(extra?.notify_waitlist as boolean | undefined) ?? true}
            />
          )}
          <div className="flex flex-col gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/60">
            <p className="text-sm font-medium text-black dark:text-zinc-50">{d.pushTitle}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.pushDescription}</p>
            <PushNotificationOptIn enableLabel={d.enablePush} enablingLabel={d.enablingPush} />
          </div>
        </section>

        {profile.role === "admin_garage" && (
          <section aria-labelledby="team-title" className={SECTION}>
            <SectionHeader id="team-title" title={d.teamAccess} description={d.teamAccessDescription} />
            <Link href={`/${lang}/garage/staff`} className={SECONDARY_BUTTON}>
              {d.manageStaff}
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </section>
        )}

        <section aria-labelledby="language-title" className={SECTION}>
          <SectionHeader id="language-title" title={d.language} description={d.languageDescription} />
          <LanguageSwitcher lang={lang} />
        </section>

        <section aria-labelledby="security-title" className={SECTION}>
          <SectionHeader id="security-title" title={d.security} description={d.securityDescription} />
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-black dark:text-zinc-50">{d.changePassword}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.changePasswordDescription}</p>
            <Link href={`/${lang}/forgot-password`} className={SECONDARY_BUTTON}>
              {d.changePasswordAction}
            </Link>
          </div>

          {!requestedAt && (
            <div className="flex flex-col gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/60">
              <p className="text-sm font-medium text-black dark:text-zinc-50">{d.deleteAccount}</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {d.deletionExplanationPrefix} {ACCOUNT_DELETION_GRACE_PERIOD_DAYS}
                {d.deletionExplanationSuffix}
              </p>
              <form action={requestAccountDeletion}>
                <button
                  type="submit"
                  className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                >
                  {d.deleteMyAccount}
                </button>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
