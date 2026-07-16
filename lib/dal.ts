import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n/config";

export const getAuthedUser = cache(async (locale: Locale) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  return user;
});

export const getAuthedProfile = cache(async (locale: Locale) => {
  const user = await getAuthedUser(locale);
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name, email")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect(`/${locale}/login`);
  }

  return profile;
});

/**
 * Resolves the garage a client_garage/mecanicien profile belongs to (owner
 * or staff), or null if they have no garage association (e.g. a mecanicien
 * who was removed from staff). Never redirects — callers that need a garage
 * to proceed should use requireGarageMember instead; this non-throwing
 * version exists for /dashboard itself, which can't redirect to its own
 * route without looping.
 */
export const getGarageMembership = cache(async (locale: Locale) => {
  const profile = await getAuthedProfile(locale);

  if (profile.role !== "admin_garage" && profile.role !== "mecanicien") {
    return null;
  }

  const supabase = await createClient();

  const { data: ownedGarage } = await supabase
    .from("garages")
    .select("*")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (ownedGarage) {
    return { profile, garage: ownedGarage, isOwner: true as const };
  }

  const { data: staffRow } = await supabase
    .from("garage_staff")
    .select("garages(*)")
    .eq("profile_id", profile.id)
    .maybeSingle();

  const staffGarage = staffRow?.garages as
    | NonNullable<typeof ownedGarage>
    | null
    | undefined;

  if (staffGarage) {
    return { profile, garage: staffGarage, isOwner: false as const };
  }

  return null;
});

/**
 * Like getGarageMembership, but redirects to the dashboard when there's no
 * garage. Safe for every garage-scoped page EXCEPT /dashboard itself.
 */
export const requireGarageMember = cache(async (locale: Locale) => {
  const membership = await getGarageMembership(locale);

  if (!membership) {
    redirect(`/${locale}/dashboard`);
  }

  return membership;
});

/** Like requireGarageMember, but only the owner (not staff) may proceed. */
export const requireGarageOwner = cache(async (locale: Locale) => {
  const result = await requireGarageMember(locale);

  if (!result.isOwner) {
    redirect(`/${locale}/dashboard`);
  }

  return result;
});

export const requireSuperAdmin = cache(async (locale: Locale) => {
  const profile = await getAuthedProfile(locale);

  if (profile.role !== "super_admin") {
    redirect(`/${locale}/dashboard`);
  }

  return profile;
});
