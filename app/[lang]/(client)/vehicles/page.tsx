import Link from "next/link";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { deleteVehicle } from "@/app/actions/vehicles";
import { AddVehicleForm } from "./add-vehicle-form";

type VehicleRow = {
  id: string;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  brands: { name: string } | null;
};

export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const user = await getAuthedUser(lang);
  const supabase = await createClient();

  const [{ data: vehicles }, { data: brands }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, model, year, license_plate, brands(name)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("brands").select("id, name").order("name"),
  ]);

  const rows = (vehicles ?? []) as unknown as VehicleRow[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              My vehicles
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <AddVehicleForm brands={brands ?? []} />

        <div className="flex flex-col gap-3">
          {rows.length > 0 ? (
            rows.map((vehicle) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    {[vehicle.brands?.name, vehicle.model]
                      .filter(Boolean)
                      .join(" ") || "Vehicle"}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {[vehicle.year, vehicle.license_plate]
                      .filter(Boolean)
                      .join(" · ") || "No details added"}
                  </p>
                </div>
                <form action={deleteVehicle}>
                  <input type="hidden" name="id" value={vehicle.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    Delete
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No vehicles saved yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
