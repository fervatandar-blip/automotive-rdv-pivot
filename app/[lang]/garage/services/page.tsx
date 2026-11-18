import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { AddServiceForm } from "./add-service-form";
import { ServiceRow, type Service } from "./service-row";

export default async function GarageServicesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageServices;
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, pricing_type, price")
    .eq("garage_id", garage.id)
    .order("created_at", { ascending: true });

  const rows = (services ?? []) as Service[];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{d.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{d.subtitle}</p>
        </header>

        <section aria-labelledby="service-list-title" className="flex flex-col">
          <h2 id="service-list-title" className="text-base font-semibold text-black dark:text-zinc-50">
            {d.listTitle}
          </h2>
          {rows.length > 0 ? (
            <ul className="mt-2 divide-y divide-zinc-200/80 dark:divide-zinc-800/50">
              {rows.map((service) => (
                <ServiceRow key={service.id} service={service} d={d} priceLabels={dictionary.servicePrice} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{d.noServicesYet}</p>
          )}
        </section>

        <AddServiceForm d={d} />
      </div>
    </div>
  );
}
