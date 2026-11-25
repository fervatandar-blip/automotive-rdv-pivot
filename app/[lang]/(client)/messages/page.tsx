import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, MapPin, MessageSquare, Navigation, Phone } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { EmptyStateCard } from "@/components/empty-state-card";
import { LicensePlate } from "@/components/license-plate";
import { ChatThread } from "@/components/chat-thread";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { directionsUrl } from "@/lib/maps";
import { getClientUnreadCounts } from "@/lib/unread-messages";
import {
  CLIENT_CARD,
  CLIENT_CANVAS,
  CLIENT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
  CLIENT_SECTION_LABEL,
  CLIENT_TINTED_PILL,
  CLIENT_PILL_ICON,
} from "@/lib/client-ui";
import {
  groupConversations,
  replyAppointment,
  type Conversation,
  type ConversationMessage,
} from "@/lib/client-conversations";

type AppointmentRow = {
  id: string;
  garage_id: string;
  vehicle_id: string | null;
  start_time: string;
  status: string;
  services: { name: string } | null;
  garages: {
    name: string;
    phone: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  vehicles: {
    model: string | null;
    license_plate: string | null;
    brands: { name: string } | null;
  } | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The page fills the viewport: all of it from md (no top bar there), and
// below md what the phone top bar (h-14) and tab bar (h-16 + home
// indicator, which <main> pads for) leave. The inbox panel then takes
// whatever height the page title leaves, so the composer stays anchored on
// screen however tall the title wraps.
const PAGE_HEIGHT = "h-[calc(100dvh-3.5rem-4rem-env(safe-area-inset-bottom))] md:h-dvh";

function dateLocaleFor(lang: Locale) {
  return lang === "fr" ? "fr-FR" : "en-GB";
}

function formatListTime(iso: string, lang: Locale) {
  const date = new Date(iso);
  const sameDay =
    date.toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE }) ===
    new Date().toLocaleDateString("en-CA", { timeZone: APP_TIME_ZONE });
  return date.toLocaleString(
    dateLocaleFor(lang),
    sameDay
      ? { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" }
      : { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" },
  );
}

function formatBookingDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(dateLocaleFor(lang), {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : null;
}

function vehicleName(vehicle: AppointmentRow["vehicles"]) {
  return vehicle ? [vehicle.brands?.name, vehicle.model].filter(Boolean).join(" ") : "";
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { clientMessages } = await getDictionary(resolveLocale(lang));
  return { title: clientMessages.title };
}

export default async function ClientMessagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ a?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    redirect(`/${lang}/garage/messages`);
  }

  const dictionary = await getDictionary(lang);
  const d = dictionary.clientMessages;
  const { a } = await searchParams;
  const requestedId = a && UUID.test(a) ? a.toLowerCase() : null;
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, garage_id, vehicle_id, start_time, status, services(name), garages!appointments_garage_id_fkey(name, phone, address, city, latitude, longitude), vehicles(model, license_plate, brands(name))",
    )
    .eq("client_id", profile.id);

  const rows = (appointments ?? []) as unknown as AppointmentRow[];
  const [messagesResult, unread] = await Promise.all([
    rows.length > 0
      ? supabase
          .from("messages")
          .select("id, appointment_id, sender_id, body, created_at")
          .in(
            "appointment_id",
            rows.map((row) => row.id),
          )
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as ConversationMessage[] }),
    getClientUnreadCounts(supabase),
  ]);
  const messages = (messagesResult.data ?? []) as ConversationMessage[];
  const conversations = groupConversations(rows, messages, unread, { keepAppointmentId: requestedId });

  // The conversation to open: the one holding the requested booking, else
  // (desktop only) the most recent one.
  const requested = requestedId
    ? conversations.find((conversation) => conversation.appointments.some((row) => row.id === requestedId))
    : undefined;
  const active: Conversation<AppointmentRow> | undefined = requested ?? conversations[0];
  const showThreadOnPhone = Boolean(requested);

  const header = (
    <header className={`flex flex-col gap-1 ${showThreadOnPhone ? "hidden md:flex" : ""}`}>
      <h1 className={CLIENT_PAGE_TITLE}>{d.title}</h1>
      <p className={CLIENT_PAGE_SUBTITLE}>{d.subtitle}</p>
    </header>
  );

  if (conversations.length === 0) {
    return (
      <div className={CLIENT_PAGE}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          {header}
          <EmptyStateCard
            icon={MessageSquare}
            title={d.emptyTitle}
            description={d.emptyDescription}
            ctaHref={`/${lang}/garages`}
            ctaLabel={d.findWorkshop}
          />
        </div>
      </div>
    );
  }

  const garage = active.appointments[0].garages;
  const garageName = garage?.name ?? d.workshopFallback;
  const reply = replyAppointment(active, requestedId);
  const activeVehicle = active.appointments[active.appointments.length - 1].vehicles;
  const activeVehicleName = vehicleName(activeVehicle);
  const activePlate = activeVehicle?.license_plate?.trim();
  const phoneHref = garage?.phone ? telHref(garage.phone) : null;
  const routeUrl = garage ? directionsUrl(garage) : null;
  const activeIds = active.appointments.map((row) => row.id);
  const activeIdSet = new Set(activeIds);
  const bookingLabel = (row: AppointmentRow) =>
    d.regarding
      .replace("{service}", row.services?.name ?? d.serviceFallback)
      .replace("{date}", formatBookingDate(row.start_time, lang));
  const appointmentLabels = Object.fromEntries(active.appointments.map((row) => [row.id, bookingLabel(row)]));

  return (
    <div className={`${PAGE_HEIGHT} flex flex-col ${CLIENT_CANVAS} px-4 py-4 sm:px-8 sm:py-8`}>
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5">
        {header}

        {/* min-h keeps the thread usable on very short windows; there the
            page scrolls instead of squeezing the composer away. */}
        <div className={`${CLIENT_CARD} flex min-h-[22rem] flex-1 overflow-hidden`}>
          {/* Conversation list */}
          <nav
            aria-label={d.conversations}
            className={`${showThreadOnPhone ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-hairline md:w-80 md:border-r`}
          >
            <h2 className={`border-b border-hairline px-4 py-3 ${CLIENT_SECTION_LABEL}`}>
              {d.conversations}
            </h2>
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {conversations.map((conversation) => {
                const first = conversation.appointments[0];
                const latest = conversation.appointments[conversation.appointments.length - 1];
                const name = first.garages?.name ?? d.workshopFallback;
                const plate = latest.vehicles?.license_plate?.trim();
                const car = vehicleName(latest.vehicles);
                const selected = conversation.key === active.key;
                const preview = conversation.lastMessage
                  ? `${conversation.lastMessage.sender_id === profile.id ? `${dictionary.appointmentMessages.chatThread.you}: ` : ""}${conversation.lastMessage.body}`
                  : d.noMessagesPreview;
                return (
                  <li key={conversation.key}>
                    <Link
                      href={`/${lang}/messages?a=${replyAppointment(conversation, null).id}`}
                      aria-current={selected ? "true" : undefined}
                      className={`flex flex-col gap-1.5 border-b border-hairline px-4 py-3 transition-colors ${
                        selected
                          ? "md:bg-subtle"
                          : "hover:bg-subtle/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`truncate text-[15px] text-ink ${conversation.unread > 0 ? "font-bold" : "font-semibold"}`}
                        >
                          {name}
                        </span>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {formatListTime(conversation.lastActivityAt, lang)}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-2 text-xs text-ink-muted">
                        {plate ? (
                          <LicensePlate plate={plate} label={dictionary.clientDashboard.plateLabel} />
                        ) : (
                          !car && <span>{d.noVehicle}</span>
                        )}
                        {car && <span className="truncate">{car}</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={`truncate text-sm ${
                            conversation.unread > 0
                              ? "font-medium text-ink"
                              : "text-ink-muted"
                          }`}
                        >
                          {preview}
                        </p>
                        {conversation.unread > 0 && (
                          <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-ink px-1.5 font-mono text-[11px] font-semibold text-surface">
                            <span aria-hidden>{conversation.unread}</span>
                            <span className="sr-only">{d.unread.replace("{count}", String(conversation.unread))}</span>
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Thread */}
          <section
            aria-labelledby="thread-title"
            className={`${showThreadOnPhone ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}
          >
            <div className="flex shrink-0 flex-col gap-2 border-b border-hairline px-4 py-3 sm:px-6">
              <Link
                href={`/${lang}/messages`}
                className="inline-flex items-center gap-1 self-start text-sm font-medium text-ink-muted hover:text-ink md:hidden"
              >
                <ArrowLeft aria-hidden className="h-4 w-4" />
                {d.back}
              </Link>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="thread-title" className="truncate text-lg font-bold tracking-tight text-ink">
                    {garageName}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
                    {activePlate && <LicensePlate plate={activePlate} label={dictionary.clientDashboard.plateLabel} />}
                    {activeVehicleName && <span>{activeVehicleName}</span>}
                    {garage?.address && (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">
                          {[garage.address, garage.city].filter(Boolean).join(", ")}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                {(phoneHref || routeUrl) && (
                  <div className="flex shrink-0 items-center gap-2">
                    {phoneHref && garage?.phone && (
                      <a
                        href={phoneHref}
                        aria-label={d.callNamed.replace("{name}", garageName)}
                        title={garage.phone}
                        className={CLIENT_TINTED_PILL}
                      >
                        <Phone aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
                        <span className="hidden sm:inline">{garage.phone}</span>
                        <span className="sm:hidden">{d.call}</span>
                      </a>
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
                  </div>
                )}
              </div>
              <p className="truncate text-sm text-ink-muted">{bookingLabel(reply)}</p>
            </div>

            <ChatThread
              key={active.key}
              appointmentId={reply.id}
              threadAppointmentIds={activeIds}
              appointmentLabels={active.appointments.length > 1 ? appointmentLabels : undefined}
              currentUserId={profile.id}
              clientId={profile.id}
              clientName={profile.full_name || dictionary.appointmentMessages.chatThread.you}
              garageName={garageName}
              initialMessages={messages.filter((message) => activeIdSet.has(message.appointment_id))}
              dictionary={{ ...dictionary.appointmentMessages.chatThread, noMessagesYet: d.noMessagesYet }}
              timeLocale={dateLocaleFor(lang)}
              markRead
              initialUnread={active.unread}
              variant="pane"
            />
          </section>
        </div>
      </div>
    </div>
  );
}
