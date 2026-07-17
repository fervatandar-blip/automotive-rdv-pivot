"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale, defaultLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import {
  InviteMechanicFormSchema,
  type InviteMechanicFormState,
} from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function inviteMechanic(
  state: InviteMechanicFormState,
  formData: FormData
): Promise<InviteMechanicFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  const validatedFields = InviteMechanicFormSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { fullName, email } = validatedFields.data;
  const supabase = await createClient();

  // If this email already belongs to a platform user, attach them as staff
  // instead of trying (and failing) to create a duplicate auth account.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.role !== "mecanicien") {
      return {
        message: "That email already belongs to a non-mécanicien account.",
      };
    }

    const { error: staffError } = await supabase
      .from("garage_staff")
      .insert({ garage_id: garage.id, profile_id: existingProfile.id });

    if (staffError) {
      return {
        message:
          staffError.code === "23505"
            ? "They're already on your staff."
            : staffError.message,
      };
    }

    revalidateLocalizedPath("/garage/staff");
    return {};
  }

  const origin = await getOrigin();
  const nextPath = encodeURIComponent(`/${defaultLocale}/set-password`);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "mecanicien" },
    redirectTo: `${origin}/auth/callback?next=${nextPath}`,
  });

  if (error || !data.user) {
    return { message: error?.message ?? "Could not send the invite." };
  }

  const { error: staffError } = await supabase
    .from("garage_staff")
    .insert({ garage_id: garage.id, profile_id: data.user.id });

  if (staffError) {
    return { message: staffError.message };
  }

  revalidateLocalizedPath("/garage/staff");
  return {};
}

export async function removeMechanic(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);
  const profileId = formData.get("profileId");

  if (typeof profileId !== "string" || !profileId) return;

  const supabase = await createClient();
  await supabase
    .from("garage_staff")
    .delete()
    .eq("garage_id", garage.id)
    .eq("profile_id", profileId);

  revalidateLocalizedPath("/garage/staff");
}
