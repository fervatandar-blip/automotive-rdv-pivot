import { type NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyBookingReceived } from "@/lib/notifications";

// Server-to-server call from Stripe -- no user session exists, so every
// write here goes through the service-role client (the only writer
// `payments` RLS allows, by design -- see 0011_payments.sql).
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[stripe webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;

    if (appointmentId && session.payment_intent) {
      const { data: appointment } = await admin
        .from("appointments")
        .select(
          "garage_id, client_id, start_time, services(name), client:profiles!appointments_client_id_fkey(full_name, email), garage:garages!appointments_garage_id_fkey(name, email, owner_id)"
        )
        .eq("id", appointmentId)
        .eq("status", "pending_payment")
        .maybeSingle();

      if (appointment) {
        const paymentIntent = await stripe.paymentIntents.retrieve(
          session.payment_intent as string
        );
        const amount = paymentIntent.amount / 100;
        const commissionAmount = (paymentIntent.application_fee_amount ?? 0) / 100;

        await admin
          .from("appointments")
          .update({ status: "pending" })
          .eq("id", appointmentId);

        await admin.from("payments").insert({
          appointment_id: appointmentId,
          garage_id: appointment.garage_id,
          client_id: appointment.client_id,
          amount,
          commission_amount: commissionAmount,
          payout_amount: amount - commissionAmount,
          currency: paymentIntent.currency,
          stripe_checkout_session_id: session.id,
          stripe_payment_intent_id: paymentIntent.id,
          status: "succeeded",
        });

        const client = appointment.client as unknown as {
          full_name: string;
          email: string;
        } | null;
        const garage = appointment.garage as unknown as {
          name: string;
          email: string | null;
          owner_id: string;
        } | null;
        const service = appointment.services as unknown as {
          name: string;
        } | null;

        if (client) {
          await notifyBookingReceived({
            recipient: "client",
            recipientProfileId: appointment.client_id,
            recipientEmail: client.email,
            recipientName: client.full_name,
            otherPartyName: garage?.name ?? "the garage",
            serviceName: service?.name ?? "your service",
            startTime: appointment.start_time,
          });
        }

        if (garage) {
          await notifyBookingReceived({
            recipient: "garage",
            recipientProfileId: garage.owner_id,
            recipientEmail: garage.email,
            recipientName: garage.name,
            otherPartyName: client?.full_name ?? "the client",
            serviceName: service?.name ?? "the service",
            startTime: appointment.start_time,
          });
        }
      }
    }
  }

  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const appointmentId = session.metadata?.appointmentId;

    if (appointmentId) {
      await admin
        .from("appointments")
        .update({ status: "cancelled" })
        .eq("id", appointmentId)
        .eq("status", "pending_payment");
    }
  }

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;

    await admin
      .from("garages")
      .update({
        stripe_charges_enabled: account.charges_enabled,
        stripe_payouts_enabled: account.payouts_enabled,
      })
      .eq("stripe_account_id", account.id);
  }

  return NextResponse.json({ received: true });
}
