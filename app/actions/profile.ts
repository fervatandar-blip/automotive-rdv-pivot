"use server";

import * as z from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/lib/i18n/config";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

// Mirrors the 0044 check constraints so users get a field error instead of
// a generic failure. Error values are dictionary keys (account.errors.*).
const PHONE_PATTERN = /^[0-9+()./ -]+$/;

const ProfileDetailsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, { error: "nameTooShort" })
    .max(120, { error: "nameTooLong" }),
  phone: z
    .string()
    .trim()
    .max(40, { error: "phoneInvalid" })
    .refine((value) => value === "" || (value.length >= 6 && PHONE_PATTERN.test(value)), {
      error: "phoneInvalid",
    }),
});

export type ProfileDetailsState =
  | {
      errors?: { fullName?: string[]; phone?: string[] };
      status?: "saved" | "error";
    }
  | undefined;

export async function updateProfileDetails(
  _state: ProfileDetailsState,
  formData: FormData
): Promise<ProfileDetailsState> {
  const parsed = ProfileDetailsSchema.safeParse({
    fullName: formData.get("fullName") ?? "",
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };

  // RLS pins the row to the caller; 0044's column grants pin the columns.
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] details update failed:", error);
    return { status: "error" };
  }

  revalidateLocalizedPath("/account");
  revalidateLocalizedPath("/dashboard");
  return { status: "saved" };
}

export type NotificationPrefsState = { status?: "saved" | "error" } | undefined;

export async function updateNotificationPreferences(
  _state: NotificationPrefsState,
  formData: FormData
): Promise<NotificationPrefsState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error" };

  // Unchecked checkboxes are absent from the form: absent means off.
  const { error } = await supabase
    .from("profiles")
    .update({
      notify_repair_updates: formData.get("repairUpdates") === "on",
      notify_waitlist: formData.get("waitlist") === "on",
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] notification preferences update failed:", error);
    return { status: "error" };
  }

  revalidateLocalizedPath("/account");
  return { status: "saved" };
}
