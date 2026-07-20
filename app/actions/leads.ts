"use server";

import { createClient } from "@/lib/supabase/server";
import { GarageLeadFormSchema, type GarageLeadFormState } from "@/lib/definitions";

export async function submitGarageLead(
  state: GarageLeadFormState,
  formData: FormData
): Promise<GarageLeadFormState> {
  const validatedFields = GarageLeadFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    businessEmail: formData.get("businessEmail"),
    phone: formData.get("phone") || undefined,
    garageName: formData.get("garageName"),
    country: formData.get("country"),
    garageSizeType: formData.get("garageSizeType") || undefined,
    message: formData.get("message") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const {
    firstName,
    lastName,
    businessEmail,
    phone,
    garageName,
    country,
    garageSizeType,
    message,
  } = validatedFields.data;

  // Public submission -- the session-scoped client runs as the anon role
  // here, allowed by "Anyone can submit a garage lead" (0022_garage_leads.sql).
  const supabase = await createClient();
  const { error } = await supabase.from("garage_leads").insert({
    first_name: firstName,
    last_name: lastName,
    business_email: businessEmail,
    phone: phone ?? null,
    garage_name: garageName,
    country,
    garage_size_type: garageSizeType ?? null,
    message: message ?? null,
  });

  if (error) {
    return { errors: {} };
  }

  return { success: true };
}
