"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/dal";
import { locales, parseLocale, defaultLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { GarageLeadFormSchema, type GarageLeadFormState } from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function submitGarageLead(
  state: GarageLeadFormState,
  formData: FormData
): Promise<GarageLeadFormState> {
  // The phone field is submitted as two parts (a calling-code select plus
  // the number itself) but stored as a single string -- no schema change
  // needed, just combined before validation.
  const phoneNumber = formData.get("phone");
  const phoneCountryCode = formData.get("phoneCountryCode");
  const combinedPhone =
    typeof phoneNumber === "string" && phoneNumber.trim()
      ? `${typeof phoneCountryCode === "string" ? phoneCountryCode : ""} ${phoneNumber.trim()}`.trim()
      : undefined;

  const validatedFields = GarageLeadFormSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    businessEmail: formData.get("businessEmail"),
    phone: combinedPhone,
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

export async function markLeadContacted(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  await supabase
    .from("garage_leads")
    .update({ status: "contacted" })
    .eq("id", id);

  revalidateLocalizedPath("/admin/leads");
}

export async function archiveLead(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) return;

  const supabase = await createClient();
  await supabase
    .from("garage_leads")
    .update({ status: "archived" })
    .eq("id", id);

  revalidateLocalizedPath("/admin/leads");
}

export async function convertLeadToAccount(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    redirect(`/${lang}/admin/leads?error=invalid`);
  }

  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("garage_leads")
    .select(
      "id, first_name, last_name, business_email, garage_name, country, status"
    )
    .eq("id", id)
    .single();

  if (!lead) {
    redirect(`/${lang}/admin/leads?error=not-found`);
  }

  // If this email already belongs to a platform user, don't silently no-op
  // -- surface it so an admin can resolve it manually (e.g. attach staff
  // instead), same guard inviteMechanic uses for the equivalent case.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", lead.business_email)
    .maybeSingle();

  if (existingProfile) {
    redirect(`/${lang}/admin/leads?error=exists`);
  }

  const origin = await getOrigin();
  const nextPath = encodeURIComponent(`/${defaultLocale}/set-password`);
  const admin = createAdminClient();
  const { data: inviteData, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(lead.business_email, {
      data: {
        full_name: `${lead.first_name} ${lead.last_name}`,
        role: "admin_garage",
      },
      redirectTo: `${origin}/auth/callback?next=${nextPath}`,
    });

  if (inviteError || !inviteData.user) {
    redirect(`/${lang}/admin/leads?error=invite-failed`);
  }

  // handle_new_user() auto-creates a garages row for the new admin_garage
  // user, named after their full_name (not the actual business) with
  // country defaulting to 'LU' -- rename/re-country it to match the lead.
  const { data: garage } = await supabase
    .from("garages")
    .select("id")
    .eq("owner_id", inviteData.user.id)
    .maybeSingle();

  if (!garage) {
    redirect(`/${lang}/admin/leads?error=garage-missing`);
  }

  await supabase
    .from("garages")
    .update({ name: lead.garage_name, country: lead.country })
    .eq("id", garage.id);

  const { error: leadUpdateError } = await supabase
    .from("garage_leads")
    .update({ status: "converted", converted_garage_id: garage.id })
    .eq("id", lead.id);

  if (leadUpdateError) {
    redirect(`/${lang}/admin/leads?error=lead-update-failed`);
  }

  revalidateLocalizedPath("/admin/leads");
  redirect(`/${lang}/admin/leads?converted=1`);
}
