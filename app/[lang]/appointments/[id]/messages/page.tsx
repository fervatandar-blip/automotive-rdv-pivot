import Link from "next/link";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ChatThread } from "@/components/chat-thread";

export default async function AppointmentMessagesPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang: rawLang, id: appointmentId } = await params;
  const lang = resolveLocale(rawLang);
  const user = await getAuthedUser(lang);

  const supabase = await createClient();

  // RLS ("Participants can update their appointments") already restricts
  // this to the client who booked it or a member of the garage it belongs
  // to -- anyone else gets no row back, same pattern as the reschedule page.
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, client_id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name), garages(name)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    notFound();
  }

  const service = appointment.services as unknown as { name: string } | null;
  const client = appointment.client as unknown as { full_name: string } | null;
  const garage = appointment.garages as unknown as { name: string } | null;

  if (!client || !garage) {
    notFound();
  }

  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, body, created_at")
    .eq("appointment_id", appointmentId)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {service?.name ?? "Appointment"}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {client.full_name} &middot; {garage.name}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
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

        <ChatThread
          appointmentId={appointmentId}
          currentUserId={user.id}
          clientId={appointment.client_id}
          clientName={client.full_name}
          garageName={garage.name}
          initialMessages={messages ?? []}
        />
      </div>
    </div>
  );
}
