import { requireGarageOwner } from "@/lib/dal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { updateNotificationPreferences } from "@/app/actions/garage";
import { CheckboxChip } from "@/components/checkbox-chip";

export default async function GarageNotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageNotifications;
  const { saved } = await searchParams;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.title}
        </h1>

        <p className="text-sm text-ink-muted">
          {d.description}
        </p>

        {saved === "1" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {d.preferencesSaved}
          </p>
        )}

        <form
          action={updateNotificationPreferences}
          className="flex flex-col gap-6 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-6"
        >
          <input type="hidden" name="lang" value={lang} />

          <div className="flex flex-col gap-4">
            <div>
              <CheckboxChip
                id="notifyNewBooking"
                name="notifyNewBooking"
                label={d.newBookings}
                defaultChecked={garage.notify_new_booking}
              />
              <p className="mt-1 pl-7 text-sm text-ink-muted">
                {d.newBookingsDescription}
              </p>
            </div>

            <div className="border-t border-hairline pt-4">
              <CheckboxChip
                id="notifyCancellation"
                name="notifyCancellation"
                label={d.cancellations}
                defaultChecked={garage.notify_cancellation}
              />
              <p className="mt-1 pl-7 text-sm text-ink-muted">
                {d.cancellationsDescription}
              </p>
            </div>

            <div className="border-t border-hairline pt-4">
              <CheckboxChip
                id="notifyMessage"
                name="notifyMessage"
                label={d.newMessages}
                defaultChecked={garage.notify_message}
              />
              <p className="mt-1 pl-7 text-sm text-ink-muted">
                {d.newMessagesDescription}
              </p>
            </div>

            <div className="border-t border-hairline pt-4 opacity-50">
              <div className="pointer-events-none">
                <CheckboxChip
                  id="notifySms"
                  name="notifySms"
                  label={d.smsAlerts}
                  defaultChecked={false}
                />
              </div>
              <p className="mt-1 pl-7 text-sm text-ink-muted">
                {d.smsAlertsDescription}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="self-start rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-ink/85"
          >
            {d.savePreferences}
          </button>
        </form>
      </div>
    </div>
  );
}
