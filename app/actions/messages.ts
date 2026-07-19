"use server";

import { createClient } from "@/lib/supabase/server";
import { MessageFormSchema } from "@/lib/definitions";

// Called directly from the chat client component (not via <form action>),
// so the input can clear instantly without a page-level transition -- same
// calling convention as saveDeviceToken (app/actions/push.ts). No
// revalidatePath: unlike every other mutation in this app, the UI updates
// via the Realtime subscription in components/chat-thread.tsx, not a
// server re-render.
export async function sendMessage(appointmentId: string, body: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const validatedFields = MessageFormSchema.safeParse({ appointmentId, body });
  if (!validatedFields.success) return;

  // RLS ("Appointment participants can send messages") enforces that the
  // sender is actually a participant on this appointment -- no separate
  // authorization check needed here.
  await supabase.from("messages").insert({
    appointment_id: validatedFields.data.appointmentId,
    sender_id: user.id,
    body: validatedFields.data.body,
  });
}
