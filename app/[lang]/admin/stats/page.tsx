import Link from "next/link";
import type { ReactNode } from "react";
import { requireSuperAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { averageRating } from "@/lib/ratings";
import {
  processAccountDeletionNow,
  runRetentionSweepNow,
} from "@/app/actions/account";

async function headCount(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
  column: string,
  value: string
) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, value);
  return count ?? 0;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function StatSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        {title}
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  );
}

export default async function AdminStatsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  await requireSuperAdmin(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.adminStats;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const [
    garagesPending,
    garagesApproved,
    garagesRejected,
    clients,
    garageAdmins,
    mecaniciens,
    appointmentsPending,
    appointmentsConfirmed,
    appointmentsCompleted,
    appointmentsCancelled,
    pendingDocuments,
    { data: reviews },
    { data: invoices },
    { data: payments },
  ] = await Promise.all([
    headCount(supabase, "garages", "status", "pending"),
    headCount(supabase, "garages", "status", "approved"),
    headCount(supabase, "garages", "status", "rejected"),
    headCount(supabase, "profiles", "role", "client"),
    headCount(supabase, "profiles", "role", "admin_garage"),
    headCount(supabase, "profiles", "role", "mecanicien"),
    headCount(supabase, "appointments", "status", "pending"),
    headCount(supabase, "appointments", "status", "confirmed"),
    headCount(supabase, "appointments", "status", "completed"),
    headCount(supabase, "appointments", "status", "cancelled"),
    headCount(supabase, "garage_documents", "status", "pending"),
    supabase.from("reviews").select("rating"),
    supabase.from("invoices").select("amount"),
    supabase.from("payments").select("commission_amount").eq("status", "succeeded"),
  ]);

  const { data: pendingDeletions } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, deletion_requested_at")
    .not("deletion_requested_at", "is", null)
    .is("deleted_at", null)
    .order("deletion_requested_at", { ascending: true });

  const ratings = (reviews ?? []).map((review) => review.rating);
  const avgRating = averageRating(ratings);
  const totalRevenue = (invoices ?? []).reduce(
    (sum, invoice) => sum + Number(invoice.amount),
    0
  );
  const totalCommission = (payments ?? []).reduce(
    (sum, payment) => sum + Number(payment.commission_amount),
    0
  );

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              {d.title}
            </h1>
            <Link
              href={`/${lang}/admin/garages`}
              className="text-sm font-medium underline"
            >
              {d.garagesListLink} &rarr;
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <form action={runRetentionSweepNow}>
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
              >
                {d.runRetentionSweep}
              </button>
            </form>
            <LanguageSwitcher lang={lang} />
          </div>
        </div>

        <StatSection title={d.garagesSection}>
          <StatTile label={d.pending} value={garagesPending} />
          <StatTile label={d.approved} value={garagesApproved} />
          <StatTile label={d.rejected} value={garagesRejected} />
        </StatSection>

        <StatSection title={d.peopleSection}>
          <StatTile label={d.clients} value={clients} />
          <StatTile label={d.garageAdmins} value={garageAdmins} />
          <StatTile label={d.mecaniciens} value={mecaniciens} />
        </StatSection>

        <StatSection title={d.appointmentsSection}>
          <StatTile label={d.pending} value={appointmentsPending} />
          <StatTile label={d.confirmed} value={appointmentsConfirmed} />
          <StatTile label={d.completed} value={appointmentsCompleted} />
          <StatTile label={d.cancelled} value={appointmentsCancelled} />
        </StatSection>

        <StatSection title={d.revenueSection}>
          <StatTile
            label={d.invoicedRevenue}
            value={new Intl.NumberFormat("fr-LU", {
              style: "currency",
              currency: "EUR",
            }).format(totalRevenue)}
          />
          <StatTile
            label={d.platformCommission}
            value={new Intl.NumberFormat("fr-LU", {
              style: "currency",
              currency: "EUR",
            }).format(totalCommission)}
          />
          <StatTile
            label={d.averageRating}
            value={avgRating === null ? "—" : avgRating.toFixed(1)}
          />
          <StatTile label={d.totalReviews} value={ratings.length} />
          <StatTile
            label={d.documentsAwaitingReview}
            value={pendingDocuments}
          />
        </StatSection>

        {pendingDeletions && pendingDeletions.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.pendingDeletionsSection}
            </h2>
            <div className="flex flex-col gap-3">
              {pendingDeletions.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <div>
                    <p className="font-medium text-black dark:text-zinc-50">
                      {request.full_name}{" "}
                      <span className="font-normal text-zinc-500 dark:text-zinc-500">
                        &middot; {request.role}
                      </span>
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {request.email}
                    </p>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {d.requestedPrefix}{" "}
                      {new Date(
                        request.deletion_requested_at as string
                      ).toLocaleDateString(dateLocale)}
                    </p>
                  </div>
                  <form action={processAccountDeletionNow}>
                    <input type="hidden" name="profileId" value={request.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <button
                      type="submit"
                      className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                    >
                      {d.processNow}
                    </button>
                  </form>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
