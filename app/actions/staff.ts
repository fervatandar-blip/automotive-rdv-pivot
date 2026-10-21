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
  const admin = createAdminClient();

  // If this email already belongs to a platform user, attach them as staff
  // instead of trying (and failing) to create a duplicate auth account.
  // Goes through a narrow SECURITY DEFINER accessor (id + role only, exact
  // email match) rather than a direct `profiles` select -- see
  // 0026_profile_privacy_and_security_definer_hardening.sql, which
  // restricts `profiles` reads to self/admin/related-garage-member and
  // would otherwise block this lookup entirely (there's no relationship
  // between this garage and a not-yet-invited email). Called via the
  // service-role client: 0032_revoke_public_rpc_execute.sql revokes it from
  // every API-facing role, since anyone holding the anon key could
  // otherwise enumerate accounts by email. Safe here because
  // requireGarageOwner (above) already gated the caller.
  const { data: matches, error: lookupError } = await admin.rpc(
    "find_invitable_profile_by_email",
    { target_email: email }
  );

  if (lookupError) {
    return { message: "Could not check for an existing account. Try again." };
  }

  const existingProfile = matches?.[0] ?? null;

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
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role: "mecanicien" },
    redirectTo: `${origin}/auth/callback?next=${nextPath}`,
  });

  if (error || !data.user) {
    return { message: error?.message ?? "Could not send the invite." };
  }

  // handle_new_user() (supabase/migrations/0030_restrict_self_signup_roles.sql)
  // no longer grants 'mecanicien' from invite metadata -- that trigger now
  // unconditionally restricts the self-signup-derived role to
  // client/admin_garage, since it can't distinguish this admin-invite call
  // from a public signUp() call using the same metadata shape. The freshly
  // created profile lands as 'client'; elevate it explicitly here instead,
  // via the same service-role client already used for the invite above.
  // This is safe specifically because this code path is only reachable by
  // an authenticated garage owner (requireGarageOwner, above).
  const { error: roleError } = await admin
    .from("profiles")
    .update({ role: "mecanicien" })
    .eq("id", data.user.id);

  if (roleError) {
    return {
      message:
        "Invite sent, but granting mécanicien access failed. Contact support.",
    };
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
