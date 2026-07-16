import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";

type InvoiceRow = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issued_at: string;
  file_path: string;
  appointments: {
    start_time: string;
    services: { name: string } | null;
    client: { full_name: string } | null;
  } | null;
};

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-LU", { style: "currency", currency }).format(
    amount
  );
}

export default async function GarageInvoicesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const supabase = await createClient();

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, amount, currency, issued_at, file_path, appointments(start_time, services(name), client:profiles!appointments_client_id_fkey(full_name))"
    )
    .eq("garage_id", garage.id)
    .order("issued_at", { ascending: false });

  const rows = (invoices ?? []) as unknown as InvoiceRow[];

  const signedUrls = new Map<string, string>();
  for (const invoice of rows) {
    const { data } = await supabase.storage
      .from("invoices")
      .createSignedUrl(invoice.file_path, 60 * 10);
    if (data?.signedUrl) signedUrls.set(invoice.id, data.signedUrl);
  }

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
              {garage.name} &mdash; invoices
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Generated automatically when an appointment is marked complete.
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No invoices yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((invoice) => (
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
                    {formatMoney(invoice.amount, invoice.currency)} &middot;{" "}
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
  );
}
