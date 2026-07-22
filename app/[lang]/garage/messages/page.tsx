import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";

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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
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
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name)"
    )
    .eq("garage_id", garage.id)
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
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Messages
        </h1>

        <div className="flex flex-col gap-3">
          {threads.length > 0 ? (
            threads.map(({ appointment, lastMessage }) => (
              <Link
                key={appointment.id}
                href={`/${lang}/appointments/${appointment.id}/messages`}
                className="flex flex-col gap-1 rounded-xl border border-black/[.08] bg-white p-4 transition-colors hover:border-brand-600 hover:bg-brand-50 dark:border-white/[.145] dark:bg-zinc-950 dark:hover:border-brand-500 dark:hover:bg-brand-950"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-black dark:text-zinc-50">
                    {appointment.client?.full_name ?? "Client"}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-500">
                    {formatDateTime(
                      lastMessage?.created_at ?? appointment.start_time
                    )}
                  </span>
                </div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {appointment.services?.name ?? "Service"}
                </p>
                <p className="mt-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
                  {lastMessage?.body ?? "No messages yet"}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No conversations yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
