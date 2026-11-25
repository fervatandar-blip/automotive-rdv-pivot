import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
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

  const [{ data: invoices }, { data: payments }] =
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
    ]);

  const invoiceRows = (invoices ?? []) as unknown as InvoiceRow[];
  const paymentRows = (payments ?? []) as unknown as PaymentRow[];
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
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {garage.name} &mdash; {d.titleSuffix}
        </h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {d.totalRevenue}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {formatMoney(totalRevenue, "eur")}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {d.totalCommission}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {formatMoney(totalCommission, "eur")}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
              {d.totalPayout}
            </p>
            <p className="mt-1 text-xl font-semibold text-ink">
              {formatMoney(totalPayout, "eur")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">
            {d.payments}
          </h2>
          {paymentRows.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {d.noPaymentsYet}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {paymentRows.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-6"
                >
                  <div>
                    <h3 className="font-semibold text-ink">
                      {payment.appointments?.services?.name ?? d.serviceFallback}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {payment.appointments?.client?.full_name ?? d.clientFallback}{" "}
<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />
                      {new Date(payment.created_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {d.charged} {formatMoney(payment.amount, payment.currency)}{" "}
<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />{d.commission}{" "}
                      {formatMoney(
                        payment.commission_amount,
                        payment.currency
                      )}{" "}
<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />{d.payout}{" "}
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

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-ink">
            {d.invoices}
          </h2>
          {invoiceRows.length === 0 ? (
            <p className="text-sm text-ink-muted">
              {d.noInvoicesYet}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {invoiceRows.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-6"
                >
                  <div>
                    <h3 className="font-semibold text-ink">
                      {invoice.invoice_number}
                    </h3>
                    <p className="mt-1 text-sm text-ink-muted">
                      {invoice.appointments?.services?.name ?? d.serviceFallback}{" "}
                      {d.for}{" "}
                      {invoice.appointments?.client?.full_name ??
                        invoice.appointments?.walk_in?.full_name ??
                        d.clientFallbackLowercase}
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {formatMoney(invoice.amount, invoice.currency)}{" "}
<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />
                      {new Date(invoice.issued_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    </p>
                  </div>
                  {signedUrls.has(invoice.id) && (
                    <a
                      href={signedUrls.get(invoice.id)}
                      className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
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
