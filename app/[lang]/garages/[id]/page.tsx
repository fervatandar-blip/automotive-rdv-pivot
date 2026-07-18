import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { GarageMapDisplay } from "@/components/garage-map-display";
import { bookAppointment } from "@/app/actions/appointments";
import { formatRating } from "@/lib/ratings";

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
  invalid: "That booking request wasn't valid. Please try again.",
  service: "That service is no longer available.",
  "slot-taken": "That time was just booked by someone else. Pick another.",
  error: "Something went wrong booking that slot. Please try again.",
  "not-payable": "This garage hasn't finished payment setup yet.",
  "payment-cancelled": "Checkout was cancelled. You haven't been charged.",
  "payment-error": "Something went wrong starting checkout. Please try again.",
};

export default async function GarageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{
    service?: string;
    date?: string;
    error?: string;
  }>;
}) {
  const { lang: rawLang, id: garageId } = await params;
  const lang = resolveLocale(rawLang);
  await getAuthedUser(lang);
  const {
    service: serviceParam,
    date: dateParam,
    error,
  } = await searchParams;

  const supabase = await createClient();

  const { data: garage } = await supabase
    .from("garages")
    .select("id, name, address, city, latitude, longitude, stripe_charges_enabled")
    .eq("id", garageId)
    .eq("status", "approved")
    .single();

  if (!garage) {
    notFound();
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price")
    .eq("garage_id", garageId)
    .order("created_at", { ascending: true });

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at, profiles(full_name)")
    .eq("garage_id", garageId)
    .order("created_at", { ascending: false });

  const reviewRows = (reviews ?? []) as unknown as {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles: { full_name: string } | null;
  }[];

  const selectedService =
    services?.find((service) => service.id === serviceParam) ?? services?.[0];

  const days = nextDays(14);
  const selectedDate = dateParam ?? toDateKey(days[0]);

  let slots: string[] = [];
  let isClosedOverride = false;
  if (selectedService) {
    const result = await getAvailableSlotsForDate({
      supabase,
      garageId,
      date: selectedDate,
      durationMinutes: selectedService.duration_minutes,
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
              href={`/${lang}/garages`}
              className="text-sm font-medium underline"
            >
              &larr; Back to garages
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name}
            </h1>
            {(garage.address || garage.city) && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {[garage.address, garage.city].filter(Boolean).join(", ")}
              </p>
            )}
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {formatRating(reviewRows.map((review) => review.rating))}
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {garage.latitude !== null && garage.longitude !== null && (
          <GarageMapDisplay
            latitude={garage.latitude}
            longitude={garage.longitude}
          />
        )}

        {error && ERROR_MESSAGES[error] && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {ERROR_MESSAGES[error]}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Choose a service
          </h2>
          <div className="flex flex-col gap-2">
            {services && services.length > 0 ? (
              services.map((service) => (
                <Link
                  key={service.id}
                  href={`/${lang}/garages/${garageId}?service=${service.id}&date=${selectedDate}`}
                  className={`rounded-xl border p-4 transition-colors ${
                    selectedService?.id === service.id
                      ? "border-black bg-white dark:border-white dark:bg-zinc-950"
                      : "border-black/[.08] bg-white hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-black dark:text-zinc-50">
                      {service.name}
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {service.duration_minutes} min &middot; $
                      {Number(service.price).toFixed(2)}
                    </span>
                  </div>
                  {service.description && (
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {service.description}
                    </p>
                  )}
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This garage hasn&apos;t added any services yet.
              </p>
            )}
          </div>
        </div>

        {selectedService && !garage.stripe_charges_enabled && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            This garage hasn&apos;t finished payment setup yet, so booking is
            temporarily unavailable.
          </p>
        )}

        {selectedService && garage.stripe_charges_enabled && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Choose a date
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {days.map((day) => {
                const key = toDateKey(day);
                const isSelected = key === selectedDate;
                return (
                  <Link
                    key={key}
                    href={`/${lang}/garages/${garageId}?service=${selectedService.id}&date=${key}`}
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
                  <form key={slot} action={bookAppointment}>
                    <input type="hidden" name="garageId" value={garageId} />
                    <input
                      type="hidden"
                      name="serviceId"
                      value={selectedService.id}
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

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Reviews
          </h2>
          {reviewRows.length > 0 ? (
            reviewRows.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black dark:text-zinc-50">
                    {review.profiles?.full_name ?? "Client"}
                  </span>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {review.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  {new Date(review.created_at).toLocaleDateString()}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No reviews yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
