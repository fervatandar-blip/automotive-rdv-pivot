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
