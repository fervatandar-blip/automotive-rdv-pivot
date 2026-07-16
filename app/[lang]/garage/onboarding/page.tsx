import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { OnboardingForm } from "./onboarding-form";

export default async function GarageOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);
  const { saved } = await searchParams;
  const supabase = await createClient();

  const [{ data: brands }, { data: specialties }, { data: selectedBrands }, { data: selectedSpecialties }] =
    await Promise.all([
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("specialties").select("id, name").order("name"),
      supabase
        .from("garage_brands")
        .select("brand_id")
        .eq("garage_id", garage.id),
      supabase
        .from("garage_specialties")
        .select("specialty_id")
        .eq("garage_id", garage.id),
    ]);

  return (
    <OnboardingForm
      lang={lang}
      garage={garage}
      brands={brands ?? []}
      specialties={specialties ?? []}
      selectedBrandIds={(selectedBrands ?? []).map((row) => row.brand_id)}
      selectedSpecialtyIds={(selectedSpecialties ?? []).map(
        (row) => row.specialty_id
      )}
      justSaved={saved === "1"}
    />
  );
}
