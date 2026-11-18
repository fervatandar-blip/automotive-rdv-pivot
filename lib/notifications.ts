// escapeHtml: names and service titles are user-controlled and go into
// HTML email bodies.
import { escapeHtml, sendEmail } from "@/lib/email";
import { sendPushToProfile } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import {
  formatDay,
  formatWhen,
  NOTIFICATION_COPY,
  type Message,
  type RepairStage,
  type StatusChange,
  type Vars,
} from "@/lib/notification-copy";

type GarageNotificationColumn = "notify_new_booking" | "notify_cancellation";

// Service-role read regardless of caller context (a session-bound server
// action or the unauthenticated Stripe webhook) -- garages RLS shouldn't
// gate whether its own notification preference can be checked. This is a
// content-level filter applied uniformly across every active channel
// (email, push), not a per-channel switch. Fails open (true) on a
// missing/unreadable row so a lookup glitch can't silently swallow every
// notification.
async function isGarageNotificationEnabled(
  garageId: string,
  column: GarageNotificationColumn
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("garages")
    .select(column)
    .eq("id", garageId)
    .maybeSingle();
  return data ? Boolean((data as Record<string, boolean>)[column]) : true;
}

type RecipientPrefs = {
  locale: Locale;
  // Client opt-outs for the two non-essential notifications (0044).
  repairUpdates: boolean;
  waitlist: boolean;
};

// The recipient's language (0046) and opt-outs in one service-role read.
// Fails open like the garage check: default language, everything on.
async function getRecipientPrefs(profileId: string): Promise<RecipientPrefs> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("preferred_locale, notify_repair_updates, notify_waitlist")
    .eq("id", profileId)
    .maybeSingle();
  const locale = data?.preferred_locale;
  return {
    locale: typeof locale === "string" && isLocale(locale) ? locale : defaultLocale,
    repairUpdates: data?.notify_repair_updates !== false,
    waitlist: data?.notify_waitlist !== false,
  };
}

/** Email (when there's an address) and push, from one localized message. */
async function deliver({
  message,
  vars,
  recipientProfileId,
  recipientEmail,
}: {
  message: Message;
  vars: Vars;
  recipientProfileId: string;
  recipientEmail: string | null;
}) {
  if (recipientEmail) {
    await sendEmail({
      to: recipientEmail,
      subject: message.subject,
      html: message.html({
        name: escapeHtml(vars.name),
        service: escapeHtml(vars.service),
        other: escapeHtml(vars.other),
        when: escapeHtml(vars.when),
      }),
    });
  }

  await sendPushToProfile({
    profileId: recipientProfileId,
    title: message.pushTitle,
    body: message.push(vars),
  });
}

export async function notifyAppointmentStatusChange({
  status,
  recipientProfileId,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
  recipientGarageId,
}: {
  status: StatusChange;
  recipientProfileId: string;
  recipientEmail: string | null;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
  // Set only when the recipient IS the garage -- confirmed/completed never
  // notify a garage today (both always originate from a garage action, so
  // they only ever notify the client), only a client-initiated cancellation
  // does.
  recipientGarageId?: string;
}) {
  const notificationAllowed =
    !recipientGarageId ||
    status !== "cancelled" ||
    (await isGarageNotificationEnabled(recipientGarageId, "notify_cancellation"));
  if (!notificationAllowed) return;

  const { locale } = await getRecipientPrefs(recipientProfileId);
  const message = NOTIFICATION_COPY[locale].status[status];
  if (!message) return;

  await deliver({
    message,
    vars: { name: recipientName, service: serviceName, other: otherPartyName, when: formatWhen(startTime, locale) },
    recipientProfileId,
    recipientEmail,
  });
}

export async function notifyRepairStageChange({
  stage,
  recipientProfileId,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
}: {
  stage: string;
  recipientProfileId: string;
  recipientEmail: string | null;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
}) {
  const prefs = await getRecipientPrefs(recipientProfileId);
  if (!prefs.repairUpdates) return;
  const message = NOTIFICATION_COPY[prefs.locale].repairStage[stage as RepairStage];
  if (!message) return;

  await deliver({
    message,
    vars: { name: recipientName, service: serviceName, other: otherPartyName, when: "" },
    recipientProfileId,
    recipientEmail,
  });
}

export async function notifyBookingReceived({
  recipient,
  recipientProfileId,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
  recipientGarageId,
}: {
  recipient: "client" | "garage";
  recipientProfileId: string;
  recipientEmail: string | null;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
  // Required in practice when recipient === "garage".
  recipientGarageId?: string;
}) {
  if (
    recipient === "garage" &&
    recipientGarageId &&
    !(await isGarageNotificationEnabled(recipientGarageId, "notify_new_booking"))
  ) {
    return;
  }

  const { locale } = await getRecipientPrefs(recipientProfileId);
  await deliver({
    message: NOTIFICATION_COPY[locale].bookingReceived[recipient],
    vars: { name: recipientName, service: serviceName, other: otherPartyName, when: formatWhen(startTime, locale) },
    recipientProfileId,
    recipientEmail,
  });
}

/**
 * A client's online booking, confirmed on the spot and paid at the garage
 * (pay-on-site pilot, 0040). Same recipients and garage opt-out
 * (notify_new_booking) as notifyBookingReceived, which remains for bookings
 * still coming through Stripe Checkout from before the pilot.
 */
export async function notifyBookingConfirmed({
  recipient,
  recipientProfileId,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
  recipientGarageId,
}: {
  recipient: "client" | "garage";
  recipientProfileId: string;
  recipientEmail: string | null;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
  // Required in practice when recipient === "garage".
  recipientGarageId?: string;
}) {
  if (
    recipient === "garage" &&
    recipientGarageId &&
    !(await isGarageNotificationEnabled(recipientGarageId, "notify_new_booking"))
  ) {
    return;
  }

  const { locale } = await getRecipientPrefs(recipientProfileId);
  await deliver({
    message: NOTIFICATION_COPY[locale].bookingConfirmed[recipient],
    vars: { name: recipientName, service: serviceName, other: otherPartyName, when: formatWhen(startTime, locale) },
    recipientProfileId,
    recipientEmail,
  });
}

export async function notifyAppointmentRescheduled({
  recipientProfileId,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
}: {
  recipientProfileId: string;
  recipientEmail: string | null;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
}) {
  const { locale } = await getRecipientPrefs(recipientProfileId);
  await deliver({
    message: NOTIFICATION_COPY[locale].rescheduled,
    vars: { name: recipientName, service: serviceName, other: otherPartyName, when: formatWhen(startTime, locale) },
    recipientProfileId,
    recipientEmail,
  });
}

export async function notifyWaitlistSlotOpened({
  recipientProfileId,
  recipientEmail,
  recipientName,
  garageName,
  serviceName,
  date,
}: {
  recipientProfileId: string;
  recipientEmail: string;
  recipientName: string;
  garageName: string;
  serviceName: string;
  date: string;
}) {
  const prefs = await getRecipientPrefs(recipientProfileId);
  if (!prefs.waitlist) return;

  await deliver({
    message: NOTIFICATION_COPY[prefs.locale].waitlistSlot,
    vars: { name: recipientName, service: serviceName, other: garageName, when: formatDay(date, prefs.locale) },
    recipientProfileId,
    recipientEmail,
  });
}
