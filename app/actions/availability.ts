"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  AvailabilityBlockFormSchema,
  type AvailabilityBlockFormState,
} from "@/lib/definitions";
import { windowsFromWeekForm, type DayForm, type DayFormError } from "@/lib/opening-hours";
import {
  addDaysToDateKey,
  todayKeyInAppZone,
  zonedDateTimeToUtc,
  zonedStartOfDay,
} from "@/lib/timezone";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
// Longest closure added in one go (e.g. a summer break).
const MAX_CLOSED_DAYS = 92;

export type WeeklyHoursState =
  | {
      saved?: boolean;
      // Per day of week (0 = Sunday): the first problem, a key into
      // dictionary.garageAvailability.dayErrors.
      dayErrors?: Partial<Record<number, DayFormError>>;
      // Key into dictionary.garageAvailability.errors.
      message?: "invalid" | "saveFailed";
    }
  | undefined;

function parseWeek(raw: FormDataEntryValue | null): DayForm[] | null {
  if (typeof raw !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || value.length !== 7) return null;
  const days: DayForm[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) return null;
    const day = entry as Record<string, unknown>;
    if (
      !Number.isInteger(day.dayOfWeek) ||
      (day.dayOfWeek as number) < 0 ||
      (day.dayOfWeek as number) > 6 ||
      typeof day.open !== "boolean" ||
      typeof day.lunch !== "boolean" ||
      !["opens", "closes", "lunchStart", "lunchEnd"].every((key) => typeof day[key] === "string")
    ) {
      return null;
    }
    days.push({
      dayOfWeek: day.dayOfWeek as number,
      open: day.open,
      opens: day.opens as string,
      closes: day.closes as string,
      lunch: day.lunch,
      lunchStart: day.lunchStart as string,
      lunchEnd: day.lunchEnd as string,
      extraRanges: false,
    });
  }
  // Each day exactly once.
  if (new Set(days.map((day) => day.dayOfWeek)).size !== 7) return null;
  return days;
}

/**
 * Saves the whole weekly schedule from the Working hours form in one
 * transaction (set_weekly_availability, 0043): either every day is saved
 * or nothing changes. A day with a lunch break becomes two windows.
 */
export async function saveWeeklyHours(
  state: WeeklyHoursState,
  formData: FormData
): Promise<WeeklyHoursState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);

  const days = parseWeek(formData.get("week"));
  if (!days) return { message: "invalid" };

  const { windows, errors } = windowsFromWeekForm(days);
  if (Object.keys(errors).length > 0) return { dayErrors: errors };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_weekly_availability", {
    target_garage_id: garage.id,
    windows,
  });
  if (error) {
    console.error("[availability] set_weekly_availability failed:", error);
    return { message: "saveFailed" };
  }

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/profile");
  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");
  return { saved: true };
}

export type ClosedDatesState =
  | {
      // Keys into dictionary.garageAvailability.errors.
      errors?: { from?: string[]; to?: string[] };
      message?: "saveFailed";
      added?: { from: string; to: string; days: number; overlapping: number };
      values?: { from?: string; to?: string };
    }
  | undefined;

function daysBetween(from: string, to: string) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/**
 * Closes the garage for a date or a run of dates (holidays, a summer
 * break): one closed override (0012) per date, replacing any special hours
 * already set for those dates (unique per date, 0029). Existing bookings
 * are kept; the count is returned so the form can warn.
 */
export async function addClosedDates(
  state: ClosedDatesState,
  formData: FormData
): Promise<ClosedDatesState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const fromRaw = formData.get("from");
  const toRaw = formData.get("to");
  const from = typeof fromRaw === "string" ? fromRaw : "";
  const to = typeof toRaw === "string" && toRaw ? toRaw : from;
  const values = { from, to: typeof toRaw === "string" ? toRaw : "" };

  if (!DATE_KEY.test(from)) return { errors: { from: ["dateInvalid"] }, values };
  if (!DATE_KEY.test(to)) return { errors: { to: ["dateInvalid"] }, values };
  if (from < todayKeyInAppZone()) return { errors: { from: ["datePast"] }, values };
  if (to < from) return { errors: { to: ["toBeforeFrom"] }, values };
  const days = daysBetween(from, to) + 1;
  if (days > MAX_CLOSED_DAYS) return { errors: { to: ["rangeTooLong"] }, values };

  const rows = Array.from({ length: days }, (_, index) => ({
    garage_id: garage.id,
    date: addDaysToDateKey(from, index),
    is_closed: true,
    start_time: null,
    end_time: null,
  }));

  const supabase = await createClient();
  const { error } = await supabase
    .from("availability_overrides")
    .upsert(rows, { onConflict: "garage_id,date" });
  if (error) {
    console.error("[availability] closed dates upsert failed:", error);
    return { message: "saveFailed", values };
  }

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", garage.id)
    .in("status", ["pending_payment", "pending", "confirmed"])
    .gte("start_time", zonedStartOfDay(from).toISOString())
    .lt("start_time", zonedStartOfDay(addDaysToDateKey(to, 1)).toISOString());

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");
  return { added: { from, to, days, overlapping: count ?? 0 } };
}

/** Reopens a closed date or run of dates (deletes their closed overrides). */
export async function removeClosedDates(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const from = formData.get("from");
  const to = formData.get("to");
  if (typeof from !== "string" || typeof to !== "string" || !DATE_KEY.test(from) || !DATE_KEY.test(to)) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("availability_overrides")
    .delete()
    .eq("garage_id", garage.id)
    .eq("is_closed", true)
    .gte("date", from)
    .lte("date", to);

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");
}

/** Removes a one-off special-hours override (older data; the form only adds closures now). */
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

/**
 * Blocks part of one date (availability_blocks, 0039). Wall-clock times are
 * resolved to instants here, in the garage's zone. Overlapping blocks are
 * refused by the exclusion constraint (23P01). Existing appointments inside
 * the block are kept; the count is returned so the form can warn the
 * garage to reschedule them.
 */
export async function createAvailabilityBlock(
  state: AvailabilityBlockFormState,
  formData: FormData
): Promise<AvailabilityBlockFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage, profile } = await requireGarageMember(lang);

  const reason = formData.get("reason");
  const values: Record<string, string> = {};
  for (const field of ["date", "startTime", "endTime", "reason"]) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  const validated = AvailabilityBlockFormSchema.safeParse({
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    reason: typeof reason === "string" && reason.trim() ? reason : undefined,
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, values };
  }

  const { date, startTime, endTime } = validated.data;
  const startsAt = zonedDateTimeToUtc(date, startTime);
  const endsAt = zonedDateTimeToUtc(date, endTime);

  // A block that has already ended does nothing; one already under way
  // (e.g. "the rest of this hour") is fine.
  if (endsAt.getTime() <= Date.now()) {
    return { errors: { endTime: ["inPast"] }, values };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("availability_blocks").insert({
    garage_id: garage.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    reason: validated.data.reason ?? null,
    created_by: profile.id,
  });

  if (error) {
    if (error.code === "23P01") {
      return { message: "overlapsBlock", values };
    }
    console.error("[block-time] insert failed:", error);
    return { message: "saveFailed", values };
  }

  const { count } = await supabase
    .from("appointments")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", garage.id)
    .in("status", ["pending_payment", "pending", "confirmed"])
    .lt("start_time", endsAt.toISOString())
    .gt("end_time", startsAt.toISOString());

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/dashboard");
  return {
    created: { date, startTime, endTime, overlapping: count ?? 0 },
  };
}

export async function deleteAvailabilityBlock(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("availability_blocks")
    .delete()
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/availability");
  revalidateLocalizedPath("/garage/dashboard");
}
