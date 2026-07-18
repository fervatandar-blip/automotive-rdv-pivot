import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { removeWaitlistEntry } from "@/app/actions/waitlist";

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
              {garage.name} &mdash; waitlist
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Clients waiting for a slot to open up on a fully booked or
              closed date.
            </p>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        {rows.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No one is on the waitlist right now.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {rows.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    {entry.services?.name ?? "Service"} &mdash;{" "}
                    {new Date(`${entry.date}T00:00:00`).toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {entry.client?.full_name ?? "Client"} &middot;{" "}
                    {entry.client?.email ?? ""}
                  </p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Joined {new Date(entry.created_at).toLocaleDateString()}
                    {entry.notified_at &&
                      ` · Notified ${new Date(entry.notified_at).toLocaleDateString()}`}
                  </p>
                </div>
                <form action={removeWaitlistEntry}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    Remove
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
