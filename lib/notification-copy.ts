// Email and push copy for lib/notifications.ts, in each recipient's
// language (profiles.preferred_locale, 0046).
//
// Every function takes the same Vars. For email bodies the caller passes
// HTML-escaped values (names and service titles are user-controlled); for
// subjects and push text it passes them raw.

import type { Locale } from "@/lib/i18n/config";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";

export type Vars = {
  name: string; // recipient
  service: string;
  other: string; // the other party: the garage, or the client
  when: string; // formatted with formatWhen / formatDay
};

export type Message = {
  subject: string;
  pushTitle: string;
  html: (v: Vars) => string;
  push: (v: Vars) => string;
};

export type StatusChange = "confirmed" | "cancelled" | "completed";
export type RepairStage = "received" | "diagnosis" | "in_repair" | "quality_check" | "ready_for_pickup";

type Copy = {
  status: Record<StatusChange, Message>;
  repairStage: Record<RepairStage, Message>;
  bookingReceived: { client: Message; garage: Message };
  bookingConfirmed: { client: Message; garage: Message };
  rescheduled: Message;
  waitlistSlot: Message;
  staffInvite: { subject: (garage: string) => string; html: (v: { garage: string; loginUrl: string }) => string };
};

const DATE_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-GB" };

/** "mardi 18 novembre à 14:30" / "Tuesday 18 November at 14:30", Luxembourg time. */
export function formatWhen(iso: string, locale: Locale) {
  return new Date(iso).toLocaleString(DATE_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** A "YYYY-MM-DD" day: "mardi 18 novembre" / "Tuesday 18 November". */
export function formatDay(dateKey: string, locale: Locale) {
  return dateKeyToDisplayDate(dateKey).toLocaleDateString(DATE_LOCALE[locale], {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function stageMessages(
  hi: (name: string) => string,
  stages: Record<RepairStage, { subject: string; label: string }>,
  body: (v: Vars, label: string) => string,
  push: (v: Vars, label: string) => string
): Record<RepairStage, Message> {
  const entries = Object.entries(stages) as [RepairStage, { subject: string; label: string }][];
  return Object.fromEntries(
    entries.map(([stage, { subject, label }]) => [
      stage,
      {
        subject,
        pushTitle: subject,
        html: (v: Vars) => `<p>${hi(v.name)}</p><p>${body(v, label)}</p>`,
        push: (v: Vars) => push(v, label),
      },
    ])
  ) as Record<RepairStage, Message>;
}

const en: Copy = (() => {
  const hi = (name: string) => `Hi ${name},`;
  const hello = (name: string) => `Hello ${name},`;
  const status = (subject: string, verb: string): Message => ({
    subject,
    pushTitle: subject,
    html: (v) =>
      `<p>${hi(v.name)}</p><p>Your <strong>${v.service}</strong> appointment with ${v.other} on ${v.when} has been ${verb}.</p>`,
    push: (v) => `${v.service} with ${v.other} — ${verb}.`,
  });
  return {
    status: {
      confirmed: status("Your appointment is confirmed", "confirmed"),
      cancelled: status("Your appointment was cancelled", "cancelled"),
      completed: status("Your appointment is complete", "marked complete"),
    },
    repairStage: stageMessages(
      hi,
      {
        received: { subject: "Your vehicle has been received", label: "received" },
        diagnosis: { subject: "Your vehicle is being diagnosed", label: "in diagnosis" },
        in_repair: { subject: "Your vehicle is being repaired", label: "in repair" },
        quality_check: { subject: "Your vehicle is in quality check", label: "in quality check" },
        ready_for_pickup: { subject: "Your vehicle is ready for pickup", label: "ready for pickup" },
      },
      (v, label) => `Your <strong>${v.service}</strong> service with ${v.other} is now <strong>${label}</strong>.`,
      (v, label) => `${v.service} with ${v.other} is now ${label}.`
    ),
    bookingReceived: {
      client: {
        subject: "Your booking request was received",
        pushTitle: "Booking request received",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>We've received your <strong>${v.service}</strong> booking with ${v.other} on ${v.when}. You'll hear from us as soon as it's confirmed.</p>`,
        push: (v) => `${v.service} with ${v.other} on ${v.when}.`,
      },
      garage: {
        subject: "New booking request",
        pushTitle: "New booking request",
        html: (v) =>
          `<p>${hello(v.name)}</p><p>New booking request: <strong>${v.service}</strong> for ${v.other} on ${v.when}. Confirmation is required from the dashboard.</p>`,
        push: (v) => `${v.service} from ${v.other} on ${v.when}.`,
      },
    },
    bookingConfirmed: {
      client: {
        subject: "Your booking is confirmed",
        pushTitle: "Booking confirmed",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>Your <strong>${v.service}</strong> appointment with ${v.other} on ${v.when} is confirmed. You'll pay at the garage (cash or card).</p>`,
        push: (v) => `${v.service} with ${v.other} on ${v.when}. Pay at the garage.`,
      },
      garage: {
        subject: "New booking",
        pushTitle: "New booking",
        html: (v) =>
          `<p>${hello(v.name)}</p><p>New booking: <strong>${v.service}</strong> for ${v.other} on ${v.when}. The appointment has been added to the agenda; payment is collected on site.</p>`,
        push: (v) => `${v.service} from ${v.other} on ${v.when}.`,
      },
    },
    rescheduled: {
      subject: "Your appointment was rescheduled",
      pushTitle: "Appointment rescheduled",
      html: (v) =>
        `<p>${hi(v.name)}</p><p>Your <strong>${v.service}</strong> appointment with ${v.other} has been moved to ${v.when}.</p>`,
      push: (v) => `${v.service} with ${v.other} is now ${v.when}.`,
    },
    waitlistSlot: {
      subject: "A slot may have opened up",
      pushTitle: "A slot may have opened up",
      html: (v) =>
        `<p>${hi(v.name)}</p><p>A booking for <strong>${v.service}</strong> at ${v.other} on ${v.when} was just cancelled. If you're still interested, book now: it's first come, first served.</p>`,
      push: (v) => `${v.service} at ${v.other} on ${v.when}.`,
    },
    staffInvite: {
      subject: (garage) => `${garage} invited you to join their team on RDV`,
      html: ({ garage, loginUrl }) =>
        `<p>Hi,</p><p><strong>${garage}</strong> has invited you to join their team as a mechanic on RDV.</p><p>Sign in at <a href="${loginUrl}">${loginUrl}</a> to accept or decline. The invitation expires in 14 days.</p><p>If you weren't expecting this, you can ignore this email: nothing changes unless you accept.</p>`,
    },
  };
})();

const fr: Copy = (() => {
  const hi = (name: string) => `Bonjour ${name},`;
  const status = (subject: string, participle: string): Message => ({
    subject,
    pushTitle: subject,
    html: (v) =>
      `<p>${hi(v.name)}</p><p>Votre rendez-vous <strong>${v.service}</strong> avec ${v.other} le ${v.when} a été ${participle}.</p>`,
    push: (v) => `${v.service} avec ${v.other} : ${participle}.`,
  });
  return {
    status: {
      confirmed: status("Votre rendez-vous est confirmé", "confirmé"),
      cancelled: status("Votre rendez-vous a été annulé", "annulé"),
      completed: status("Votre rendez-vous est terminé", "marqué comme terminé"),
    },
    repairStage: stageMessages(
      hi,
      {
        received: { subject: "Votre véhicule a été réceptionné", label: "réceptionné" },
        diagnosis: { subject: "Votre véhicule est en diagnostic", label: "en diagnostic" },
        in_repair: { subject: "Votre véhicule est en réparation", label: "en réparation" },
        quality_check: { subject: "Votre véhicule est en contrôle qualité", label: "en contrôle qualité" },
        ready_for_pickup: { subject: "Votre véhicule est prêt à être récupéré", label: "prêt à être récupéré" },
      },
      (v, label) =>
        `Prestation <strong>${v.service}</strong> chez ${v.other} : votre véhicule est maintenant <strong>${label}</strong>.`,
      (v, label) => `${v.service} chez ${v.other} : ${label}.`
    ),
    bookingReceived: {
      client: {
        subject: "Votre demande de réservation a bien été reçue",
        pushTitle: "Demande de réservation reçue",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>Nous avons bien reçu votre réservation <strong>${v.service}</strong> chez ${v.other} le ${v.when}. Vous serez prévenu dès qu'elle sera confirmée.</p>`,
        push: (v) => `${v.service} chez ${v.other} le ${v.when}.`,
      },
      garage: {
        subject: "Nouvelle demande de réservation",
        pushTitle: "Nouvelle demande de réservation",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>Nouvelle demande de réservation : <strong>${v.service}</strong> pour ${v.other} le ${v.when}. Une confirmation est requise depuis le tableau de bord.</p>`,
        push: (v) => `${v.service} de ${v.other} le ${v.when}.`,
      },
    },
    bookingConfirmed: {
      client: {
        subject: "Votre réservation est confirmée",
        pushTitle: "Réservation confirmée",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>Votre rendez-vous <strong>${v.service}</strong> chez ${v.other} le ${v.when} est confirmé. Le paiement se fait au garage (espèces ou carte).</p>`,
        push: (v) => `${v.service} chez ${v.other} le ${v.when}. Paiement au garage.`,
      },
      garage: {
        subject: "Nouvelle réservation",
        pushTitle: "Nouvelle réservation",
        html: (v) =>
          `<p>${hi(v.name)}</p><p>Nouvelle réservation : <strong>${v.service}</strong> pour ${v.other} le ${v.when}. Le rendez-vous a été ajouté à l'agenda ; le paiement est encaissé sur place.</p>`,
        push: (v) => `${v.service} de ${v.other} le ${v.when}.`,
      },
    },
    rescheduled: {
      subject: "Votre rendez-vous a été déplacé",
      pushTitle: "Rendez-vous déplacé",
      html: (v) =>
        `<p>${hi(v.name)}</p><p>Votre rendez-vous <strong>${v.service}</strong> avec ${v.other} a été déplacé au ${v.when}.</p>`,
      push: (v) => `${v.service} avec ${v.other} : désormais le ${v.when}.`,
    },
    waitlistSlot: {
      subject: "Un créneau s'est peut-être libéré",
      pushTitle: "Un créneau s'est peut-être libéré",
      html: (v) =>
        `<p>${hi(v.name)}</p><p>Une réservation <strong>${v.service}</strong> chez ${v.other} le ${v.when} vient d'être annulée. Si vous êtes toujours intéressé, réservez dès maintenant : premier arrivé, premier servi.</p>`,
      push: (v) => `${v.service} chez ${v.other} le ${v.when}.`,
    },
    staffInvite: {
      subject: (garage) => `${garage} vous invite à rejoindre son équipe sur RDV`,
      html: ({ garage, loginUrl }) =>
        `<p>Bonjour,</p><p><strong>${garage}</strong> vous invite à rejoindre son équipe en tant que mécanicien sur RDV.</p><p>Connectez-vous sur <a href="${loginUrl}">${loginUrl}</a> pour accepter ou refuser. L'invitation expire dans 14 jours.</p><p>Si vous ne vous attendiez pas à ce message, ignorez-le : rien ne change tant que vous n'acceptez pas.</p>`,
    },
  };
})();

export const NOTIFICATION_COPY: Record<Locale, Copy> = { en, fr };
