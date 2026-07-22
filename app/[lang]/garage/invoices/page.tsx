import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issued_at: string;
  file_path: string;
  appointments: {
    services: { name: string } | null;
    client: { full_name: string } | null;
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
  const supabase = await createClient();

  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase
      .from("invoices")
      .select(
        "id, invoice_number, amount, currency, issued_at, file_path, appointments(services(name), client:profiles!appointments_client_id_fkey(full_name))"
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

  const signedUrls = new Map<string, string>();
  for (const invoice of invoiceRows) {
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoice.file_path, 60 * 10);
    if (data?.signedUrl) signedUrls.set(invoice.id, data.signedUrl);
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
          {garage.name} &mdash; Invoices &amp; Financials
        </h1>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Total revenue
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalRevenue, "eur")}
            </p>
          </div>
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Total commission
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalCommission, "eur")}
            </p>
          </div>
          <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
              Total payout to date
            </p>
            <p className="mt-1 text-xl font-semibold text-black dark:text-zinc-50">
              {formatMoney(totalPayout, "eur")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Payments
          </h2>
          {paymentRows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No payments yet.
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
                      {payment.appointments?.services?.name ?? "Service"}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {payment.appointments?.client?.full_name ?? "Client"}{" "}
                      &middot;{" "}
                      {new Date(payment.created_at).toLocaleDateString()}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      Charged {formatMoney(payment.amount, payment.currency)}{" "}
                      &middot; commission{" "}
                      {formatMoney(
                        payment.commission_amount,
                        payment.currency
                      )}{" "}
                      &middot; payout{" "}
                      <span className="font-medium">
                        {formatMoney(payment.payout_amount, payment.currency)}
                      </span>
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[payment.status] ?? ""}`}
                  >
                    {payment.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
            Invoices
          </h2>
          {invoiceRows.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No invoices yet.
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
                      {invoice.appointments?.services?.name ?? "Service"} for{" "}
                      {invoice.appointments?.client?.full_name ?? "client"}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {formatMoney(invoice.amount, invoice.currency)}{" "}
                      &middot;{" "}
                      {new Date(invoice.issued_at).toLocaleDateString()}
                    </p>
                  </div>
                  {signedUrls.has(invoice.id) && (
                    <a
                      href={signedUrls.get(invoice.id)}
                      className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                    >
                      Download
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
