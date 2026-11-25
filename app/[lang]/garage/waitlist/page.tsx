import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { removeWaitlistEntry } from "@/app/actions/waitlist";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";

type WaitlistRow = {
  id: string;
  date: string;
  created_at: string;
  notified_at: string | null;
  services: { name: string } | null;
  client: { full_name: string; email: string } | null;
};

export default async function GarageWaitlistPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageWaitlist;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("waitlist")
    .select(
      "id, date, created_at, notified_at, services(name), client:profiles!waitlist_client_id_fkey(full_name, email)"
    )
    .eq("garage_id", garage.id)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });

  const rows = (entries ?? []) as unknown as WaitlistRow[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-canvas px-6 py-12 sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              <ArrowLeft aria-hidden className="mr-1 inline h-4 w-4 align-[-3px]" strokeWidth={2} />{d.backToDashboard}
            </Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-ink">
              {garage.name} &mdash; {d.waitlistSuffix}
            </h1>
            <p className="mt-1 text-sm text-ink-muted">
              {d.description}
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {d.noOneWaiting}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-6"
              >
                <div>
                  <h3 className="font-semibold text-ink">
                    {entry.services?.name ?? d.serviceFallback} &mdash;{" "}
                    {dateKeyToDisplayDate(entry.date).toLocaleDateString(
                      dateLocale,
                      { timeZone: APP_TIME_ZONE, weekday: "short", month: "short", day: "numeric" }
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-ink-muted">
                    {entry.client?.full_name ?? d.clientFallback}<span aria-hidden className="mx-2 inline-block h-1 w-1 rounded-full bg-current align-middle opacity-40" />
                    {entry.client?.email ?? ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {d.joined}{" "}
                    {new Date(entry.created_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                    {entry.notified_at &&
                      ` · ${d.notified} ${new Date(entry.notified_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}`}
                  </p>
                </div>
                <form action={removeWaitlistEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:hover:bg-[#1a1a1a]"
                  >
                    {d.remove}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
