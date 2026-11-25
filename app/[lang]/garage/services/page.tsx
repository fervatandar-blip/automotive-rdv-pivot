import { requireGarageMember } from "@/lib/dal";
import { CLIENT_CARD } from "@/lib/client-ui";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { groupServicesByCategory } from "@/lib/service-categories";
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
    .select("id, name, description, category, duration_minutes")
    .eq("garage_id", garage.id)
    .order("created_at", { ascending: true });

  const rows = (services ?? []) as Service[];
  const groups = groupServicesByCategory(rows);
  const categoryLabels = dictionary.serviceCategories;

  return (
    <div className="flex flex-1 flex-col bg-canvas px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{d.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{d.subtitle}</p>
        </header>

        <section aria-labelledby="service-list-title" className="flex flex-col">
          <h2 id="service-list-title" className="text-base font-semibold text-ink">
            {d.listTitle}
          </h2>
          {groups.length > 0 ? (
            <div className="mt-2 flex flex-col gap-6">
              {groups.map((group) => (
                <section
                  key={group.category}
                  aria-labelledby={`category-${group.category}`}
                  className={`${CLIENT_CARD} px-5 pt-4 sm:px-6`}
                >
                  <h3
                    id={`category-${group.category}`}
                    className="flex items-center gap-2 border-b border-hairline pb-3 text-base font-bold tracking-tight text-ink"
                  >
                    {categoryLabels[group.category]}
                    <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
                      {group.services.length}
                    </span>
                  </h3>
                  <ul className="divide-y divide-hairline">
                    {group.services.map((service) => (
                      <ServiceRow
                        key={service.id}
                        service={service}
                        d={d}
                        categoryLabels={categoryLabels}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-ink-muted">{d.noServicesYet}</p>
          )}
        </section>

        <AddServiceForm d={d} categoryLabels={categoryLabels} />
      </div>
    </div>
  );
}
