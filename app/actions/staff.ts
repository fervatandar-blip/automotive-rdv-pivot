"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthedUser, requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale, defaultLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { checkRateLimit } from "@/lib/rate-limit";
import { escapeHtml, sendEmail } from "@/lib/email";
import {
  InviteMechanicFormSchema,
  type InviteMechanicFormState,
} from "@/lib/definitions";

// Each invite can send an email to an arbitrary address, so this caps how
// much mail one (self-serve, unverified) garage account can generate.
const INVITES_PER_GARAGE_PER_DAY = 20;

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

function isEmailAlreadyRegistered(error: { code?: string; message: string }) {
  return (
    error.code === "email_exists" ||
    /already (been )?registered/i.test(error.message)
  );
}

/**
 * Invites someone to join this garage as a mécanicien. Nothing is granted
 * here: the invite is a pending garage_invites row keyed by email, and only
 * the invitee can turn it into staff membership, by accepting it while
 * signed in with that (verified) email -- see
 * supabase/migrations/0033_garage_staff_invites.sql (accept_garage_invite).
 *
 * The response is identical whether or not the email already has an
 * account, or what role that account has, so the form can't be used to
 * probe for accounts.
 */
export async function inviteMechanic(
  state: InviteMechanicFormState,
  formData: FormData
): Promise<InviteMechanicFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage, profile } = await requireGarageOwner(lang);

  const validatedFields = InviteMechanicFormSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  if (
    !(await checkRateLimit(
      `staff-invite:${garage.id}`,
      INVITES_PER_GARAGE_PER_DAY,
      24 * 60 * 60 * 1000
    ))
  ) {
    return { message: "Too many invitations today. Try again tomorrow." };
  }

  const { fullName } = validatedFields.data;
  const email = validatedFields.data.email.toLowerCase();
  const supabase = await createClient();

  // Created with the owner's own session: RLS ("Garage owners create
  // pending invites") pins it to this owner's garage, status 'pending'.
  const { data: invite, error: inviteError } = await supabase
    .from("garage_invites")
    .insert({ garage_id: garage.id, email, invited_by: profile.id })
    .select("id")
    .single();

  if (inviteError || !invite) {
    // 23505 = garage_invites_one_pending_per_email. This only reveals the
    // garage's own invite history, not anything about the email's account.
    return {
      message:
        inviteError?.code === "23505"
          ? "An invitation to that email is already pending."
          : "Could not create the invitation. Try again.",
    };
  }

  const admin = createAdminClient();
  const origin = await getOrigin();
  const nextPath = encodeURIComponent(`/${defaultLocale}/set-password`);

  // No account yet: Supabase sends its "Invite user" email, which creates
  // the account. After setting a password they land on /garage/dashboard,
  // where the pending invite is waiting for them to accept.
  const { data: invited, error: authInviteError } =
    await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, role: "mecanicien" },
      redirectTo: `${origin}/auth/callback?next=${nextPath}`,
    });

  if (!authInviteError && invited.user) {
    // handle_new_user() (0030) never grants 'mecanicien' from metadata, so
    // the new profile lands as 'client'. Elevate it explicitly. This only
    // ever applies to an account this very call just created -- an
    // existing account is never touched.
    const { error: roleError } = await admin
      .from("profiles")
      .update({ role: "mecanicien" })
      .eq("id", invited.user.id);

    if (roleError) {
      console.error("[staff] could not grant mecanicien role:", roleError);
      await supabase.from("garage_invites").delete().eq("id", invite.id);
      return { message: "Could not send the invite. Try again." };
    }
  } else if (authInviteError && isEmailAlreadyRegistered(authInviteError)) {
    // Existing account: tell them about the invite, but only if it's a
    // mécanicien account -- a client account can't accept one anyway.
    // profiles.email is editable by its owner, so this lookup only decides
    // whether to send a courtesy email to the address the garage typed; it
    // never grants anything (accept_garage_invite checks auth.users).
    const { data: matches } = await admin
      .from("profiles")
      .select("role")
      .eq("email", email)
      .eq("role", "mecanicien")
      .is("deleted_at", null)
      .limit(1);

    if (matches && matches.length > 0) {
      await sendEmail({
        to: email,
        subject: `${garage.name.replace(/[\r\n]+/g, " ")} invited you to join their team on RDV`,
        html: `<p>Hi,</p><p><strong>${escapeHtml(garage.name)}</strong> has invited you to join their team as a mécanicien on RDV.</p><p>Sign in at <a href="${origin}/${lang}/garage/login">${origin}/${lang}/garage/login</a> to accept or decline. The invitation expires in 14 days.</p><p>If you weren't expecting this, you can ignore this email -- nothing changes unless you accept.</p>`,
      });
    }
  } else {
    console.error("[staff] inviteUserByEmail failed:", authInviteError);
    await supabase.from("garage_invites").delete().eq("id", invite.id);
    return { message: "Could not send the invite. Try again." };
  }

  revalidateLocalizedPath("/garage/staff");
  return { sentTo: email };
}

export async function cancelMechanicInvite(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);
  const inviteId = formData.get("inviteId");

  if (typeof inviteId !== "string" || !inviteId) return;

  const supabase = await createClient();
  await supabase
    .from("garage_invites")
    .delete()
    .eq("id", inviteId)
    .eq("garage_id", garage.id)
    .eq("status", "pending");

  revalidateLocalizedPath("/garage/staff");
}

/**
 * Moves a person's upcoming active jobs at this garage onto whichever
 * mechanic is free (the appointments_assign_mechanic trigger, 0037, picks
 * one when the mechanic is cleared). Returns how many couldn't be moved
 * because nobody else is free then -- those stay with the original person
 * and need the owner's attention.
 */
async function reassignUpcomingJobs(
  supabase: Awaited<ReturnType<typeof createClient>>,
  garageId: string,
  profileId: string
) {
  const { data: jobs } = await supabase
    .from("appointments")
    .select("id")
    .eq("garage_id", garageId)
    .eq("assigned_mechanic_id", profileId)
    .in("status", ["pending_payment", "pending", "confirmed"])
    .gt("end_time", new Date().toISOString());

  let stranded = 0;
  for (const job of jobs ?? []) {
    const { error } = await supabase.rpc("assign_appointment_mechanic", {
      target_appointment_id: job.id,
      target_mechanic_id: null,
    });
    if (error) stranded += 1;
  }
  return { moved: (jobs?.length ?? 0) - stranded, stranded };
}

function staffUrl(lang: string, result: { moved: number; stranded: number }) {
  const params = new URLSearchParams();
  if (result.moved > 0) params.set("moved", String(result.moved));
  if (result.stranded > 0) params.set("stranded", String(result.stranded));
  const query = params.toString();
  return `/${lang}/garage/staff${query ? `?${query}` : ""}`;
}

export async function removeMechanic(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);
  const profileId = formData.get("profileId");

  if (typeof profileId !== "string" || !profileId) return;

  const supabase = await createClient();
  await supabase
    .from("garage_staff")
    .delete()
    .eq("garage_id", garage.id)
    .eq("profile_id", profileId);

  // They're no longer one of this garage's mechanics, so their upcoming
  // jobs must go to someone who is.
  const result = await reassignUpcomingJobs(supabase, garage.id, profileId);

  revalidateLocalizedPath("/garage/staff");
  revalidateLocalizedPath("/garage/calendar");
  redirect(staffUrl(lang, result));
}

/** The owner's "I also work on cars" switch (garages.owner_takes_bookings). */
export async function setOwnerTakesBookings(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);
  const takesBookings = formData.get("takesBookings") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("garages")
    .update({ owner_takes_bookings: takesBookings })
    .eq("id", garage.id);

  if (error) {
    console.error("[staff] could not update owner_takes_bookings:", error);
    redirect(`/${lang}/garage/staff?error=1`);
  }

  const result = takesBookings
    ? { moved: 0, stranded: 0 }
    : await reassignUpcomingJobs(supabase, garage.id, garage.owner_id);

  revalidateLocalizedPath("/garage/staff");
  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garages");
  redirect(staffUrl(lang, result));
}

const ACCEPT_RESULTS = ["accepted", "not_found", "not_mechanic", "already_staff"] as const;

/** Called by the invited mécanicien from the /garage/dashboard empty state. */
export async function acceptMechanicInvite(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await getAuthedUser(lang);
  const inviteId = formData.get("inviteId");

  if (typeof inviteId !== "string" || !inviteId) {
    redirect(`/${lang}/garage/dashboard?invite=not_found`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_garage_invite", {
    target_invite_id: inviteId,
  });

  const result =
    !error && ACCEPT_RESULTS.includes(data as (typeof ACCEPT_RESULTS)[number])
      ? (data as (typeof ACCEPT_RESULTS)[number])
      : "error";

  if (error) {
    console.error("[staff] accept_garage_invite failed:", error);
  }

  revalidateLocalizedPath("/garage/dashboard");
  revalidateLocalizedPath("/garage/staff");
  // On success the dashboard itself (now showing the garage) is the
  // confirmation; every other outcome is explained on the empty state.
  redirect(
    result === "accepted"
      ? `/${lang}/garage/dashboard`
      : `/${lang}/garage/dashboard?invite=${result}`
  );
}

export async function declineMechanicInvite(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  await getAuthedUser(lang);
  const inviteId = formData.get("inviteId");

  if (typeof inviteId === "string" && inviteId) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("decline_garage_invite", {
      target_invite_id: inviteId,
    });
    if (error) {
      console.error("[staff] decline_garage_invite failed:", error);
    }
  }

  revalidateLocalizedPath("/garage/dashboard");
  redirect(`/${lang}/garage/dashboard?invite=declined`);
}
