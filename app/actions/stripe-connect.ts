"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireGarageOwner } from "@/lib/dal";
import { parseLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { getStripe } from "@/lib/stripe";

export async function startStripeConnectOnboarding(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { profile, garage } = await requireGarageOwner(lang);
  const supabase = await createClient();
  const origin = await getOrigin();
  const stripe = getStripe();

  let accountId: string | null = garage.stripe_account_id;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: profile.email,
      business_type: "company",
    });
    accountId = account.id;

    await supabase
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
