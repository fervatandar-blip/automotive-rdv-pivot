"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireGarageOwner } from "@/lib/dal";
import { parseLocale, type Locale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { getStripe } from "@/lib/stripe";

export async function startStripeConnectOnboarding(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { profile, garage } = await requireGarageOwner(lang);
  // Service role: the stripe_* columns are not writable by API roles since
  // 0034 (an owner could otherwise mark themselves payable). Every value
  // written here comes from Stripe's API, scoped to this owner's garage.
  const admin = createAdminClient();
  const origin = await getOrigin();
  const stripe = getStripe();

  let accountId: string | null = garage.stripe_account_id;

  if (!accountId) {
    // business_type is deliberately not set here: hardcoding "company"
    // forced Stripe's company-specific KYC (registration number, listed
    // representatives) onto every garage owner, including sole
    // proprietors/independents -- a segment this app's own data model
    // already anticipates (garage_leads.garage_size_type includes
    // "independent"). Leaving it unset lets Stripe's own hosted onboarding
    // (accountLinks.create below) ask the owner to select individual vs.
    // company themselves and collect the KYC that actually matches.
    const account = await stripe.accounts.create({
      type: "express",
      email: profile.email,
    });
    accountId = account.id;

    await admin
      .from("garages")
      .update({ stripe_account_id: accountId })
      .eq("id", garage.id);
  }

  const returnUrl = `${origin}/${lang}/garage/stripe-connect`;
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: returnUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });

  redirect(accountLink.url);
}

// The account.updated webhook (app/api/webhooks/stripe/route.ts) is the
// long-term source of truth for these two flags, but webhook delivery can
// lag by seconds in production and, in local/dev without `stripe listen`
// forwarding, never arrives at all -- silently leaving charges_enabled
// false forever even after the owner fully completes onboarding, with
// bookAppointment then hard-blocking every booking on that flag and no
// error explaining why. Called from the stripe-connect page whenever an
// account exists but isn't marked payable yet, so a real return from
// onboarding is reflected immediately regardless of webhook delivery.
//
// Takes only `lang` -- NOT a garageId/stripeAccountId pair, even though
// this is called from a page that already has both to hand. Every function
// exported from a "use server" file is its own independently callable
// endpoint in Next.js, reachable however it's invoked from client code,
// regardless of how it happens to be called from server code today -- this
// previously accepted garageId/stripeAccountId as plain arguments with no
// internal check that the caller actually owned that garage, unlike every
// other action in this file/app. Deriving both from requireGarageOwner
// closes that gap and removes the untrusted-parameter surface entirely,
// rather than re-adding a check on top of caller-supplied IDs.
export async function syncStripeAccountStatus(lang: Locale) {
  const { garage } = await requireGarageOwner(lang);

  if (!garage.stripe_account_id) {
    return null;
  }

  const admin = createAdminClient();
  const stripe = getStripe();

  try {
    const account = await stripe.accounts.retrieve(garage.stripe_account_id);
    const chargesEnabled = account.charges_enabled;
    const payoutsEnabled = account.payouts_enabled;

    await admin
      .from("garages")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
      })
      .eq("id", garage.id);

    return { chargesEnabled, payoutsEnabled };
  } catch (err) {
    console.error("[stripe-connect] account status sync failed:", err);
    return null;
  }
}
