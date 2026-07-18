import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import {
  cancelAppointment,
  completeAppointment,
  confirmAppointment,
  providerCancelAppointment,
} from "@/app/actions/appointments";
import { submitReview } from "@/app/actions/reviews";
import { leaveWaitlist } from "@/app/actions/waitlist";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";

type Appointment = {
  id: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  garages: { name: string } | null;
};

function isUpcoming(appointment: { status: string; start_time: string }) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= Date.now()
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const RATING_OPTIONS = [
  { value: 5, label: "5 – Excellent" },
  { value: 4, label: "4 – Good" },
  { value: 3, label: "3 – Average" },
  { value: 2, label: "2 – Poor" },
  { value: 1, label: "1 – Very poor" },
];

function ReviewForm({
  appointmentId,
  lang,
}: {
  appointmentId: string;
  lang: Locale;
}) {
  return (
    <form
      action={submitReview}
      className="mt-2 flex flex-col gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="lang" value={lang} />
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        Leave a review
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="rating"
          defaultValue={5}
          className="rounded-md border border-black/[.08] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black"
        >
          {RATING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full border border-black/[.08] px-4 py-1 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Submit
        </button>
      </div>
      <textarea
        name="comment"
        placeholder="Optional comment"
        rows={2}
        className="rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
      />
    </form>
  );
}

function AppointmentCard({
  appointment,
  lang,
  cancellable = false,
  invoiceUrl,
  reviewable = false,
}: {
  appointment: Appointment;
  lang: Locale;
  cancellable?: boolean;
  invoiceUrl?: string;
  reviewable?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-black dark:text-zinc-50">
            {appointment.services?.name ?? "Service"}
          </h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            with {appointment.garages?.name ?? "Garage"}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatDateTime(appointment.start_time)}
          </p>
          {appointment.status === "pending_payment" && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
              Payment processing
            </p>
          )}
          {appointment.status === "cancelled" && (
            <p className="mt-1 text-sm text-red-600">Cancelled</p>
          )}
          {appointment.status === "completed" && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Completed
            </p>
          )}
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              className="mt-1 inline-block text-sm font-medium underline"
            >
              Download invoice
            </a>
          )}
        </div>
        {cancellable &&
          (appointment.status === "pending" ||
            appointment.status === "confirmed") && (
            <div className="flex shrink-0 flex-col gap-1.5">
              <Link
                href={`/${lang}/appointments/${appointment.id}/reschedule`}
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-center text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Reschedule
              </Link>
              <form action={cancelAppointment}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="w-full rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                >
                  Cancel
                </button>
              </form>
            </div>
          )}
      </div>
      {reviewable && (
        <ReviewForm appointmentId={appointment.id} lang={lang} />
      )}
    </div>
  );
}

type AssignedAppointment = {
  id: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
};

function MechanicAppointmentCard({
  appointment,
  lang,
}: {
  appointment: AssignedAppointment;
  lang: Locale;
}) {
  const canConfirm = appointment.status === "pending";
  const canComplete =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canCancel =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canReschedule = canCancel;

  return (
    <div className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <div>
        <h3 className="font-semibold text-black dark:text-zinc-50">
          {appointment.services?.name ?? "Service"}
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Client: {appointment.profiles?.full_name ?? "Client"}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDateTime(appointment.start_time)}
        </p>
        {appointment.status === "cancelled" && (
          <p className="mt-1 text-sm text-red-600">Cancelled</p>
        )}
        {appointment.status === "completed" && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Completed
          </p>
        )}
      </div>
      {(canConfirm || canComplete || canReschedule || canCancel) && (
        <div className="flex shrink-0 flex-col gap-1.5">
          {canConfirm && (
            <form action={confirmAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Confirm
              </button>
            </form>
          )}
          {canComplete && (
            <form action={completeAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Complete
              </button>
            </form>
          )}
          {canReschedule && (
            <Link
              href={`/${lang}/appointments/${appointment.id}/reschedule`}
              className="w-full rounded-full border border-black/[.08] px-4 py-1 text-center text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Reschedule
            </Link>
          )}
          {canCancel && (
            <form action={providerCancelAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

function LogoutButton({ lang }: { lang: Locale }) {
  return (
    <form action={logout}>
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        Log out
      </button>
    </form>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ booked?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);

  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    const membership = await getGarageMembership(lang);

    if (!membership) {
      // A mecanicien with no garage association (e.g. removed from staff).
      // Don't call requireGarageMember here — its fallback redirects to
      // /dashboard, which would loop forever on this exact page.
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
          <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              No garage yet
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You&apos;re not currently part of a garage team. Ask your
              garage admin to add you as staff.
            </p>
            <LanguageSwitcher lang={lang} />
            <LogoutButton lang={lang} />
          </div>
        </div>
      );
    }

    const { garage, isOwner } = membership;

    if (isOwner && !garage.platform_terms_accepted_at) {
      redirect(`/${lang}/garage/onboarding`);
    }

    if (!isOwner) {
      const supabase = await createClient();
      const { data: appointments } = await supabase
        .from("appointments")
        .select(
          "id, start_time, status, services(name), profiles!appointments_client_id_fkey(full_name)"
        )
        .eq("garage_id", garage.id)
        .eq("assigned_mechanic_id", profile.id)
        .order("start_time", { ascending: true });

      const rows = (appointments ?? []) as unknown as AssignedAppointment[];
      const upcoming = rows.filter(isUpcoming);
      const other = rows.filter(
        (appointment) => !upcoming.includes(appointment)
      );

      return (
        <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                  {garage.name}
                </h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {profile.full_name || profile.email}{" "}
                  &middot; Mécanicien
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Link
                  href={`/${lang}/garage/calendar`}
                  className="text-sm font-medium underline"
                >
                  Full calendar
                </Link>
                <LanguageSwitcher lang={lang} />
                <LogoutButton lang={lang} />
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                Your assigned appointments
              </h2>
              {upcoming.length > 0 ? (
                upcoming.map((appointment) => (
                  <MechanicAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    lang={lang}
                  />
                ))
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  No upcoming appointments assigned to you.
                </p>
              )}
            </div>

            {other.length > 0 && (
              <div className="flex flex-col gap-4">
                <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Past &amp; cancelled
                </h2>
                {other.map((appointment) => (
                  <MechanicAppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    lang={lang}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {garage.name}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {profile.full_name || profile.email}{" "}
            &middot; Garage admin
          </p>
          {garage.status !== "approved" && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              Your garage is {garage.status === "rejected" ? "not approved" : "pending approval"}.
              {garage.status === "pending" &&
                " You can still set up services and availability in the meantime."}
            </p>
          )}
          {!garage.stripe_charges_enabled && (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
              Connect a Stripe account to start accepting bookings.{" "}
              <Link href={`/${lang}/garage/stripe-connect`} className="underline">
                Set up payments
              </Link>
            </p>
          )}
          <div className="flex flex-wrap gap-4 text-sm font-medium underline">
            <Link href={`/${lang}/garage/calendar`}>Calendar</Link>
            <Link href={`/${lang}/garage/services`}>Services</Link>
            <Link href={`/${lang}/garage/availability`}>Availability</Link>
            <Link href={`/${lang}/garage/documents`}>Documents</Link>
            <Link href={`/${lang}/garage/invoices`}>Invoices</Link>
            <Link href={`/${lang}/garage/payments`}>Payments</Link>
            <Link href={`/${lang}/garage/waitlist`}>Waitlist</Link>
            <Link href={`/${lang}/garage/stripe-connect`}>Stripe setup</Link>
            <Link href={`/${lang}/garage/onboarding`}>Garage profile</Link>
            <Link href={`/${lang}/garage/staff`}>Staff</Link>
          </div>
          <LanguageSwitcher lang={lang} />
          <LogoutButton lang={lang} />
        </div>
      </div>
    );
  }

  if (profile.role === "super_admin") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Welcome, {profile.full_name || profile.email}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Role: {profile.role}
          </p>
          <div className="flex gap-4 text-sm font-medium underline">
            <Link href={`/${lang}/admin/stats`}>Overview</Link>
            <Link href={`/${lang}/admin/garages`}>Garages</Link>
          </div>
          <LanguageSwitcher lang={lang} />
          <LogoutButton lang={lang} />
        </div>
      </div>
    );
  }

  const { booked } = await searchParams;
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, status, services(name), garages!appointments_garage_id_fkey(name)"
    )
    .eq("client_id", profile.id)
    .order("start_time", { ascending: true });

  const rows = (appointments ?? []) as unknown as Appointment[];
  const upcoming = rows.filter(isUpcoming);
  const other = rows.filter((appointment) => !isUpcoming(appointment));

  const completedIds = rows
    .filter((appointment) => appointment.status === "completed")
    .map((appointment) => appointment.id);

  const invoiceUrls = new Map<string, string>();
  if (completedIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("appointment_id, file_path")
      .in("appointment_id", completedIds);

    for (const invoice of invoices ?? []) {
      const { data } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.file_path, 60 * 10);
      if (data?.signedUrl) {
        invoiceUrls.set(invoice.appointment_id, data.signedUrl);
      }
    }
  }

  const reviewedAppointmentIds = new Set<string>();
  if (completedIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("appointment_id")
      .in("appointment_id", completedIds);

    for (const review of reviews ?? []) {
      reviewedAppointmentIds.add(review.appointment_id);
    }
  }

  const { data: waitlistEntries } = await supabase
    .from("waitlist")
    .select(
      "id, date, notified_at, services(name), garages(name)"
    )
    .eq("client_id", profile.id)
    .order("date", { ascending: true });

  const waitlistRows = (waitlistEntries ?? []) as unknown as {
    id: string;
    date: string;
    notified_at: string | null;
    services: { name: string } | null;
    garages: { name: string } | null;
  }[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              Welcome, {profile.full_name || profile.email}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {profile.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/${lang}/garages`}
              className="text-sm font-medium underline"
            >
              Browse garages
            </Link>
            <LanguageSwitcher lang={lang} />
            <LogoutButton lang={lang} />
          </div>
        </div>

        {booked === "1" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            Your appointment is booked.
          </p>
        )}

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            Upcoming
          </h2>
          {upcoming.length > 0 ? (
            upcoming.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                lang={lang}
                cancellable
              />
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No upcoming appointments.{" "}
              <Link href={`/${lang}/garages`} className="underline">
                Browse garages
              </Link>{" "}
              to book one.
            </p>
          )}
        </div>

        {waitlistRows.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Waitlist
            </h2>
            {waitlistRows.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    {entry.services?.name ?? "Service"}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    with {entry.garages?.name ?? "Garage"} on{" "}
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </p>
                  {entry.notified_at && (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
                      A slot may have opened up &mdash; check availability.
                    </p>
                  )}
                </div>
                <form action={leaveWaitlist}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    Leave
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {other.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              Past &amp; cancelled
            </h2>
            {other.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                lang={lang}
                invoiceUrl={invoiceUrls.get(appointment.id)}
                reviewable={
                  appointment.status === "completed" &&
                  !reviewedAppointmentIds.has(appointment.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
