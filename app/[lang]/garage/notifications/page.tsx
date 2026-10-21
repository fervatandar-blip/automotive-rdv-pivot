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
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {d.title}
        </h1>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {d.description}
        </p>

        {saved === "1" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {d.preferencesSaved}
          </p>
        )}

        <form
          action={updateNotificationPreferences}
          className="flex flex-col gap-6 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
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
              <p className="mt-1 pl-7 text-sm text-zinc-600 dark:text-zinc-400">
                {d.newBookingsDescription}
              </p>
            </div>

            <div className="border-t border-black/[.08] pt-4 dark:border-white/[.145]">
              <CheckboxChip
                id="notifyCancellation"
                name="notifyCancellation"
                label={d.cancellations}
                defaultChecked={garage.notify_cancellation}
              />
              <p className="mt-1 pl-7 text-sm text-zinc-600 dark:text-zinc-400">
                {d.cancellationsDescription}
              </p>
            </div>

            <div className="border-t border-black/[.08] pt-4 dark:border-white/[.145]">
              <CheckboxChip
                id="notifyMessage"
                name="notifyMessage"
                label={d.newMessages}
                defaultChecked={garage.notify_message}
              />
              <p className="mt-1 pl-7 text-sm text-zinc-600 dark:text-zinc-400">
                {d.newMessagesDescription}
              </p>
            </div>

            <div className="border-t border-black/[.08] pt-4 opacity-50 dark:border-white/[.145]">
              <div className="pointer-events-none">
                <CheckboxChip
                  id="notifySms"
                  name="notifySms"
                  label={d.smsAlerts}
                  defaultChecked={false}
                />
              </div>
              <p className="mt-1 pl-7 text-sm text-zinc-600 dark:text-zinc-400">
                {d.smsAlertsDescription}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {d.savePreferences}
          </button>
        </form>
      </div>
    </div>
  );
}
