import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { rescheduleAppointment } from "@/app/actions/appointments";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextDays(count: number) {
  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i < count; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "That request wasn't valid. Please try again.",
  "not-reschedulable": "This appointment can no longer be rescheduled.",
  service: "That service is no longer available.",
  "slot-taken": "That time was just booked. Pick another.",
  error: "Something went wrong. Please try again.",
};

export default async function RescheduleAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{ date?: string; error?: string }>;
}) {
  const { lang: rawLang, id: appointmentId } = await params;
  const lang = resolveLocale(rawLang);
  await getAuthedUser(lang);
  const { date: dateParam, error } = await searchParams;

  const supabase = await createClient();

  // RLS ("Participants can update their appointments") already restricts
  // this to the client who booked it or a member of the garage it belongs
  // to -- anyone else gets no row back, same pattern as rescheduleAppointment.
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, status, start_time, services(name, duration_minutes, price), garages(id, name, city)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    notFound();
  }

  const service = appointment.services as unknown as {
    name: string;
    duration_minutes: number;
    price: number;
  } | null;
  const garage = appointment.garages as unknown as {
    id: string;
    name: string;
    city: string | null;
  } | null;

  if (!service || !garage) {
    notFound();
  }

  const isReschedulable =
    appointment.status === "pending" || appointment.status === "confirmed";

  const days = nextDays(14);
  const selectedDate = dateParam ?? toDateKey(days[0]);

  let slots: string[] = [];
  let isClosedOverride = false;
  if (isReschedulable) {
    const result = await getAvailableSlotsForDate({
      supabase,
      garageId: garage.id,
      date: selectedDate,
      durationMinutes: service.duration_minutes,
      excludeAppointmentId: appointmentId,
    });
    slots = result.slots;
    isClosedOverride = result.isClosed;
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
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              Reschedule appointment
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {service.name} with {garage.name}
              {garage.city ? `, ${garage.city}` : ""}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Currently{" "}
              {new Date(appointment.start_time).toLocaleString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {error && ERROR_MESSAGES[error] && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        {!isReschedulable ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            This appointment can no longer be rescheduled.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Choose a new date
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((day) => {
                const key = toDateKey(day);
                const isSelected = key === selectedDate;
                return (
                  <Link
                    key={key}
                    href={`/${lang}/appointments/${appointmentId}/reschedule?date=${key}`}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 text-sm transition-colors ${
                      isSelected
                        ? "border-black bg-foreground text-background dark:border-white"
                        : "border-black/[.08] bg-white hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
                    }`}
                  >
                    <span>{WEEKDAY_LABELS[day.getDay()]}</span>
                    <span className="font-medium">{day.getDate()}</span>
                  </Link>
                );
              })}
            </div>

            <h2 className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Available times
            </h2>
            {slots.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {slots.map((slot) => (
                  <form key={slot} action={rescheduleAppointment}>
                    <input
                      type="hidden"
                      name="appointmentId"
                      value={appointmentId}
                    />
                    <input type="hidden" name="date" value={selectedDate} />
                    <input type="hidden" name="startTime" value={slot} />
                    <input type="hidden" name="lang" value={lang} />
                    <button
                      type="submit"
                      className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                    >
                      {slot}
                    </button>
                  </form>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {isClosedOverride
                  ? "This garage is closed on this date."
                  : "No open times on this day."}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
