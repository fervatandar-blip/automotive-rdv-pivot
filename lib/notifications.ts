import { sendEmail } from "@/lib/email";

const STATUS_COPY: Record<string, { subject: string; verb: string }> = {
  confirmed: { subject: "Your appointment is confirmed", verb: "confirmed" },
  cancelled: { subject: "Your appointment was cancelled", verb: "cancelled" },
  completed: { subject: "Your appointment is complete", verb: "marked complete" },
};

export async function notifyAppointmentStatusChange({
  status,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
}: {
  status: "confirmed" | "cancelled" | "completed";
  recipientEmail: string;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
}) {
  const copy = STATUS_COPY[status];
  if (!copy) return;

  const when = new Date(startTime).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  await sendEmail({
    to: recipientEmail,
    subject: copy.subject,
    html: `<p>Hi ${recipientName},</p><p>Your <strong>${serviceName}</strong> appointment with ${otherPartyName} on ${when} has been ${copy.verb}.</p>`,
  });
}

export async function notifyBookingReceived({
  recipient,
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
}: {
  recipient: "client" | "garage";
  recipientEmail: string;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
}) {
  const when = new Date(startTime).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  if (recipient === "client") {
    await sendEmail({
      to: recipientEmail,
      subject: "Your booking request was received",
      html: `<p>Hi ${recipientName},</p><p>We've received your <strong>${serviceName}</strong> booking with ${otherPartyName} on ${when}. You'll hear from us as soon as it's confirmed.</p>`,
    });
    return;
  }

  await sendEmail({
    to: recipientEmail,
    subject: "New booking request",
    html: `<p>Hi ${recipientName},</p><p>You have a new <strong>${serviceName}</strong> booking request from ${otherPartyName} on ${when}. Confirm it from your dashboard.</p>`,
  });
}

export async function notifyAppointmentRescheduled({
  recipientEmail,
  recipientName,
  otherPartyName,
  serviceName,
  startTime,
}: {
  recipientEmail: string;
  recipientName: string;
  otherPartyName: string;
  serviceName: string;
  startTime: string;
}) {
  const when = new Date(startTime).toLocaleString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  await sendEmail({
    to: recipientEmail,
    subject: "Your appointment was rescheduled",
    html: `<p>Hi ${recipientName},</p><p>Your <strong>${serviceName}</strong> appointment with ${otherPartyName} has been moved to ${when}.</p>`,
  });
}

export async function notifyWaitlistSlotOpened({
  recipientEmail,
  recipientName,
  garageName,
  serviceName,
  date,
}: {
  recipientEmail: string;
  recipientName: string;
  garageName: string;
  serviceName: string;
  date: string;
}) {
  const when = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  await sendEmail({
    to: recipientEmail,
    subject: "A slot may have opened up",
    html: `<p>Hi ${recipientName},</p><p>A booking for <strong>${serviceName}</strong> at ${garageName} on ${when} was just cancelled. If you're still interested, book now -- it's first come, first served.</p>`,
  });
}
