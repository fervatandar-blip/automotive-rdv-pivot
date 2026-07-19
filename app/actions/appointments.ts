"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser, requireGarageMember, requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { getStripe, PLATFORM_COMMISSION_PERCENT } from "@/lib/stripe";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { BookingFormSchema, RescheduleFormSchema } from "@/lib/definitions";
import {
  notifyAppointmentStatusChange,
  notifyAppointmentRescheduled,
  notifyWaitlistSlotOpened,
} from "@/lib/notifications";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

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

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  });
}

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
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("name, duration_minutes, price")
    .eq("id", serviceId)
    .eq("garage_id", garageId)
    .single();

  if (!service) {
    redirect(`/${lang}/garages/${garageId}?error=service`);
  }

  const { data: garage } = await supabase
    .from("garages")
    .select("stripe_account_id, stripe_charges_enabled")
    .eq("id", garageId)
    .single();

  if (!garage?.stripe_charges_enabled || !garage.stripe_account_id) {
    redirect(`/${lang}/garages/${garageId}?error=not-payable`);
  }

  const startDate = new Date(`${date}T${startTime}:00`);
  const endDate = new Date(
    startDate.getTime() + service.duration_minutes * 60000
  );
  const bookingErrorUrl = (reason: string) =>
    `/${lang}/garages/${garageId}?service=${serviceId}&date=${date}&error=${reason}`;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      client_id: user.id,
      garage_id: garageId,
      service_id: serviceId,
      vehicle_id: vehicleId ?? null,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      status: "pending_payment",
    })
    .select("id")
    .single();

  if (error || !appointment) {
    // 23P01 = exclusion_violation, thrown by the no-overlap DB constraint
    // when another client books the same slot first.
    redirect(bookingErrorUrl(error?.code === "23P01" ? "slot-taken" : "error"));
  }

  // Client pays the full service price; the platform's cut is carved out via
  // a Stripe Connect destination charge, so the garage automatically
  // receives (price - commission) with no manual payout step.
  const totalCents = Math.round(service.price * 100);
  const commissionCents = Math.round(
    totalCents * (PLATFORM_COMMISSION_PERCENT / 100)
  );

  let sessionUrl: string;
  try {
    const origin = await getOrigin();
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: service.name },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: commissionCents,
        transfer_data: { destination: garage.stripe_account_id },
      },
      metadata: { appointmentId: appointment.id },
      success_url: `${origin}/${lang}/dashboard?booked=1`,
      cancel_url: `${origin}${bookingErrorUrl("payment-cancelled")}`,
      // Keeps an abandoned checkout from holding the slot for Stripe's
      // default 24h session lifetime -- checkout.session.expired frees it.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a checkout session URL");
    }

    await supabase
      .from("appointments")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", appointment.id);

    sessionUrl = session.url;
  } catch (err) {
    console.error("[payments] checkout session creation failed:", err);
    await supabase.from("appointments").delete().eq("id", appointment.id);
    redirect(bookingErrorUrl("payment-error"));
  }

  redirect(sessionUrl);
}

// Cancelling a paid appointment must not silently keep the client's money --
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
  const { data } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("client_id", user.id)
    .in("status", ["pending", "confirmed"])
    .select(PARTIES_SELECT)
    .maybeSingle();

  if (data) {
    const appointment = data as unknown as AppointmentWithParties;
    await notifyStatusChange(appointment, "cancelled", "client");
    await refundIfPaid(id);
    await notifyWaitlistOnCancellation(
      appointment.garage_id,
      toDateKey(new Date(appointment.start_time))
    );
  }

  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/garage/calendar");
}

export async function confirmAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .update({ status: "confirmed" })
    .eq("id", id)
    .eq("garage_id", garage.id)
    .eq("status", "pending")
    .select(PARTIES_SELECT)
    .maybeSingle();

  if (data) {
    await notifyStatusChange(
      data as unknown as AppointmentWithParties,
      "confirmed",
      "garage"
    );
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
        "start_time, client_id, client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, address, city, email, vat_number, registration_number), services(name, duration_minutes, price)"
      )
      .eq("id", appointmentId)
      .single();

    if (!appointment) return;

    const client = appointment.client as unknown as {
      full_name: string;
      email: string;
    } | null;
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

    if (!client || !garageInfo || !service) return;

    const { data: invoiceNumberValue } = await supabase.rpc(
      "increment_invoice_number",
      { target_garage_id: garageId }
    );
    if (typeof invoiceNumberValue !== "number") return;

    const invoiceNumber = `${new Date().getFullYear()}-${String(
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
      client: { name: client.full_name, email: client.email },
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
      .upload(filePath, pdfBuffer, { contentType: "application/pdf" });

    if (uploadError) return;

    await supabase.from("invoices").insert({
      appointment_id: appointmentId,
      garage_id: garageId,
      client_id: appointment.client_id,
      invoice_number: invoiceNumber,
      amount: service.price,
      currency: "EUR",
      file_path: filePath,
      issued_at: issuedAt,
    });
  } catch (err) {
    // Invoice generation is best-effort: a PDF/storage failure shouldn't
    // undo the appointment status change that already succeeded.
    console.error("[invoice] failed to generate:", err);
  }
}

export async function completeAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .update({ status: "completed" })
    .eq("id", id)
    .eq("garage_id", garage.id)
    .in("status", ["pending", "confirmed"])
    .select(PARTIES_SELECT)
    .maybeSingle();

  if (data) {
    await notifyStatusChange(
      data as unknown as AppointmentWithParties,
      "completed",
      "garage"
    );
    await generateInvoice(supabase, id, garage.id);
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}

export async function providerCancelAppointment(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("garage_id", garage.id)
    .in("status", ["pending", "confirmed"])
    .select(PARTIES_SELECT)
    .maybeSingle();

  if (data) {
    const appointment = data as unknown as AppointmentWithParties;
    await notifyStatusChange(appointment, "cancelled", "garage");
    await refundIfPaid(id);
    await notifyWaitlistOnCancellation(
      appointment.garage_id,
      toDateKey(new Date(appointment.start_time))
    );
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
  // "Participants can update their appointments" RLS policy (client_id =
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

  const startDate = new Date(`${date}T${startTime}:00`);
  const endDate = new Date(
    startDate.getTime() + service.duration_minutes * 60000
  );

  const { error } = await supabase
    .from("appointments")
    .update({
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
    })
    .eq("id", appointmentId);

  if (error) {
    // 23P01 = exclusion_violation -- a last-moment race with another booking.
    redirect(
      rescheduleErrorUrl(error.code === "23P01" ? "slot-taken" : "error")
    );
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
  const { garage } = await requireGarageOwner(lang);
  const id = formData.get("id");
  const mechanicId = formData.get("mechanicId");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("appointments")
    .update({
      assigned_mechanic_id:
        typeof mechanicId === "string" && mechanicId ? mechanicId : null,
    })
    .eq("id", id)
    .eq("garage_id", garage.id);

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
}
