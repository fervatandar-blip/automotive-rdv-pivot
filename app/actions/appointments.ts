"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser, requireGarageMember, requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { getStripe } from "@/lib/stripe";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { dateKeyInAppZone, todayKeyInAppZone, zonedDateTimeToUtc } from "@/lib/timezone";
import { checkRateLimit } from "@/lib/rate-limit";
import { BookingFormSchema, RescheduleFormSchema } from "@/lib/definitions";
import {
  notifyAppointmentStatusChange,
  notifyBookingConfirmed,
  notifyAppointmentRescheduled,
  notifyWaitlistSlotOpened,
  notifyRepairStageChange,
} from "@/lib/notifications";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { REPAIR_STAGES } from "@/lib/definitions";
import { isDateKey, parseCalendarView } from "@/lib/calendar-grid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PARTIES_SELECT =
  "id, start_time, garage_id, client_id, services(name), client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, email, owner_id)";

type AppointmentWithParties = {
  id: string;
  start_time: string;
  garage_id: string;
  client_id: string;
  services: { name: string } | null;
  client: { full_name: string; email: string } | null;
  garage: { name: string; email: string | null; owner_id: string } | null;
};

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

async function notifyStatusChange(
  appointment: AppointmentWithParties,
  status: "confirmed" | "cancelled" | "completed",
  initiator: "client" | "garage"
) {
  if (initiator === "garage") {
    if (!appointment.client) return;
    await notifyAppointmentStatusChange({
      status,
      recipientProfileId: appointment.client_id,
      recipientEmail: appointment.client.email,
      recipientName: appointment.client.full_name,
      otherPartyName: appointment.garage?.name ?? "the garage",
      serviceName: appointment.services?.name ?? "your service",
      startTime: appointment.start_time,
    });
    return;
  }

  if (!appointment.garage) return;
  await notifyAppointmentStatusChange({
    status,
    recipientProfileId: appointment.garage.owner_id,
    recipientEmail: appointment.garage.email,
    recipientName: appointment.garage.name,
    otherPartyName: appointment.client?.full_name ?? "the client",
    serviceName: appointment.services?.name ?? "the service",
    startTime: appointment.start_time,
    recipientGarageId: appointment.garage_id,
  });
}

// Reads the joined parties for an appointment after a write has already
// happened through one of the SECURITY DEFINER transition functions below.
// Relies on the unchanged "Participants can view their appointments" SELECT
// policy -- only the client or a member of the appointment's garage gets a
// row back.
async function fetchAppointmentParties(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string
) {
  const { data } = await supabase
    .from("appointments")
    .select(PARTIES_SELECT)
    .eq("id", appointmentId)
    .maybeSingle();

  return data as unknown as AppointmentWithParties | null;
}

/**
 * Books a slot for the signed-in client. Pilot phase (0040): no online
 * payment -- the booking is confirmed immediately and paid at the garage.
 *
 * Clients have no INSERT policy on appointments any more, so every check
 * the database used to do for a client insert happens here, and the row is
 * written with the service role:
 *   - the garage is approved and not deleted;
 *   - the service belongs to that garage;
 *   - the vehicle, if any, belongs to this client;
 *   - the slot is one the garage actually offers (opening hours, overrides,
 *     blocks, mechanic capacity), the same check rescheduleAppointment does.
 * client_id always comes from the session, never the form. The mechanic
 * trigger (0037) still assigns a free mechanic under its advisory lock, so
 * two clients racing for the last mechanic get one booking and one 23P01.
 */
export async function bookAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);

  const validatedFields = BookingFormSchema.safeParse({
    garageId: formData.get("garageId"),
    serviceId: formData.get("serviceId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    vehicleId: formData.get("vehicleId") || undefined,
  });

  if (!validatedFields.success) {
    redirect(`/${lang}/garages?error=invalid`);
  }

  const { garageId, serviceId, date, startTime, vehicleId } =
    validatedFields.data;
  const bookingErrorUrl = (reason: string) =>
    `/${lang}/garages/${garageId}?service=${serviceId}&date=${date}&error=${reason}`;

  // Keyed by the authenticated user (booking already requires auth via
  // getAuthedUser above), not IP -- ties the limit to the account actually
  // attempting bookings rather than penalizing everyone sharing a
  // network/NAT. With no payment step, this is now the main brake on
  // someone filling a garage's agenda with bookings they won't honour.
  if (!(await checkRateLimit(`booking:${user.id}`, 10, 60 * 60 * 1000))) {
    redirect(bookingErrorUrl("rate-limited"));
  }

  if (formData.get("termsAccepted") !== "on") {
    redirect(bookingErrorUrl("terms"));
  }

  const supabase = await createClient();

  const [{ data: garage }, { data: service }, { data: vehicle }] = await Promise.all([
    supabase
      .from("garages")
      .select("id, status, deleted_at")
      .eq("id", garageId)
      .maybeSingle(),
    supabase
      .from("services")
      .select("duration_minutes")
      .eq("id", serviceId)
      .eq("garage_id", garageId)
      .maybeSingle(),
    vehicleId
      ? supabase
          .from("vehicles")
          .select("id")
          .eq("id", vehicleId)
          .eq("client_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!garage || garage.status !== "approved" || garage.deleted_at) {
    redirect(`/${lang}/garages?error=invalid`);
  }
  if (!service) {
    redirect(`/${lang}/garages/${garageId}?error=service`);
  }
  if (vehicleId && !vehicle) {
    redirect(bookingErrorUrl("invalid"));
  }

  // Without this, a hand-crafted POST could book any time (outside opening
  // hours, on a closed day, inside a block, or in the past).
  const { slots } = await getAvailableSlotsForDate({
    supabase,
    garageId,
    date,
    durationMinutes: service.duration_minutes,
  });

  if (!slots.includes(startTime)) {
    redirect(bookingErrorUrl("slot-taken"));
  }

  const startDate = zonedDateTimeToUtc(date, startTime);
  const endDate = new Date(
    startDate.getTime() + service.duration_minutes * 60000
  );

  const { data: appointment, error } = await createAdminClient()
    .from("appointments")
    .insert({
      client_id: user.id,
      garage_id: garageId,
      service_id: serviceId,
      vehicle_id: vehicleId ?? null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "confirmed",
      // payment_mode is left to its 'on_site' default (0040) rather than
      // written here, so this code can ship before the migration: until
      // the column exists, naming it would fail every booking.
      terms_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !appointment) {
    // 23P01: every mechanic got booked for that time between the slot
    // check and the insert (0037 trigger / exclusion constraint).
    if (error?.code !== "23P01") {
      console.error("[booking] insert failed:", error);
    }
    redirect(bookingErrorUrl(error?.code === "23P01" ? "slot-taken" : "error"));
  }

  const parties = await fetchAppointmentParties(supabase, appointment.id);
  if (parties?.client && parties.garage) {
    try {
      await Promise.all([
        notifyBookingConfirmed({
          recipient: "client",
          recipientProfileId: parties.client_id,
          recipientEmail: parties.client.email,
          recipientName: parties.client.full_name,
          otherPartyName: parties.garage.name,
          serviceName: parties.services?.name ?? "your service",
          startTime: parties.start_time,
        }),
        notifyBookingConfirmed({
          recipient: "garage",
          recipientProfileId: parties.garage.owner_id,
          recipientEmail: parties.garage.email,
          recipientName: parties.garage.name,
          otherPartyName: parties.client.full_name,
          serviceName: parties.services?.name ?? "the service",
          startTime: parties.start_time,
          recipientGarageId: parties.garage_id,
        }),
      ]);
    } catch (err) {
      // The booking stands; a failed email/push must not turn it into an
      // error page.
      console.error("[booking] notification failed:", err);
    }
  }

  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/garage/dashboard");
  revalidateLocalizedPath("/garage/calendar");
  redirect(`/${lang}/dashboard?booked=1`);
}

// Cancelling a paid appointment must not silently keep the client's money --
// only bookings made through Stripe before the pay-on-site pilot (0040,
// payment_mode 'online') have a payment row; for the rest this is a no-op.
//
// look up a succeeded payment and refund it via Stripe. Uses the service-role
// client throughout: `payments` has no update policy for the authenticated
// role by design (financial records are only ever written server-side), so
// flipping status to "refunded" needs to bypass RLS the same way the webhook
// handler's writes do.
async function refundIfPaid(appointmentId: string) {
  try {
    const admin = createAdminClient();
    const { data: payment } = await admin
      .from("payments")
      .select("id, stripe_payment_intent_id")
      .eq("appointment_id", appointmentId)
      .eq("status", "succeeded")
      .maybeSingle();

    if (!payment?.stripe_payment_intent_id) return;

    await getStripe().refunds.create({
      payment_intent: payment.stripe_payment_intent_id,
    });

    await admin
      .from("payments")
      .update({ status: "refunded" })
      .eq("id", payment.id);
  } catch (err) {
    console.error("[payments] refund failed:", err);
  }
}

// A cancellation may free up a slot for someone on the waitlist for this
// exact garage/date -- but that person is very likely a *different* user
// than whoever is cancelling (a client cancelling their own appointment
// still needs to notify someone else's waitlist row), so this uses the
// service-role client the same way refundIfPaid does: `waitlist` has no
// update policy for the authenticated role, `notified_at` is only ever
// written here. Each entry is notified at most once, ever.
async function notifyWaitlistOnCancellation(garageId: string, date: string) {
  try {
    const admin = createAdminClient();
    const { data: entries } = await admin
      .from("waitlist")
      .select(
        "id, client_id, client:profiles!waitlist_client_id_fkey(full_name, email), garages(name), services(name)"
      )
      .eq("garage_id", garageId)
      .eq("date", date)
      .is("notified_at", null);

    if (!entries || entries.length === 0) return;

    for (const entry of entries) {
      const client = entry.client as unknown as {
        full_name: string;
        email: string;
      } | null;
      const garage = entry.garages as unknown as { name: string } | null;
      const service = entry.services as unknown as { name: string } | null;

      if (!client || !garage || !service) continue;

      await notifyWaitlistSlotOpened({
        recipientProfileId: entry.client_id,
        recipientEmail: client.email,
        recipientName: client.full_name,
        garageName: garage.name,
        serviceName: service.name,
        date,
      });
    }

    await admin
      .from("waitlist")
      .update({ notified_at: new Date().toISOString() })
      .in(
        "id",
        entries.map((entry) => entry.id)
      );
  } catch (err) {
    console.error("[waitlist] notify failed:", err);
  }
}

export async function cancelAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();

  // Auth + status-transition check happens inside cancel_appointment_as_client
  // (SECURITY DEFINER) -- appointments has no general UPDATE policy for the
  // authenticated role, see 0027_appointment_write_integrity.sql.
  const { data: cancelled } = await supabase.rpc("cancel_appointment_as_client", {
    target_appointment_id: id,
  });

  if (cancelled) {
    const appointment = await fetchAppointmentParties(supabase, id);
    if (appointment && appointment.client_id === user.id) {
      await notifyStatusChange(appointment, "cancelled", "client");
      await refundIfPaid(id);
      await notifyWaitlistOnCancellation(
        appointment.garage_id,
        dateKeyInAppZone(new Date(appointment.start_time))
      );
    }
  }

  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/garage/calendar");
}

export async function confirmAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();

  const { data: confirmed } = await supabase.rpc("confirm_appointment", {
    target_appointment_id: id,
  });

  if (confirmed) {
    const appointment = await fetchAppointmentParties(supabase, id);
    if (appointment) {
      await notifyStatusChange(appointment, "confirmed", "garage");
    }
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}

export async function updateRepairStage(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireGarageMember(lang);
  const id = formData.get("id");
  const stage = formData.get("stage");

  if (typeof id !== "string" || !id) {
    return;
  }

  if (
    typeof stage !== "string" ||
    !(REPAIR_STAGES as readonly string[]).includes(stage)
  ) {
    return;
  }

  const supabase = await createClient();

  const { data: updated } = await supabase.rpc("update_appointment_repair_stage", {
    target_appointment_id: id,
    new_stage: stage,
  });

  if (updated) {
    const appointment = await fetchAppointmentParties(supabase, id);
    if (appointment?.client) {
      await notifyRepairStageChange({
        stage,
        recipientProfileId: appointment.client_id,
        recipientEmail: appointment.client.email,
        recipientName: appointment.client.full_name,
        otherPartyName: appointment.garage?.name ?? "the garage",
        serviceName: appointment.services?.name ?? "your service",
      });
    }
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}

async function generateInvoice(
  supabase: Awaited<ReturnType<typeof createClient>>,
  appointmentId: string,
  garageId: string
) {
  try {
    const { data: appointment } = await supabase
      .from("appointments")
      .select(
        "start_time, client_id, garage_customer_id, client:profiles!appointments_client_id_fkey(full_name, email), walk_in:garage_customers(full_name, email, phone), garage:garages!appointments_garage_id_fkey(name, address, city, email, vat_number, registration_number), services(name, duration_minutes, price)"
      )
      .eq("id", appointmentId)
      .single();

    if (!appointment) return;

    // The invoice recipient: a registered client, or a walk-in customer
    // (0038) who may have no email at all.
    const registered = appointment.client as unknown as {
      full_name: string;
      email: string;
    } | null;
    const walkIn = appointment.walk_in as unknown as {
      full_name: string;
      email: string | null;
      phone: string | null;
    } | null;
    const recipient = registered
      ? { name: registered.full_name, email: registered.email, phone: null }
      : walkIn
        ? { name: walkIn.full_name, email: walkIn.email, phone: walkIn.phone }
        : null;
    const garageInfo = appointment.garage as unknown as {
      name: string;
      address: string | null;
      city: string | null;
      email: string | null;
      vat_number: string | null;
      registration_number: string | null;
    } | null;
    const service = appointment.services as unknown as {
      name: string;
      duration_minutes: number;
      price: number;
    } | null;

    if (!recipient || !garageInfo || !service) return;

    // increment_invoice_number must run before rendering (the number is
    // printed inside the PDF itself, so it has to be known first) --
    // meaning a failure in any step below it still permanently burns that
    // number, with no invoice ever issued under it. Most EU VAT regimes
    // (Luxembourg included) expect sequential invoice numbering, so a gap
    // here isn't just cosmetic. This is a narrow, genuinely rare failure
    // window (Storage/DB calls, not the payment itself), and closing it
    // completely would need a two-phase claim/commit scheme this function
    // doesn't have -- what it can and does have is recovery: see
    // retryInvoiceGeneration below and the "missing invoice" list on
    // app/[lang]/garage/invoices/page.tsx, so a failure here is visible
    // and fixable instead of silent and permanent.
    const { data: invoiceNumberValue } = await supabase.rpc(
      "increment_invoice_number",
      { target_garage_id: garageId }
    );
    if (typeof invoiceNumberValue !== "number") return;

    // Year in the garage's zone: on a UTC server the first hour or two of
    // 1 January local time would otherwise still be stamped with last year.
    const invoiceNumber = `${todayKeyInAppZone().slice(0, 4)}-${String(
      invoiceNumberValue
    ).padStart(4, "0")}`;
    const issuedAt = new Date().toISOString();

    const pdfBuffer = await renderInvoicePdf({
      invoiceNumber,
      issuedAt,
      garage: {
        name: garageInfo.name,
        address: garageInfo.address,
        city: garageInfo.city,
        email: garageInfo.email,
        vatNumber: garageInfo.vat_number,
        registrationNumber: garageInfo.registration_number,
      },
      client: recipient,
      service: {
        name: service.name,
        durationMinutes: service.duration_minutes,
        price: service.price,
      },
      appointmentDate: appointment.start_time,
      currency: "EUR",
    });

    const filePath = `${garageId}/${appointmentId}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("[invoice] storage upload failed:", uploadError);
      return;
    }

    const { error: insertError } = await supabase.from("invoices").insert({
      appointment_id: appointmentId,
      garage_id: garageId,
      client_id: appointment.client_id,
      garage_customer_id: appointment.garage_customer_id,
      invoice_number: invoiceNumber,
      amount: service.price,
      currency: "EUR",
      file_path: filePath,
      issued_at: issuedAt,
    });

    if (insertError) {
      // Previously unchecked -- the PDF is already uploaded to Storage at
      // this point, but with no `invoices` row pointing at it, so it's
      // orphaned and the appointment looks invoice-less just like any
      // other failure in this function. retryInvoiceGeneration's own
      // upload call uses upsert, so a retry safely overwrites this file.
      console.error("[invoice] invoices row insert failed:", insertError);
    }
  } catch (err) {
    // Invoice generation is best-effort: a PDF/storage failure shouldn't
    // undo the appointment status change that already succeeded. Recovery
    // is retryInvoiceGeneration, not automatic retry here.
    console.error("[invoice] failed to generate:", err);
  }
}

// The recovery path for generateInvoice's failure modes above: lets a
// garage member manually re-run generation for a completed appointment
// that never got one. Guards on both status and "no existing invoice" so
// this can't be used to burn a second invoice number for an appointment
// that already has one.
export async function retryInvoiceGeneration(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();

  const { data: appointment } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", id)
    .eq("garage_id", garage.id)
    .eq("status", "completed")
    .maybeSingle();

  if (!appointment) {
    return;
  }

  const { data: existingInvoice } = await supabase
    .from("invoices")
    .select("id")
    .eq("appointment_id", id)
    .maybeSingle();

  if (existingInvoice) {
    return;
  }

  await generateInvoice(supabase, id, garage.id);

  revalidateLocalizedPath("/garage/invoices");
}

export async function completeAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();

  const { data: completed } = await supabase.rpc("complete_appointment", {
    target_appointment_id: id,
  });

  if (completed) {
    const appointment = await fetchAppointmentParties(supabase, id);
    if (appointment) {
      await notifyStatusChange(appointment, "completed", "garage");
      await generateInvoice(supabase, id, garage.id);
    }
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}

export async function providerCancelAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();

  const { data: cancelled } = await supabase.rpc("cancel_appointment_as_garage", {
    target_appointment_id: id,
  });

  if (cancelled) {
    const appointment = await fetchAppointmentParties(supabase, id);
    if (appointment) {
      await notifyStatusChange(appointment, "cancelled", "garage");
      await refundIfPaid(id);
      await notifyWaitlistOnCancellation(
        appointment.garage_id,
        dateKeyInAppZone(new Date(appointment.start_time))
      );
    }
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}

export async function rescheduleAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);

  const validatedFields = RescheduleFormSchema.safeParse({
    appointmentId: formData.get("appointmentId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
  });

  if (!validatedFields.success) {
    redirect(`/${lang}/dashboard?error=invalid`);
  }

  const { appointmentId, date, startTime } = validatedFields.data;
  const supabase = await createClient();
  const rescheduleErrorUrl = (reason: string) =>
    `/${lang}/appointments/${appointmentId}/reschedule?date=${date}&error=${reason}`;

  // Selecting via the session-scoped client relies on the existing
  // "Participants can view their appointments" RLS policy (client_id =
  // auth.uid() OR is_garage_member(garage_id)) -- anyone else gets no row
  // back, with no separate authorization check needed here.
  const { data: appointment } = await supabase
    .from("appointments")
    .select(
      "id, client_id, garage_id, status, services(name, duration_minutes), client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, email, owner_id)"
    )
    .eq("id", appointmentId)
    .single();

  if (!appointment) {
    redirect(`/${lang}/dashboard?error=not-found`);
  }

  if (!["pending", "confirmed"].includes(appointment.status)) {
    redirect(rescheduleErrorUrl("not-reschedulable"));
  }

  const service = appointment.services as unknown as {
    name: string;
    duration_minutes: number;
  } | null;

  if (!service) {
    redirect(rescheduleErrorUrl("service"));
  }

  const { slots } = await getAvailableSlotsForDate({
    supabase,
    garageId: appointment.garage_id,
    date,
    durationMinutes: service.duration_minutes,
    excludeAppointmentId: appointmentId,
  });

  if (!slots.includes(startTime)) {
    redirect(rescheduleErrorUrl("slot-taken"));
  }

  const startDate = zonedDateTimeToUtc(date, startTime);
  const endDate = new Date(
    startDate.getTime() + service.duration_minutes * 60000
  );

  // Goes through a SECURITY DEFINER function (not a direct table update)
  // since appointments has no general UPDATE policy for the authenticated
  // role -- see 0027_appointment_write_integrity.sql. The function does not
  // catch exclusion_violation, so a last-moment race with another booking
  // still surfaces here as error.code === "23P01", exactly as it did when
  // this was a direct table update against the same constraint.
  const { data: rescheduled, error } = await supabase.rpc("reschedule_appointment", {
    target_appointment_id: appointmentId,
    new_start: startDate.toISOString(),
    new_end: endDate.toISOString(),
  });

  if (error) {
    redirect(
      rescheduleErrorUrl(error.code === "23P01" ? "slot-taken" : "error")
    );
  }

  if (!rescheduled) {
    redirect(rescheduleErrorUrl("error"));
  }

  const client = appointment.client as unknown as {
    full_name: string;
    email: string;
  } | null;
  const garage = appointment.garage as unknown as {
    name: string;
    email: string | null;
    owner_id: string;
  } | null;
  const initiator = user.id === appointment.client_id ? "client" : "garage";

  if (initiator === "client" && garage) {
    await notifyAppointmentRescheduled({
      recipientProfileId: garage.owner_id,
      recipientEmail: garage.email,
      recipientName: garage.name,
      otherPartyName: client?.full_name ?? "the client",
      serviceName: service.name,
      startTime: startDate.toISOString(),
    });
  } else if (initiator === "garage" && client) {
    await notifyAppointmentRescheduled({
      recipientProfileId: appointment.client_id,
      recipientEmail: client.email,
      recipientName: client.full_name,
      otherPartyName: garage?.name ?? "the garage",
      serviceName: service.name,
      startTime: startDate.toISOString(),
    });
  }

  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/garage/calendar");
  redirect(`/${lang}/dashboard?rescheduled=1`);
}

export async function assignMechanic(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await requireGarageOwner(lang);
  const id = formData.get("id");
  const mechanicId = formData.get("mechanicId");

  // Back to the same calendar view, with the appointment's panel still
  // open; only known values are echoed into the URL.
  const returnView = parseCalendarView(formData.get("returnView"));
  const returnDate = formData.get("returnDate");
  const calendarUrl = (error?: string) => {
    const params = new URLSearchParams({ view: returnView });
    if (isDateKey(returnDate)) params.set("date", returnDate);
    if (typeof id === "string" && UUID_PATTERN.test(id)) params.set("appt", id);
    if (formData.get("returnCancelled") === "1") params.set("cancelled", "1");
    const returnBy = formData.get("returnBy");
    if (returnBy === "mechanic" || returnBy === "together") params.set("by", returnBy);
    if (error) params.set("error", error);
    return `/${lang}/garage/calendar?${params}`;
  };

  if (typeof id !== "string" || !id) {
    redirect(calendarUrl());
  }

  const supabase = await createClient();

  // Goes through a SECURITY DEFINER function (not a direct table update)
  // since appointments has no general UPDATE policy for the authenticated
  // role -- see 0027_appointment_write_integrity.sql. An empty choice means
  // "auto-assign": the appointments_assign_mechanic trigger (0037) picks a
  // free mechanic. A specific mechanic who is busy then (or isn't part of
  // this garage) is refused with 23P01 rather than silently swapped.
  const { error } = await supabase.rpc("assign_appointment_mechanic", {
    target_appointment_id: id,
    target_mechanic_id:
      typeof mechanicId === "string" && mechanicId ? mechanicId : null,
  });

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");

  if (error) {
    console.error("[appointments] assign_appointment_mechanic failed:", error);
  }
  redirect(calendarUrl(error ? (error.code === "23P01" ? "mechanic-busy" : "assign-failed") : undefined));
}

export type MoveAppointmentInput = {
  lang: string;
  id: string;
  date: string; // "YYYY-MM-DD", garage zone
  time: string; // "HH:MM", garage zone
  // Pin the job to this mechanic (per-mechanic day view). Omitted: time
  // only, and the 0037 trigger keeps or reassigns the mechanic.
  mechanicId?: string;
};

export type MoveAppointmentResult =
  | { ok: true; mechanicName: string | null; mechanicChanged: boolean }
  | {
      ok: false;
      // Key into dictionary.garageCalendar.moveErrors.
      error:
        | "invalid"
        | "not-movable"
        | "past"
        | "crosses-midnight"
        | "mechanic-busy"
        | "no-mechanic"
        | "owner-only"
        | "error";
    };

// A job dragged a few minutes into the past (e.g. "it actually started at
// 10:00") is fine; anything earlier is almost certainly a mis-drop.
const MOVE_PAST_TOLERANCE_MS = 15 * 60 * 1000;

/**
 * Drag-and-drop rescheduling from the garage calendar. Called directly from
 * the client (not a form), so it returns a result instead of redirecting.
 * The job keeps its current length. Atomic time + mechanic change through
 * move_appointment (0041); opening hours are deliberately not enforced for
 * staff, same as walk-ins.
 */
export async function moveAppointment(
  input: MoveAppointmentInput
): Promise<MoveAppointmentResult> {
  const lang = parseLocale(input.lang);
  await requireGarageMember(lang);

  if (
    !UUID_PATTERN.test(input.id) ||
    !isDateKey(input.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time) ||
    (input.mechanicId !== undefined && !UUID_PATTERN.test(input.mechanicId))
  ) {
    return { ok: false, error: "invalid" };
  }

  const supabase = await createClient();
  const { data: appointment } = await supabase
    .from("appointments")
    .select(PARTIES_SELECT + ", end_time, status, assigned_mechanic_id")
    .eq("id", input.id)
    .maybeSingle();

  const current = appointment as unknown as
    | (AppointmentWithParties & { end_time: string; status: string; assigned_mechanic_id: string | null })
    | null;
  if (!current || !["pending", "confirmed"].includes(current.status)) {
    return { ok: false, error: "not-movable" };
  }

  const durationMs =
    new Date(current.end_time).getTime() - new Date(current.start_time).getTime();
  const newStart = zonedDateTimeToUtc(input.date, input.time);
  const newEnd = new Date(newStart.getTime() + durationMs);

  if (newStart.getTime() < Date.now() - MOVE_PAST_TOLERANCE_MS) {
    return { ok: false, error: "past" };
  }
  if (dateKeyInAppZone(new Date(newEnd.getTime() - 1)) !== input.date) {
    return { ok: false, error: "crosses-midnight" };
  }

  const { data: holder, error } = await supabase.rpc("move_appointment", {
    target_appointment_id: input.id,
    new_start: newStart.toISOString(),
    new_end: newEnd.toISOString(),
    target_mechanic_id: input.mechanicId ?? null,
  });

  if (error) {
    if (error.code === "42501") return { ok: false, error: "owner-only" };
    if (error.code === "23P01") {
      return {
        ok: false,
        error: error.message.includes("no_mechanic_available") ? "no-mechanic" : "mechanic-busy",
      };
    }
    console.error("[calendar] move_appointment failed:", error);
    return { ok: false, error: "error" };
  }
  if (!holder) {
    return { ok: false, error: "not-movable" };
  }

  const timeChanged = newStart.getTime() !== new Date(current.start_time).getTime();
  // Registered clients hear about a new time; walk-in customers have no
  // account to notify, and a mechanic swap alone isn't the client's news.
  if (timeChanged && current.client && current.client_id) {
    try {
      await notifyAppointmentRescheduled({
        recipientProfileId: current.client_id,
        recipientEmail: current.client.email,
        recipientName: current.client.full_name,
        otherPartyName: current.garage?.name ?? "the garage",
        serviceName: current.services?.name ?? "your service",
        startTime: newStart.toISOString(),
      });
    } catch (err) {
      // The move stands; a failed email must not undo or hide it.
      console.error("[calendar] reschedule notification failed:", err);
    }
  }

  const { data: mechanic } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", holder as string)
    .maybeSingle();

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");
  revalidateLocalizedPath("/dashboard");

  return {
    ok: true,
    mechanicName: (mechanic?.full_name as string | undefined) ?? null,
    mechanicChanged: holder !== current.assigned_mechanic_id,
  };
}
