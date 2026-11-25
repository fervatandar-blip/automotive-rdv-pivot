import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE } from "@/lib/timezone";

type AppointmentRow = {
  id: string;
  start_time: string;
  services: { name: string } | null;
  client: { full_name: string } | null;
};

type MessageRow = {
  appointment_id: string;
  body: string;
  created_at: string;
};

function formatDateTime(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function GarageMessagesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageMessages;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name)"
    )
    .eq("garage_id", garage.id)
    // Walk-in customers (0038) have no RDV account, so no message thread.
    .not("client_id", "is", null)
    .order("start_time", { ascending: false });

  const appointmentRows = (appointments ?? []) as unknown as AppointmentRow[];
  const appointmentIds = appointmentRows.map((appointment) => appointment.id);

  // No simple "latest row per group" in PostgREST without a view/RPC --
  // fetch every message for this garage's appointments (already sorted
  // newest first) and keep only the first one seen per appointment.
  const latestByAppointment = new Map<string, MessageRow>();
  if (appointmentIds.length > 0) {
    const { data: messages } = await supabase
      .from("messages")
      .select("appointment_id, body, created_at")
      .in("appointment_id", appointmentIds)
      .order("created_at", { ascending: false });

    for (const message of (messages ?? []) as MessageRow[]) {
      if (!latestByAppointment.has(message.appointment_id)) {
        latestByAppointment.set(message.appointment_id, message);
      }
    }
  }

  const threads = appointmentRows
    .map((appointment) => ({
      appointment,
      lastMessage: latestByAppointment.get(appointment.id) ?? null,
    }))
    .sort((a, b) => {
      const aTime = a.lastMessage?.created_at ?? a.appointment.start_time;
      const bTime = b.lastMessage?.created_at ?? b.appointment.start_time;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {d.title}
        </h1>

        <div className="flex flex-col gap-3">
          {threads.length > 0 ? (
            threads.map(({ appointment, lastMessage }) => (
              <Link
                key={appointment.id}
                href={`/${lang}/appointments/${appointment.id}/messages`}
                className="flex flex-col gap-1 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4 transition-colors hover:border-brand-600 hover:bg-brand-50 dark:hover:border-brand-500 dark:hover:bg-brand-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink">
                    {appointment.client?.full_name ?? d.clientFallback}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatDateTime(
                      lastMessage?.created_at ?? appointment.start_time,
                      dateLocale
                    )}
                  </span>
                </div>
                <p className="text-sm text-ink-muted">
                  {appointment.services?.name ?? d.serviceFallback}
                </p>
                <p className="mt-1 truncate text-sm text-ink-muted">
                  {lastMessage?.body ?? d.noMessagesYet}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-ink-muted">
              {d.noConversationsYet}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
