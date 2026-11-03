import { CalendarClock, Car, Receipt, Star, Wrench } from "lucide-react";
import { anonymizeGarageCustomer } from "@/app/actions/walk-ins";
import { DrawerShell } from "@/components/drawer-shell";
import type { DirectoryClient } from "@/lib/client-directory";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { AddVehicleForm, ClientDetailsCard } from "./client-forms";

type D = Dictionary["garageClients"];

/** garage_client_notes (0042), as the page reads it. */
export type ClientNotes = {
  notes: string | null;
  is_vip: boolean;
  preferred_contact_time: string | null;
  phone: string | null;
  updated_at: string;
};

export type TimelineEntry =
  | {
      kind: "job";
      id: string;
      at: string;
      endAt: string;
      status: string;
      title: string;
      mechanic: string | null;
      plate: string | null;
      vehicle: string | null;
    }
  | {
      kind: "invoice";
      id: string;
      at: string;
      number: string;
      amount: number;
      currency: string;
      // Short-lived signed Storage URL; null if signing failed.
      url: string | null;
    };

const PLATE_PILL =
  "inline-flex items-center rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

const STATUS_TEXT: Record<string, string> = {
  confirmed: "text-green-700 dark:text-green-400",
  pending: "text-amber-700 dark:text-amber-400",
  completed: "text-zinc-600 dark:text-zinc-400",
  cancelled: "text-red-700 dark:text-red-400",
};

/**
 * The client's slide-over panel in the directory: contact and notes
 * (editable), vehicles (+ add, for the garage's own customers), and a
 * single timeline of jobs and invoices, newest first.
 */
export function ClientDrawer({
  client,
  notes,
  timeline,
  brands,
  closeHref,
  startInEdit,
  lang,
  dateLocale,
  d,
  addClientD,
  statusLabels,
}: {
  client: DirectoryClient;
  notes: ClientNotes | null;
  timeline: TimelineEntry[];
  brands: { id: string; name: string }[];
  closeHref: string;
  startInEdit: boolean;
  lang: Locale;
  dateLocale: string;
  d: D;
  addClientD: Dictionary["addClient"];
  statusLabels: Dictionary["common"]["appointmentStatus"];
}) {
  const dateTime = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateOnly = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(dateLocale, { style: "currency", currency }).format(amount);
  const now = new Date().toISOString();
  const upcoming = timeline.filter(
    (entry) => entry.kind === "job" && entry.at > now && (entry.status === "pending" || entry.status === "confirmed")
  );

  return (
    <DrawerShell closeHref={closeHref} closeLabel={d.close} title={client.name}>
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {client.isVip && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <Star aria-hidden className="h-3 w-3 fill-current" />
              {d.vip}
            </span>
          )}
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {client.kind === "walk_in" ? d.walkInBadge : d.rdvClientBadge}
          </span>
          <span className="text-zinc-500 dark:text-zinc-400">
            {client.appointmentCount} {client.appointmentCount === 1 ? d.appointment : d.appointments}
          </span>
        </div>

        {upcoming.length > 0 && (
          <div className="flex items-start gap-2.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-900 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-200">
            <CalendarClock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {d.nextBookingOn.replace("{date}", dateTime.format(new Date(upcoming[upcoming.length - 1].at)))}
            </span>
          </div>
        )}

        <ClientDetailsCard
          lang={lang}
          d={d}
          startInEdit={startInEdit}
          values={{
            kind: client.kind,
            subjectId: client.subjectId,
            name: client.name,
            email: client.email,
            phone: client.phone,
            notes: notes?.notes ?? null,
            preferredContactTime: notes?.preferred_contact_time ?? null,
            isVip: notes?.is_vip ?? false,
            anonymized: client.anonymized,
          }}
        />

        <section aria-labelledby="client-vehicles" className="flex flex-col gap-3">
          <h3 id="client-vehicles" className="text-sm font-semibold text-black dark:text-zinc-50">
            {d.vehiclesTitle}
          </h3>
          {client.vehicles.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {client.vehicles.map((vehicle) => (
                <li
                  key={vehicle.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <Car aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
                  <span className="font-medium text-black dark:text-zinc-50">{vehicle.label}</span>
                  {vehicle.licensePlate && <span className={PLATE_PILL}>{vehicle.licensePlate}</span>}
                  {vehicle.vin && (
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">VIN {vehicle.vin}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.noVehicles}</p>
          )}
          {client.kind === "walk_in" && !client.anonymized ? (
            <AddVehicleForm
              lang={lang}
              d={d}
              addClientD={addClientD}
              customerId={client.subjectId}
              brands={brands}
            />
          ) : client.kind === "client" ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.clientVehiclesNote}</p>
          ) : null}
        </section>

        <section aria-labelledby="client-history" className="flex flex-col gap-3">
          <h3 id="client-history" className="text-sm font-semibold text-black dark:text-zinc-50">
            {d.historyTitle}
          </h3>
          {timeline.length === 0 ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.noHistory}</p>
          ) : (
            <ol className="relative flex flex-col gap-4 border-l border-zinc-200 pl-5 dark:border-zinc-800">
              {timeline.map((entry) => (
                <li key={`${entry.kind}:${entry.id}`} className="relative">
                  <span
                    aria-hidden
                    className="absolute -left-[1.85rem] flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400"
                  >
                    {entry.kind === "job" ? <Wrench className="h-3 w-3" /> : <Receipt className="h-3 w-3" />}
                  </span>
                  {entry.kind === "job" ? (
                    <div className="flex flex-col gap-0.5">
                      <p className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-medium text-black dark:text-zinc-50">{entry.title}</span>
                        <span className={`text-xs font-medium ${STATUS_TEXT[entry.status] ?? STATUS_TEXT.pending}`}>
                          {statusLabels[entry.status as keyof typeof statusLabels] ?? entry.status}
                        </span>
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {dateTime.format(new Date(entry.at))}
                        {entry.mechanic && ` · ${entry.mechanic}`}
                      </p>
                      {(entry.plate || entry.vehicle) && (
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                          {entry.plate && <span className={PLATE_PILL}>{entry.plate}</span>}
                          {entry.vehicle}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-black dark:text-zinc-50">
                          {d.invoiceNumber.replace("{number}", entry.number)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {dateOnly.format(new Date(entry.at))} · {money(entry.amount, entry.currency)}
                        </p>
                      </div>
                      {entry.url && (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {d.downloadInvoice}
                        </a>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {client.kind === "walk_in" && !client.anonymized && (
          <details className="rounded-lg border border-red-200 px-3 py-2 text-sm dark:border-red-500/20">
            <summary className="cursor-pointer font-medium text-red-700 dark:text-red-400">{d.anonymize}</summary>
            <form action={anonymizeGarageCustomer} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="lang" value={lang} />
              <input type="hidden" name="customerId" value={client.subjectId} />
              <p className="text-zinc-600 dark:text-zinc-400">{d.anonymizeConfirm}</p>
              <button
                type="submit"
                className="self-start rounded-full border border-red-200 px-3 py-1 font-medium text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {d.anonymize}
              </button>
            </form>
          </details>
        )}
      </div>
    </DrawerShell>
  );
}
