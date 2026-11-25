import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { requireSuperAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { COUNTRY_NAMES } from "@/lib/business-registration";
import { GARAGE_SIZE_TYPE_LABELS } from "@/lib/definitions";
import {
  markLeadContacted,
  archiveLead,
  convertLeadToAccount,
} from "@/app/actions/leads";
import { APP_TIME_ZONE } from "@/lib/timezone";

const STATUS_BADGE: Record<string, string> = {
  new: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  contacted:
    "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400",
  converted:
    "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  archived: "bg-subtle text-ink-muted",
};

type LeadRow = {
  id: string;
  first_name: string;
  last_name: string;
  business_email: string;
  phone: string | null;
  garage_name: string;
  country: string;
  garage_size_type: string | null;
  message: string | null;
  status: string;
  converted_garage_id: string | null;
  created_at: string;
};

export default async function AdminLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ error?: string; converted?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  await requireSuperAdmin(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.adminLeads;
  const nav = dictionary.adminNav;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const { error, converted } = await searchParams;
  const supabase = await createClient();

  const { data: leads } = await supabase
    .from("garage_leads")
    .select(
      "id, first_name, last_name, business_email, phone, garage_name, country, garage_size_type, message, status, converted_garage_id, created_at"
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const rows = (leads ?? []) as LeadRow[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-ink">
              {d.title}
            </h1>
            <div className="mt-1 flex gap-4 text-sm font-medium underline">
              <Link href={`/${lang}/admin/stats`}>{nav.overview}</Link>
              <Link href={`/${lang}/admin/garages`}>{nav.garages}</Link>
              <Link href={`/${lang}/admin/leads`}>{nav.leads}</Link>
            </div>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {error && d.errors[error as keyof typeof d.errors] && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {d.errors[error as keyof typeof d.errors]}
          </p>
        )}

        {converted === "1" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {d.leadConvertedNotice}
          </p>
        )}

        <div className="flex flex-col gap-3">
          {rows.length > 0 ? (
            rows.map((lead) => (
              <div
                key={lead.id}
                className="flex flex-col gap-3 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">
                      {lead.first_name} {lead.last_name}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {lead.business_email}
                      {lead.phone ? ` · ${lead.phone}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[lead.status] ?? ""}`}
                  >
                    {d.statusLabels[lead.status as keyof typeof d.statusLabels] ??
                      lead.status}
                  </span>
                </div>

                <p className="text-sm text-ink-muted">
                  {lead.garage_name}<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />
                  {COUNTRY_NAMES[lead.country as keyof typeof COUNTRY_NAMES] ??
                    lead.country}
                  {lead.garage_size_type
                    ? ` · ${
                        GARAGE_SIZE_TYPE_LABELS[
                          lead.garage_size_type as keyof typeof GARAGE_SIZE_TYPE_LABELS
                        ] ?? lead.garage_size_type
                      }`
                    : ""}
                </p>

                {lead.message && (
                  <p className="text-sm text-ink-muted">
                    {lead.message}
                  </p>
                )}

                <p className="text-xs text-ink-muted">
                  {d.submittedPrefix}{" "}
                  {new Date(lead.created_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                </p>

                {lead.status === "converted" && lead.converted_garage_id ? (
                  <Link
                    href={`/${lang}/admin/garages/${lead.converted_garage_id}`}
                    className="self-start text-sm font-medium underline"
                  >
                    {d.viewGarage}<ArrowRight aria-hidden className="ml-1 inline h-4 w-4 align-[-3px]" strokeWidth={2} />
                  </Link>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <form action={markLeadContacted}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="lang" value={lang} />
                      <button
                        type="submit"
                        className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                      >
                        {d.markContacted}
                      </button>
                    </form>
                    <form action={convertLeadToAccount}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="lang" value={lang} />
                      <button
                        type="submit"
                        className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                      >
                        {d.convertToAccount}
                      </button>
                    </form>
                    <form action={archiveLead}>
                      <input type="hidden" name="id" value={lead.id} />
                      <input type="hidden" name="lang" value={lang} />
                      <button
                        type="submit"
                        className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                      >
                        {d.archive}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-muted">
              {d.noLeadsYet}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
