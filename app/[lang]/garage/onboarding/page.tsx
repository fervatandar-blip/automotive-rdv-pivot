import { redirect } from "next/navigation";
import { requireGarageOwner } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { OnboardingForm } from "./onboarding-form";

/**
 * First-run setup wizard only. Once a garage has completed it, its profile
 * is edited section by section on /garage/profile instead -- an established
 * garage fixing a phone number shouldn't have to step through setup again.
 */
export default async function GarageOnboardingPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageOwner(lang);

  if (garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/profile`);
  }

  const dictionary = await getDictionary(lang);
  const supabase = await createClient();

  const [{ data: brands }, { data: specialties }, { data: selectedBrands }, { data: selectedSpecialties }] =
    await Promise.all([
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("specialties").select("id, name").order("name"),
      supabase.from("garage_brands").select("brand_id").eq("garage_id", garage.id),
      supabase.from("garage_specialties").select("specialty_id").eq("garage_id", garage.id),
    ]);

  return (
    <OnboardingForm
      lang={lang}
      dictionary={dictionary.garageOnboarding}
      garage={garage}
      brands={brands ?? []}
      specialties={specialties ?? []}
      selectedBrandIds={(selectedBrands ?? []).map((row) => row.brand_id)}
      selectedSpecialtyIds={(selectedSpecialties ?? []).map((row) => row.specialty_id)}
    />
  );
}
