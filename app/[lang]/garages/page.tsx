import Link from "next/link";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";

export default async function GaragesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  await getAuthedUser(lang);
  const supabase = await createClient();

  const { data: garages } = await supabase
    .from("garages")
    .select("id, name, city, services(id)")
    .eq("status", "approved")
    .order("name", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Browse garages
          </h1>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-col gap-4">
          {garages && garages.length > 0 ? (
            garages.map((garage) => (
              <Link
                key={garage.id}
                href={`/${lang}/garages/${garage.id}`}
                className="rounded-xl border border-black/[.08] bg-white p-6 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
              >
                <h2 className="font-semibold text-black dark:text-zinc-50">
                  {garage.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {garage.city ? `${garage.city} · ` : ""}
                  {garage.services.length}{" "}
                  {garage.services.length === 1 ? "service" : "services"}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No garages yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
