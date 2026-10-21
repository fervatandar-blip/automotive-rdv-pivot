import { sendEmail } from "@/lib/email";
import { sendPushToProfile } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";

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

const STATUS_COPY: Record<string, { subject: string; verb: string }> = {
  confirmed: { subject: "Your appointment is confirmed", verb: "confirmed" },
  cancelled: { subject: "Your appointment was cancelled", verb: "cancelled" },
  completed: { subject: "Your appointment is complete", verb: "marked complete" },
};

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
  status: "confirmed" | "cancelled" | "completed";
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
  const copy = STATUS_COPY[status];
  if (!copy) return;

  const when = new Date(startTime).toLocaleString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const notificationAllowed =
    !recipientGarageId ||
    status !== "cancelled" ||
    (await isGarageNotificationEnabled(recipientGarageId, "notify_cancellation"));

  if (recipientEmail && notificationAllowed) {
    await sendEmail({
      to: recipientEmail,
      subject: copy.subject,
      html: `<p>Hi ${recipientName},</p><p>Your <strong>${serviceName}</strong> appointment with ${otherPartyName} on ${when} has been ${copy.verb}.</p>`,
    });
  }

  if (notificationAllowed) {
    await sendPushToProfile({
      profileId: recipientProfileId,
      title: copy.subject,
      body: `${serviceName} with ${otherPartyName} — ${copy.verb}.`,
    });
  }
}

const REPAIR_STAGE_COPY: Record<string, { subject: string; label: string }> = {
  received: { subject: "Your vehicle has been received", label: "received" },
  diagnosis: {
    subject: "Your vehicle is being diagnosed",
    label: "in diagnosis",
  },
  in_repair: { subject: "Your vehicle is being repaired", label: "in repair" },
  quality_check: {
    subject: "Your vehicle is in quality check",
    label: "in quality check",
  },
  ready_for_pickup: {
    subject: "Your vehicle is ready for pickup",
    label: "ready for pickup",
  },
};

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
  const copy = REPAIR_STAGE_COPY[stage];
  if (!copy) return;

  if (recipientEmail) {
    await sendEmail({
      to: recipientEmail,
      subject: copy.subject,
      html: `<p>Hi ${recipientName},</p><p>Your <strong>${serviceName}</strong> service with ${otherPartyName} is now <strong>${copy.label}</strong>.</p>`,
    });
  }

  await sendPushToProfile({
    profileId: recipientProfileId,
    title: copy.subject,
    body: `${serviceName} with ${otherPartyName} is now ${copy.label}.`,
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
  const when = new Date(startTime).toLocaleString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (recipient === "client") {
    if (recipientEmail) {
      await sendEmail({
        to: recipientEmail,
        subject: "Your booking request was received",
        html: `<p>Hi ${recipientName},</p><p>We've received your <strong>${serviceName}</strong> booking with ${otherPartyName} on ${when}. You'll hear from us as soon as it's confirmed.</p>`,
      });
    }
    await sendPushToProfile({
      profileId: recipientProfileId,
      title: "Booking request received",
      body: `${serviceName} with ${otherPartyName} on ${when}.`,
    });
    return;
  }

  const notificationAllowed =
    !recipientGarageId ||
    (await isGarageNotificationEnabled(recipientGarageId, "notify_new_booking"));

  if (recipientEmail && notificationAllowed) {
    await sendEmail({
      to: recipientEmail,
      subject: "New booking request",
      html: `<p>Hi ${recipientName},</p><p>You have a new <strong>${serviceName}</strong> booking request from ${otherPartyName} on ${when}. Confirm it from your dashboard.</p>`,
    });
  }
  if (notificationAllowed) {
    await sendPushToProfile({
      profileId: recipientProfileId,
      title: "New booking request",
      body: `${serviceName} from ${otherPartyName} on ${when}.`,
    });
  }
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
  const when = new Date(startTime).toLocaleString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (recipientEmail) {
    await sendEmail({
      to: recipientEmail,
      subject: "Your appointment was rescheduled",
      html: `<p>Hi ${recipientName},</p><p>Your <strong>${serviceName}</strong> appointment with ${otherPartyName} has been moved to ${when}.</p>`,
    });
  }

  await sendPushToProfile({
    profileId: recipientProfileId,
    title: "Appointment rescheduled",
    body: `${serviceName} with ${otherPartyName} is now ${when}.`,
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
  const when = dateKeyToDisplayDate(date).toLocaleDateString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  await sendEmail({
    to: recipientEmail,
    subject: "A slot may have opened up",
    html: `<p>Hi ${recipientName},</p><p>A booking for <strong>${serviceName}</strong> at ${garageName} on ${when} was just cancelled. If you're still interested, book now -- it's first come, first served.</p>`,
  });

  await sendPushToProfile({
    profileId: recipientProfileId,
    title: "A slot may have opened up",
    body: `${serviceName} at ${garageName} on ${when}.`,
  });
}
