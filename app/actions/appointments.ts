"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser, requireGarageMember, requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { getStripe, PLATFORM_COMMISSION_PERCENT } from "@/lib/stripe";
import { BookingFormSchema } from "@/lib/definitions";
import { notifyAppointmentStatusChange } from "@/lib/notifications";
import { renderInvoicePdf } from "@/lib/invoice-pdf";

const PARTIES_SELECT =
  "id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, email)";

type AppointmentWithParties = {
  id: string;
  start_time: string;
  services: { name: string } | null;
  client: { full_name: string; email: string } | null;
  garage: { name: string; email: string | null } | null;
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
      recipientEmail: appointment.client.email,
      recipientName: appointment.client.full_name,
      otherPartyName: appointment.garage?.name ?? "the garage",
      serviceName: appointment.services?.name ?? "your service",
      startTime: appointment.start_time,
    });
    return;
  }

  if (!appointment.garage?.email) return;
  await notifyAppointmentStatusChange({
    status,
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
  });

  if (!validatedFields.success) {
    redirect(`/${lang}/garages?error=invalid`);
  }

  const { garageId, serviceId, date, startTime } = validatedFields.data;
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
    await notifyStatusChange(
      data as unknown as AppointmentWithParties,
      "cancelled",
      "client"
    );
    await refundIfPaid(id);
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
        "start_time, client_id, client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, address, city, email, vat_number), services(name, duration_minutes, price)"
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
    await notifyStatusChange(
      data as unknown as AppointmentWithParties,
      "cancelled",
      "garage"
    );
    await refundIfPaid(id);
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/dashboard");
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
