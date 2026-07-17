import Link from "next/link";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";

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

export default async function GaragePaymentsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const supabase = await createClient();

  const { data: payments } = await supabase
    .from("payments")
    .select(
      "id, amount, commission_amount, payout_amount, currency, status, created_at, appointments(services(name), client:profiles!appointments_client_id_fkey(full_name))"
    )
    .eq("garage_id", garage.id)
    .order("created_at", { ascending: false });

  const rows = (payments ?? []) as unknown as PaymentRow[];
  const totalPayout = rows
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number(payment.payout_amount), 0);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {garage.name} &mdash; payments
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Total payout to date:{" "}
              <span className="font-medium">
                {formatMoney(totalPayout, "eur")}
              </span>
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No payments yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((payment) => (
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
                    &middot; {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Charged {formatMoney(payment.amount, payment.currency)}{" "}
                    &middot; commission{" "}
                    {formatMoney(payment.commission_amount, payment.currency)}
                    {" "}&middot; payout{" "}
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
    </div>
  );
}
