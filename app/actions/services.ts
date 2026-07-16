"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { ServiceFormSchema, type ServiceFormState } from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function createService(
  state: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);

  const validatedFields = ServiceFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, durationMinutes, price } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.from("services").insert({
    garage_id: garage.id,
    name,
    description,
    duration_minutes: durationMinutes,
    price,
  });

  if (error) {
    return { message: error.message };
  }

  revalidateLocalizedPath("/garage/services");
  return {};
}

export async function updateService(
  state: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return { message: "Missing service id." };
  }

  const validatedFields = ServiceFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    durationMinutes: formData.get("durationMinutes"),
    price: formData.get("price"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { name, description, durationMinutes, price } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("services")
    .update({
      name,
      description,
      duration_minutes: durationMinutes,
      price,
    })
    .eq("id", id)
    .eq("garage_id", garage.id);

  if (error) {
    return { message: error.message };
  }

  revalidateLocalizedPath("/garage/services");
  return {};
}

export async function deleteService(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/services");
}
