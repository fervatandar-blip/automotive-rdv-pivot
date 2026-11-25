import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { requestAccountDeletion, cancelAccountDeletion } from "@/app/actions/account";
import { ACCOUNT_DELETION_GRACE_PERIOD_DAYS } from "@/lib/account-deletion";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { NotificationPrefsForm, ProfileDetailsForm } from "./profile-forms";
import {
  CLIENT_FIT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
  CLIENT_SECONDARY_BUTTON,
  CLIENT_SURFACE,
} from "@/lib/client-ui";

// One surface per column; sections inside are split by hairlines.
const SECTION = "flex flex-col gap-4 px-5 py-5 sm:px-6";
const ROW_TITLE = "text-sm font-medium text-ink";
const ROW_TEXT = "text-sm text-ink-muted";

function SectionHeader({ id, title, description }: { id: string; title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id={id} className="text-[15px] font-semibold text-ink">
        {title}
      </h2>
      {description && <p className={ROW_TEXT}>{description}</p>}
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { account } = await getDictionary(resolveLocale(lang));
  return { title: account.title };
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
    <div className={CLIENT_FIT_PAGE}>
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5">
        <header className="flex flex-col gap-1">
          <h1 className={CLIENT_PAGE_TITLE}>{d.title}</h1>
          <p className={CLIENT_PAGE_SUBTITLE}>{d.subtitle}</p>
        </header>

        {requestedAt && eligibleAt && (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
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
                className="inline-flex h-8 items-center whitespace-nowrap rounded-lg bg-amber-900 px-3 text-xs font-medium text-amber-50 hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200"
              >
                {d.cancelDeletionRequest}
              </button>
            </form>
          </div>
        )}

        {/* Two columns, nothing below them: who you are on the left; how RDV
            reaches you and account security on the right. Theme and
            language live in the sidebar. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <section aria-labelledby="details-title" className={CLIENT_SURFACE}>
            <div className={SECTION}>
              <SectionHeader id="details-title" title={d.profileTitle} description={d.profileDescription} />
              <ProfileDetailsForm
                d={d}
                fullName={profile.full_name ?? ""}
                email={profile.email}
                phone={(extra?.phone as string | null | undefined) ?? null}
              />
            </div>
          </section>

          <div className={`${CLIENT_SURFACE} divide-y divide-hairline`}>
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={ROW_TITLE}>{d.pushTitle}</p>
                  <p className={ROW_TEXT}>{d.pushDescription}</p>
                </div>
                <PushNotificationOptIn enableLabel={d.enablePush} enablingLabel={d.enablingPush} />
              </div>
            </section>

            <section aria-labelledby="security-title" className={SECTION}>
              <SectionHeader id="security-title" title={d.security} description={d.securityDescription} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className={ROW_TITLE}>{d.changePassword}</p>
                  <p className={ROW_TEXT}>{d.changePasswordDescription}</p>
                </div>
                <Link href={`/${lang}/forgot-password`} className={CLIENT_SECONDARY_BUTTON}>
                  {d.changePasswordAction}
                </Link>
              </div>
              {!requestedAt && (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={ROW_TITLE}>{d.deleteAccount}</p>
                    <p className={ROW_TEXT}>
                      {d.deletionExplanationPrefix} {ACCOUNT_DELETION_GRACE_PERIOD_DAYS}
                      {d.deletionExplanationSuffix}
                    </p>
                  </div>
                  <form action={requestAccountDeletion}>
                    <button
                      type="submit"
                      className="inline-flex h-9 items-center rounded-lg border border-red-200 px-3.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      {d.deleteMyAccount}
                    </button>
                  </form>
                </div>
              )}
            </section>

            {profile.role === "admin_garage" && (
              <section aria-labelledby="team-title" className={SECTION}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionHeader id="team-title" title={d.teamAccess} description={d.teamAccessDescription} />
                  <Link href={`/${lang}/garage/staff`} className={CLIENT_SECONDARY_BUTTON}>
                    {d.manageStaff}
                    <ArrowRight aria-hidden className="h-4 w-4" />
                  </Link>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
