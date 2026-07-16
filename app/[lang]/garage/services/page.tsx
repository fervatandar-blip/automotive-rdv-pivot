import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
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
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("services")
    .select("id, name, description, duration_minutes, price")
    .eq("garage_id", garage.id)
    .order("created_at", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {garage.name} &mdash; services
          </h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex gap-4 underline">
              <Link href={`/${lang}/garage/calendar`}>Calendar</Link>
              <Link href={`/${lang}/garage/availability`}>
                Manage availability
              </Link>
            </div>
            <LanguageSwitcher lang={lang} />
          </div>
        </div>

        <AddServiceForm />

        <div className="flex flex-col gap-4">
          {services && services.length > 0 ? (
            (services as Service[]).map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              You haven&apos;t added any services yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
