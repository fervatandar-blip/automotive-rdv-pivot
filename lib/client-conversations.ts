/**
 * Client inbox model. The database keeps one chat thread per appointment
 * (0017); a driver thinks in "my conversation with this workshop about this
 * car", so the inbox groups appointments by (workshop, vehicle) and shows
 * their messages as one thread.
 */

export type ConversationAppointment = {
  id: string;
  garage_id: string;
  vehicle_id: string | null;
  start_time: string;
  status: string;
};

export type ConversationMessage = {
  id: string;
  appointment_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Conversation<A extends ConversationAppointment> = {
  key: string;
  garageId: string;
  vehicleId: string | null;
  /** Oldest booking first. */
  appointments: A[];
  lastMessage: ConversationMessage | null;
  unread: number;
  /** The later of the last message and the latest booking's start time. */
  lastActivityAt: string;
};

export function conversationKey(garageId: string, vehicleId: string | null) {
  return `${garageId}:${vehicleId ?? "none"}`;
}

function isOpenUpcoming(appointment: ConversationAppointment, now: number) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= now
  );
}

/**
 * Groups bookings into conversations, newest activity first. A conversation
 * is listed when it has messages or a booking still ahead (somewhere to
 * start a chat); old bookings nobody wrote about stay out of the inbox,
 * unless `keepAppointmentId` is one of them (the driver asked to write
 * about it). `messages` must be sorted oldest first.
 */
export function groupConversations<A extends ConversationAppointment>(
  appointments: A[],
  messages: ConversationMessage[],
  unreadByAppointment: Map<string, number>,
  { now = Date.now(), keepAppointmentId = null }: { now?: number; keepAppointmentId?: string | null } = {},
): Conversation<A>[] {
  const byKey = new Map<string, Conversation<A>>();
  const keyByAppointment = new Map<string, string>();

  const sorted = [...appointments].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  );
  for (const appointment of sorted) {
    const key = conversationKey(appointment.garage_id, appointment.vehicle_id);
    keyByAppointment.set(appointment.id, key);
    let conversation = byKey.get(key);
    if (!conversation) {
      conversation = {
        key,
        garageId: appointment.garage_id,
        vehicleId: appointment.vehicle_id,
        appointments: [],
        lastMessage: null,
        unread: 0,
        lastActivityAt: appointment.start_time,
      };
      byKey.set(key, conversation);
    }
    conversation.appointments.push(appointment);
    conversation.lastActivityAt = appointment.start_time;
    conversation.unread += unreadByAppointment.get(appointment.id) ?? 0;
  }

  for (const message of messages) {
    const key = keyByAppointment.get(message.appointment_id);
    const conversation = key ? byKey.get(key) : undefined;
    if (conversation) conversation.lastMessage = message;
  }

  return [...byKey.values()]
    .filter(
      (conversation) =>
        conversation.lastMessage !== null ||
        conversation.appointments.some(
          (appointment) => appointment.id === keepAppointmentId || isOpenUpcoming(appointment, now),
        ),
    )
    .map((conversation) => {
      const messageAt = conversation.lastMessage?.created_at;
      const bookingAt = conversation.lastActivityAt;
      return {
        ...conversation,
        lastActivityAt:
          messageAt && new Date(messageAt).getTime() > new Date(bookingAt).getTime() ? messageAt : bookingAt,
      };
    })
    .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}

/**
 * Which booking a new message is filed under: the one the driver came from
 * (e.g. "Message" on a dashboard card) when it belongs to this conversation,
 * else the next booking still ahead, else the most recent one.
 */
export function replyAppointment<A extends ConversationAppointment>(
  conversation: Conversation<A>,
  preferredId: string | null,
  now = Date.now(),
): A {
  const preferred = preferredId
    ? conversation.appointments.find((appointment) => appointment.id === preferredId)
    : undefined;
  if (preferred) return preferred;
  const next = conversation.appointments.find((appointment) => isOpenUpcoming(appointment, now));
  return next ?? conversation.appointments[conversation.appointments.length - 1];
}
