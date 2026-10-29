import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { retryInvoiceGeneration } from "@/app/actions/appointments";
import { APP_TIME_ZONE } from "@/lib/timezone";

type InvoiceRow = {
  id: string;
  appointment_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issued_at: string;
  file_path: string;
  appointments: {
    services: { name: string } | null;
    client: { full_name: string } | null;
    walk_in?: { full_name: string } | null;
  } | null;
};

type CompletedAppointmentRow = {
  id: string;
  start_time: string;
  services: { name: string } | null;
  client: { full_name: string } | null;
  walk_in?: { full_name: string } | null;
};

type PaymentRow = {
  id: string;
  amount: number;
  commission_amount: number;
  payout_amount: number;
  currency: string;
  status: string;
  created_at: string;
  appointments: {
    services: { name: string } | null;
    client: { full_name: string } | null;
    walk_in?: { full_name: string } | null;
  } | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-LU", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount);
}

const STATUS_BADGE: Record<string, string> = {
  succeeded: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  refunded: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
  failed: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function GarageInvoicesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageInvoices;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const [{ data: invoices }, { data: payments }, { data: completedAppointments }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, appointment_id, invoice_number, amount, currency, issued_at, file_path, appointments(services(name), client:profiles!appointments_client_id_fkey(full_name), walk_in:garage_customers(full_name))"
        )
        .eq("garage_id", garage.id)
        .order("issued_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, amount, commission_amount, payout_amount, currency, status, created_at, appointments(services(name), client:profiles!appointments_client_id_fkey(full_name))"
        )
        .eq("garage_id", garage.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select(
          "id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name), walk_in:garage_customers(full_name)"
        )
        .eq("garage_id", garage.id)
        .eq("status", "completed")
        .order("start_time", { ascending: false }),
    ]);

  const invoiceRows = (invoices ?? []) as unknown as InvoiceRow[];
  const paymentRows = (payments ?? []) as unknown as PaymentRow[];
  const completedAppointmentRows = (completedAppointments ??
    []) as unknown as CompletedAppointmentRow[];

  // generateInvoice (app/actions/appointments.ts) is best-effort: a PDF
  // render or Storage failure leaves a completed appointment with no
  // invoice and no other visible sign anything went wrong. Diffed
  // client-side rather than a NOT IN subquery, matching the pattern
  // already used elsewhere in this app for the same kind of "per-parent
  // latest/missing child row" problem (see garage/messages/page.tsx).
  const invoicedAppointmentIds = new Set(
    invoiceRows.map((invoice) => invoice.appointment_id)
  );
  const missingInvoiceAppointments = completedAppointmentRows.filter(
    (appointment) => !invoicedAppointmentIds.has(appointment.id)
  );

  // One batched Storage call instead of one sequential round-trip per
  // invoice -- createSignedUrls preserves input order, so results line up
  // with invoiceRows by index.
  const signedUrls = new Map<string, string>();
  if (invoiceRows.length > 0) {
    const { data: signedUrlResults } = await supabase.storage
      .from("invoices")
      .createSignedUrls(
        invoiceRows.map((invoice) => invoice.file_path),
        60 * 10
      );

    signedUrlResults?.forEach((result, index) => {
      if (result.signedUrl) {
        signedUrls.set(invoiceRows[index].id, result.signedUrl);
      }
    });
  }

  const succeededPayments = paymentRows.filter(
    (payment) => payment.status === "succeeded"
  );
  const totalRevenue = succeededPayments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0
  );
  const totalCommission = succeededPayments.reduce(
    (sum, payment) => sum + Number(payment.commission_amount),
    0
  );
  const totalPayout = succeededPayments.reduce(
    (sum, payment) => sum + Number(payment.payout_amount),
    0
  );

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {garage.name} &mdash; {d.titleSuffix}
        </h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              {d.totalRevenue}
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalRevenue, "eur")}
            </p>
          </div>
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              {d.totalCommission}
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalCommission, "eur")}
            </p>
          </div>
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              {d.totalPayout}
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalPayout, "eur")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            {d.payments}
          </h2>
          {paymentRows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noPaymentsYet}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {paymentRows.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <div>
                    <h3 className="font-semibold text-black dark:text-zinc-50">
                      {payment.appointments?.services?.name ?? d.serviceFallback}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {payment.appointments?.client?.full_name ?? d.clientFallback}{" "}
                      &middot;{" "}
                      {new Date(payment.created_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {d.charged} {formatMoney(payment.amount, payment.currency)}{" "}
                      &middot; {d.commission}{" "}
                      {formatMoney(
                        payment.commission_amount,
                        payment.currency
                      )}{" "}
                      &middot; {d.payout}{" "}
                      <span className="font-medium">
                        {formatMoney(payment.payout_amount, payment.currency)}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[payment.status] ?? ""}`}
                  >
                    {d.paymentStatus[
                      payment.status as keyof typeof d.paymentStatus
                    ] ?? payment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {missingInvoiceAppointments.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
              {d.missingInvoices}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.missingInvoicesDescription}
            </p>
            <div className="flex flex-col gap-3">
              {missingInvoiceAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-900 dark:bg-amber-950"
                >
                  <div>
                    <h3 className="font-semibold text-black dark:text-zinc-50">
                      {appointment.services?.name ?? d.serviceFallback}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {appointment.client?.full_name ?? appointment.walk_in?.full_name ?? d.clientFallback} &middot;{" "}
                      {new Date(appointment.start_time).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    </p>
                  </div>
                  <form action={retryInvoiceGeneration}>
                    <input type="hidden" name="id" value={appointment.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <button
                      type="submit"
                      className="rounded-full border border-amber-300 bg-white px-4 py-1.5 text-sm font-medium transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-950 dark:hover:bg-amber-900"
                    >
                      {d.generateInvoice}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            {d.invoices}
          </h2>
          {invoiceRows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noInvoicesYet}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {invoiceRows.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <div>
                    <h3 className="font-semibold text-black dark:text-zinc-50">
                      {invoice.invoice_number}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {invoice.appointments?.services?.name ?? d.serviceFallback}{" "}
                      {d.for}{" "}
                      {invoice.appointments?.client?.full_name ??
                        invoice.appointments?.walk_in?.full_name ??
                        d.clientFallbackLowercase}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatMoney(invoice.amount, invoice.currency)}{" "}
                      &middot;{" "}
                      {new Date(invoice.issued_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    </p>
                  </div>
                  {signedUrls.has(invoice.id) && (
                    <a
                      href={signedUrls.get(invoice.id)}
                      className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                    >
                      {d.download}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
