import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { deleteAvailability } from "@/app/actions/availability";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AddAvailabilityForm } from "./add-availability-form";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function formatTime(time: string) {
  return time.slice(0, 5);
}

export default async function GarageAvailabilityPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const supabase = await createClient();

  const { data: availability } = await supabase
    .from("availability")
    .select("id, day_of_week, start_time, end_time")
    .eq("garage_id", garage.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const byDay = DAYS.map((_, dayOfWeek) =>
    (availability ?? []).filter((slot) => slot.day_of_week === dayOfWeek)
  );

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {garage.name} &mdash; availability
          </h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex gap-4 underline">
              <Link href={`/${lang}/garage/calendar`}>Calendar</Link>
              <Link href={`/${lang}/garage/services`}>Manage services</Link>
            </div>
            <LanguageSwitcher lang={lang} />
          </div>
        </div>

        <AddAvailabilityForm />

        <div className="flex flex-col gap-4">
          {DAYS.map((day, dayOfWeek) => (
            <div
              key={day}
              className="rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h3 className="font-semibold text-black dark:text-zinc-50">
                {day}
              </h3>
              {byDay[dayOfWeek].length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No availability set.
                </p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {byDay[dayOfWeek].map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-600 dark:text-zinc-400">
                        {formatTime(slot.start_time)} &ndash;{" "}
                        {formatTime(slot.end_time)}
                      </span>
                      <form action={deleteAvailability}>
                        <input type="hidden" name="id" value={slot.id} />
                        <input type="hidden" name="lang" value={lang} />
                        <button
                          type="submit"
                          className="text-red-600 underline"
                        >
                          Delete
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
