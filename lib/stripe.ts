import "server-only";
import Stripe from "stripe";

// Lazily instantiated: Next.js evaluates route/action modules at build time
// to collect page data, which would otherwise construct a real Stripe client
// (and throw on a missing key) before any request ever needs one -- same
// reasoning as lib/email.ts guarding its Resend client on RESEND_API_KEY.
let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-06-24.dahlia",
    });
  }
  return stripeClient;
}

export const PLATFORM_COMMISSION_PERCENT = Number(
  process.env.PLATFORM_COMMISSION_PERCENT ?? "15"
);
