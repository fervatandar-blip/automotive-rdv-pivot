"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { MessageFormSchema } from "@/lib/definitions";

// Called directly from the chat client component (not via <form action>),
// so the input can clear instantly without a page-level transition -- same
// calling convention as saveDeviceToken (app/actions/push.ts). No
// revalidatePath: unlike every other mutation in this app, the UI updates
// via the Realtime subscription in components/chat-thread.tsx, not a
// server re-render.
// Return value matters here: the caller (components/chat-thread.tsx) clears
// its draft input only once this reports success, rather than optimistically
// clearing before the insert is even attempted. Previously this always
// implicitly resolved (never threw), so a silent failure -- an RLS
// rejection, a validation failure, a DB error -- looked identical to
// success from the client's side and the typed message was simply gone.
export async function sendMessage(
  appointmentId: string,
  body: string
): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false };

  const validatedFields = MessageFormSchema.safeParse({ appointmentId, body });
  if (!validatedFields.success) return { ok: false };

  // RLS ("Appointment participants can send messages") enforces that the
  // sender is actually a participant on this appointment -- no separate
  // authorization check needed here.
  const { error } = await supabase.from("messages").insert({
    appointment_id: validatedFields.data.appointmentId,
    sender_id: user.id,
    body: validatedFields.data.body,
  });

  return { ok: !error };
}

const MarkReadSchema = z.array(z.uuid()).min(1).max(100);

// Stamps the caller's read receipts (mark_messages_read, 0049) and refreshes
// the router so the nav's unread badge drops without a reload. Called from
// the inbox thread on open and when a reply arrives while it's on screen.
export async function markMessagesRead(appointmentIds: string[]): Promise<void> {
  const parsed = MarkReadSchema.safeParse(appointmentIds);
  if (!parsed.success) return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_messages_read", { p_appointment_ids: parsed.data });
  if (!error) refresh();
}
