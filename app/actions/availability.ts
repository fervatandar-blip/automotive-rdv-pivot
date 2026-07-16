"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  AvailabilityFormSchema,
  type AvailabilityFormState,
} from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function createAvailability(
  state: AvailabilityFormState,
  formData: FormData
): Promise<AvailabilityFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);

  const validatedFields = AvailabilityFormSchema.safeParse({
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { dayOfWeek, startTime, endTime } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.from("availability").insert({
    garage_id: garage.id,
    day_of_week: dayOfWeek,
    start_time: startTime,
    end_time: endTime,
  });

  if (error) {
    return { message: error.message };
  }

  revalidateLocalizedPath("/garage/availability");
  return {};
}

export async function deleteAvailability(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("availability")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/availability");
}
