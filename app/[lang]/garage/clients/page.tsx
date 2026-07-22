import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";

type AppointmentClientRow = {
  client_id: string;
  client: { full_name: string; email: string } | null;
};

export default async function GarageClientsPage({
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
      "client_id, client:profiles!appointments_client_id_fkey(full_name, email)"
    )
    .eq("garage_id", garage.id);

  const rows = (appointments ?? []) as unknown as AppointmentClientRow[];

  const clientMap = new Map<
    string,
    { name: string; email: string; appointmentCount: number }
  >();
  for (const row of rows) {
    if (!row.client) continue;
    const existing = clientMap.get(row.client_id);
    if (existing) {
      existing.appointmentCount += 1;
    } else {
      clientMap.set(row.client_id, {
        name: row.client.full_name,
        email: row.client.email,
        appointmentCount: 1,
      });
    }
  }

  const clients = Array.from(clientMap.entries())
    .map(([id, value]) => ({ id, ...value }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Clients
        </h1>

        <div className="flex flex-col gap-3">
          {clients.length > 0 ? (
            clients.map((client) => (
              <div
                key={client.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {client.name}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {client.email}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-black/[.04] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
                  {client.appointmentCount}{" "}
                  {client.appointmentCount === 1
                    ? "appointment"
                    : "appointments"}
                </span>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No clients yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
