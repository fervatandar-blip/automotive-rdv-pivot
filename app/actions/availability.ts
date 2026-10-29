"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  AvailabilityFormSchema,
  type AvailabilityFormState,
  AvailabilityOverrideFormSchema,
  type AvailabilityOverrideFormState,
} from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function createAvailability(
  state: AvailabilityFormState,
  formData: FormData
): Promise<AvailabilityFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);

  const validatedFields = AvailabilityFormSchema.safeParse({
    days: formData.getAll("days"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { days, startTime, endTime } = validatedFields.data;
  const supabase = await createClient();

  // All-or-nothing across the chosen days: report every day that already
  // has an overlapping window and add none, rather than silently applying
  // the window to only some of them. The availability_no_overlap
  // constraint (0035) still guards the race between this check and the
  // insert.
  const { data: existing, error: existingError } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("garage_id", garage.id)
    .in("day_of_week", days);

  if (existingError) {
    return { message: existingError.message };
  }

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);
  const conflictDays = [
    ...new Set(
      (existing ?? [])
        .filter(
          (window) =>
            toMinutes(window.start_time) < newEnd && newStart < toMinutes(window.end_time)
        )
        .map((window) => window.day_of_week)
    ),
  ].sort();

  if (conflictDays.length > 0) {
    return { conflictDays };
  }

  const { error } = await supabase.from("availability").insert(
    days.map((day) => ({
      garage_id: garage.id,
      day_of_week: day,
      start_time: startTime,
      end_time: endTime,
    }))
  );

  if (error) {
    return {
      message:
        error.code === "23P01"
          ? "That window overlaps hours that were just added. Refresh and try again."
          : error.message,
    };
  }

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/profile");
  return { added: days.length };
}

export async function deleteAvailability(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("availability")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/profile");
}

export async function createAvailabilityOverride(
  state: AvailabilityOverrideFormState,
  formData: FormData
): Promise<AvailabilityOverrideFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const isClosed = formData.get("isClosed") === "on";

  const validatedFields = AvailabilityOverrideFormSchema.safeParse({
    date: formData.get("date"),
    isClosed,
    startTime: formData.get("startTime") || undefined,
    endTime: formData.get("endTime") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { date, startTime, endTime } = validatedFields.data;
  const supabase = await createClient();

  // Replace, not add to, any existing override for this date. There's no DB
  // uniqueness on (garage_id, date) yet (see supabase/migrations/0029 --
  // written but not applied, needs a management token to run), so without
  // this a second submission for the same date -- e.g. switching it from
  // "closed" to custom hours without deleting the old row first -- leaves
  // both rows in place. getAvailableSlotsForDate unions every override row
  // for a date together, so the stale row keeps silently affecting what's
  // actually bookable.
  const { error: deleteError } = await supabase
    .from("availability_overrides")
    .delete()
    .eq("garage_id", garage.id)
    .eq("date", date);

  if (deleteError) {
    return { message: deleteError.message };
  }

  const { error } = await supabase.from("availability_overrides").insert({
    garage_id: garage.id,
    date,
    is_closed: isClosed,
    start_time: isClosed ? null : startTime,
    end_time: isClosed ? null : endTime,
  });

  if (error) {
    return { message: error.message };
  }

  revalidateLocalizedPath("/garage/availability");
  return {};
}

export async function deleteAvailabilityOverride(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("availability_overrides")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/availability");
}
