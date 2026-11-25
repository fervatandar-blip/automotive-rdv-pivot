import Link from "next/link";
import {
  CalendarClock,
  Car,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
  Star,
} from "lucide-react";
import { submitReview } from "@/app/actions/reviews";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { REPAIR_STAGES } from "@/lib/definitions";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { directionsUrl, mapSearchUrl } from "@/lib/maps";
import { isOpen, type ClientAppointment } from "@/lib/client-appointments";
import { LicensePlate } from "@/components/license-plate";
import { CancelBookingButton } from "@/components/cancel-booking-button";
import {
  CLIENT_PILL_ICON,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_TEXT_LINK,
  CLIENT_TINTED_PILL,
} from "@/lib/client-ui";

// Building blocks shared by the Overview and Appointments pages. Server
// components; the only interactive parts are the cancel button (client)
// and the review form (a native <details>).

export function dateLocaleFor(lang: Locale) {
  return lang === "fr" ? "fr-FR" : "en-GB";
}

function part(iso: string, lang: Locale, options: Intl.DateTimeFormatOptions) {
  return new Date(iso).toLocaleString(dateLocaleFor(lang), { timeZone: APP_TIME_ZONE, ...options });
}

export function formatTime(iso: string, lang: Locale) {
  return part(iso, lang, { hour: "2-digit", minute: "2-digit" });
}

export function formatLongDate(iso: string, lang: Locale) {
  return part(iso, lang, { weekday: "long", day: "numeric", month: "long" });
}

function shortPart(iso: string, lang: Locale, options: Intl.DateTimeFormatOptions) {
  // "déc." -> "déc": the block is uppercase and tight, a trailing dot reads as noise.
  return part(iso, lang, options).replace(".", "");
}

/**
 * A calendar-leaf date. Blue for what's ahead, neutral for history (with
 * the year in place of the weekday).
 */
export function DateBlock({
  iso,
  lang,
  tone = "upcoming",
  size = "md",
}: {
  iso: string;
  lang: Locale;
  tone?: "upcoming" | "past";
  size?: "md" | "lg";
}) {
  const big = size === "lg";
  const past = tone === "past";
  return (
    <time
      dateTime={iso}
      className={`flex shrink-0 flex-col items-center justify-center rounded-xl text-center ${
        past
          ? "bg-subtle text-ink"
          : "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
      } ${big ? "min-w-[4.75rem] px-4 py-3" : "min-w-16 px-3 py-2.5"}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {past ? shortPart(iso, lang, { year: "numeric" }) : shortPart(iso, lang, { weekday: "short" })}
      </span>
      <span className={`font-display font-bold leading-none tracking-[-0.02em] ${big ? "my-1 text-3xl" : "my-0.5 text-2xl"}`}>
        {part(iso, lang, { day: "numeric" })}
      </span>
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {shortPart(iso, lang, { month: "short" })}
      </span>
    </time>
  );
}

const STATUS_STYLE: Record<string, { key: keyof Dictionary["clientDashboard"]; className: string }> = {
  confirmed: {
    key: "statusConfirmed",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  },
  pending: { key: "statusPending", className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300" },
  pending_payment: {
    key: "paymentProcessing",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  },
  completed: { key: "completed", className: "bg-subtle text-ink-muted" },
  cancelled: { key: "cancelled", className: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" },
};

/** Status as a soft coloured pill. */
export function StatusLabel({ status, d }: { status: string; d: Dictionary["clientDashboard"] }) {
  const style = STATUS_STYLE[status];
  if (!style) return null;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {d[style.key] as string}
    </span>
  );
}

function stageIndex(stage: string | null) {
  return stage ? REPAIR_STAGES.indexOf(stage as (typeof REPAIR_STAGES)[number]) : -1;
}

/** The five repair stages as a segmented track with the current label. */
export function RepairStageTrack({
  stage,
  labels,
}: {
  stage: string | null;
  labels: Dictionary["common"]["repairStage"];
}) {
  const current = stageIndex(stage);
  if (current < 0) return null;
  const done = current === REPAIR_STAGES.length - 1;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-subtle p-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-ink">
          {done && <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          {labels[REPAIR_STAGES[current]]}
        </span>
        <span className="tabular-nums text-xs font-medium text-ink-muted">
          {current + 1}/{REPAIR_STAGES.length}
        </span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {REPAIR_STAGES.map((key, index) => (
          <li
            key={key}
            title={labels[key]}
            aria-current={index === current ? "step" : undefined}
            className={`h-1.5 rounded-full ${index <= current ? "bg-ink" : "bg-hairline"}`}
          >
            <span className="sr-only">{labels[key]}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** One-line repair stage for dense cards: "Diagnostic 2/5". */
export function RepairStageText({
  stage,
  labels,
}: {
  stage: string | null;
  labels: Dictionary["common"]["repairStage"];
}) {
  const current = stageIndex(stage);
  if (current < 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      {current === REPAIR_STAGES.length - 1 && (
        <CheckCircle2 aria-hidden className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
      )}
      <span className="font-semibold text-ink">{labels[REPAIR_STAGES[current]]}</span>
      <span className="tabular-nums text-xs">
        {current + 1}/{REPAIR_STAGES.length}
      </span>
    </span>
  );
}

export function vehicleLabel(vehicle: ClientAppointment["vehicles"]) {
  return vehicle ? [vehicle.brands?.name, vehicle.model].filter(Boolean).join(" ") : "";
}

/** Workshop name and city, the city linking to the map. */
export function WorkshopLine({ appointment, d }: { appointment: ClientAppointment; d: Dictionary["clientDashboard"] }) {
  const garage = appointment.garages;
  const name = garage?.name ?? d.garageFallback;
  const place = garage?.city?.trim() || garage?.address?.trim() || "";
  const placeUrl = garage ? mapSearchUrl(garage) : null;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <span className="truncate font-medium text-ink">{name}</span>
      {place &&
        (placeUrl ? (
          <a
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={d.showOnMap.replace("{place}", place)}
            className="inline-flex items-center gap-1 text-ink-muted underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-current"
          >
            <MapPin aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {place}
          </a>
        ) : (
          <span className="inline-flex items-center gap-1 text-ink-muted">
            <MapPin aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            {place}
          </span>
        ))}
    </span>
  );
}

/** "Clock 09:30" */
export function TimeTag({ iso, lang }: { iso: string; lang: Locale }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      <Clock aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="tabular-nums font-medium text-ink">{formatTime(iso, lang)}</span>
    </span>
  );
}

/** Message, Reschedule and Directions on the left; Cancel apart on the right. */
export function UpcomingActions({
  appointment,
  lang,
  d,
}: {
  appointment: ClientAppointment;
  lang: Locale;
  d: Dictionary["clientDashboard"];
}) {
  const garage = appointment.garages;
  const garageName = garage?.name ?? d.garageFallback;
  const open = isOpen(appointment);
  const routeUrl = open && garage ? directionsUrl(garage) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/${lang}/messages?a=${appointment.id}`} className={CLIENT_TINTED_PILL}>
        <MessageSquare aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
        {d.message}
      </Link>
      {open && (
        <Link href={`/${lang}/appointments/${appointment.id}/reschedule`} className={CLIENT_TINTED_PILL}>
          <CalendarClock aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
          {d.reschedule}
        </Link>
      )}
      {routeUrl && (
        <a
          href={routeUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={d.directionsTo.replace("{name}", garageName)}
          className={CLIENT_TINTED_PILL}
        >
          <Navigation aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
          {d.directions}
        </a>
      )}
      {open && (
        <CancelBookingButton
          appointmentId={appointment.id}
          lang={lang}
          labels={{
            cancel: d.cancel,
            confirm: d.cancelConfirm,
            yes: d.cancelConfirmYes,
            keep: d.cancelKeep,
            cancelling: d.cancelling,
            failed: d.cancelFailed,
            notAllowed: d.cancelNotAllowed,
          }}
        />
      )}
    </div>
  );
}

/** Invoice and message links for a past appointment. */
export function PastActions({
  appointment,
  lang,
  d,
  invoiceUrl,
}: {
  appointment: ClientAppointment;
  lang: Locale;
  d: Dictionary["clientDashboard"];
  invoiceUrl?: string;
}) {
  const garageName = appointment.garages?.name ?? d.garageFallback;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <Link
        href={`/${lang}/messages?a=${appointment.id}`}
        aria-label={d.messageWorkshop.replace("{name}", garageName)}
        className={CLIENT_TEXT_LINK}
      >
        <MessageSquare aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {d.message}
      </Link>
      {invoiceUrl && (
        <a href={invoiceUrl} className={CLIENT_TEXT_LINK}>
          <FileText aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          {d.downloadInvoice}
        </a>
      )}
    </div>
  );
}

/** Collapsed review form: one click to open instead of a form on every card. */
export function ReviewForm({
  appointmentId,
  lang,
  d,
  label,
}: {
  appointmentId: string;
  lang: Locale;
  d: Dictionary["clientDashboard"];
  label: string;
}) {
  const ratingOptions = (["5", "4", "3", "2", "1"] as const).map((value) => ({
    value,
    label: d.ratingOptions[value],
  }));
  const field =
    "rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10";

  return (
    <details className="group w-full">
      <summary className={`${CLIENT_TINTED_PILL} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <Star aria-hidden className="h-4 w-4 fill-amber-400 text-amber-400" strokeWidth={1.5} />
        {label}
      </summary>
      <form action={submitReview} className="mt-3 flex max-w-md flex-col gap-2.5">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="lang" value={lang} />
        <select name="rating" defaultValue="5" aria-label={d.leaveAReview} className={field}>
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <textarea
          name="comment"
          placeholder={d.optionalComment}
          aria-label={d.optionalComment}
          rows={2}
          className={field}
        />
        <button type="submit" className={`${CLIENT_PRIMARY_BUTTON} self-start`}>
          {d.submit}
        </button>
      </form>
    </details>
  );
}

/** Car icon, plate and model. */
export function VehicleTag({
  vehicle,
  plateLabel,
}: {
  vehicle: ClientAppointment["vehicles"];
  plateLabel: string;
}) {
  const plate = vehicle?.license_plate?.trim();
  const name = vehicleLabel(vehicle);
  if (!plate && !name) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-ink-muted">
      <Car aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      {plate && <LicensePlate plate={plate} label={plateLabel} />}
      {name && <span className="truncate">{name}</span>}
    </span>
  );
}
