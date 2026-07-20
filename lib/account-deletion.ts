import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30;

// Anonymizes a profile in place -- never cascade-deletes it. profiles.id is
// the root of an on-delete-cascade chain that reaches invoices, payments,
// and (via garages.owner_id) an entire garage's records, including other
// clients' financial history. Deleting the row -- or the auth.users row it
// references -- would destroy legally-retained records that don't belong
// to this user alone. Scrubbing identity fields in place, with everything
// still pointing at the same id, is the only safe way to fulfill an
// erasure request without touching anyone else's data.
export async function processAccountDeletion(profileId: string) {
  const admin = createAdminClient();
  const tombstoneEmail = `deleted-${profileId}@rdv.invalid`;

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .single();

  if (!profile) return;

  // Low-sensitivity data tied only to this profile, with no other party
  // depending on it for a legal/financial record -- safe to hard-delete.
  await admin.from("vehicles").delete().eq("client_id", profileId);
  await admin.from("device_tokens").delete().eq("profile_id", profileId);
  await admin.from("waitlist").delete().eq("client_id", profileId);
  await admin.from("garage_staff").delete().eq("profile_id", profileId);

  if (profile.role === "admin_garage") {
    const { data: garages } = await admin
      .from("garages")
      .select("id")
      .eq("owner_id", profileId);

    for (const garage of garages ?? []) {
      await admin
        .from("garages")
        .update({
          name: "Closed garage",
          description: null,
          address: null,
          phone: null,
          email: null,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", garage.id);
    }
  }

  await admin
    .from("profiles")
    .update({
      full_name: "Deleted user",
      email: tombstoneEmail,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", profileId);

  // Blocks login without deleting the auth.users row, which would cascade
  // to profiles and everything downstream of it.
  await admin.auth.admin.updateUserById(profileId, {
    email: tombstoneEmail,
    ban_duration: "87600h",
  });
}
