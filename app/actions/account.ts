"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireSuperAdmin } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { processAccountDeletion } from "@/lib/account-deletion";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export async function requestAccountDeletion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", user.id);

  revalidateLocalizedPath("/account");
}

export async function cancelAccountDeletion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("id", user.id);

  revalidateLocalizedPath("/account");
}

export async function processAccountDeletionNow(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireSuperAdmin(lang);

  const profileId = formData.get("profileId");
  if (typeof profileId !== "string" || !profileId) {
    return;
  }

  await processAccountDeletion(profileId);

  revalidateLocalizedPath("/admin/stats");
}
