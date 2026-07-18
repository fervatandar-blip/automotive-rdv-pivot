"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser, requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { WaitlistFormSchema } from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function joinWaitlist(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);

  const validatedFields = WaitlistFormSchema.safeParse({
    garageId: formData.get("garageId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
  });

  if (!validatedFields.success) {
    return;
  }

  const { garageId, serviceId, date } = validatedFields.data;
  const supabase = await createClient();

  // A duplicate join (already on the list for this garage/service/date) is
  // not an error -- the unique constraint just no-ops it below.
  await supabase.from("waitlist").insert({
    garage_id: garageId,
    client_id: user.id,
    service_id: serviceId,
    date,
  });

  revalidateLocalizedPath("/dashboard");
  redirect(
    `/${lang}/garages/${garageId}?service=${serviceId}&date=${date}&waitlisted=1`
  );
}

export async function leaveWaitlist(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("waitlist")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id);

  revalidateLocalizedPath("/dashboard");
}

export async function removeWaitlistEntry(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("waitlist")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/waitlist");
}
