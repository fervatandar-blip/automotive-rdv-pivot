import Link from "next/link";
import { requireSuperAdmin } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";

const STATUS_BADGE: Record<string, string> = {
  pending:
    "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  approved:
    "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-400",
  rejected: "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-400",
};

export default async function AdminGaragesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  await requireSuperAdmin(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.adminGarages;
  const nav = dictionary.adminNav;
  const supabase = await createClient();

  const { data: garages } = await supabase
    .from("garages")
    .select("id, name, city, status, verification_level, created_at")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

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

        <div className="flex flex-col gap-3">
          {garages && garages.length > 0 ? (
            garages.map((garage) => (
              <Link
                key={garage.id}
                href={`/${lang}/admin/garages/${garage.id}`}
                className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-4 transition-colors hover:bg-subtle"
              >
                <div>
                  <p className="font-medium text-ink">
                    {garage.name}
                  </p>
                  <p className="text-sm text-ink-muted">
                    {garage.city ?? d.noCitySet}<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />
                    {garage.verification_level}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[garage.status] ?? ""}`}
                >
                  {d.statusLabels[garage.status as keyof typeof d.statusLabels] ??
                    garage.status}
                </span>
              </Link>
            ))
          ) : (
            <p className="text-sm text-ink-muted">
              {d.noGaragesYet}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
