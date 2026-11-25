"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { ReviewFormSchema } from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function submitReview(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);

  const validatedFields = ReviewFormSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    rating: formData.get("rating"),
    comment: formData.get("comment") || undefined,
  });

  if (!validatedFields.success) {
    redirect(`/${lang}/appointments?tab=past&reviewError=1`);
  }

  const { appointmentId, rating, comment } = validatedFields.data;
  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("garage_id")
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    redirect(`/${lang}/appointments?tab=past&reviewError=1`);
  }

  // Previously discarded: a duplicate review attempt (reviews.appointment_id
  // is unique -- one review per appointment) or an RLS rejection both
  // silently no-opped, leaving the client with no idea their review wasn't
  // saved.
  const { error } = await supabase.from("reviews").insert({
    appointment_id: appointmentId,
    garage_id: appointment.garage_id,
    client_id: user.id,
    rating,
    comment: comment ?? null,
  });

  if (error) {
    redirect(
      `/${lang}/appointments?tab=past&reviewError=${error.code === "23505" ? "duplicate" : "1"}`
    );
  }

  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/appointments");
  revalidateLocalizedPath(`/garages/${appointment.garage_id}`);
}
