import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Unread workshop messages per appointment for the signed-in client
 * (client_unread_message_counts, 0049). A failed call degrades to "nothing
 * unread" so the inbox and nav never break over a badge.
 */
export async function getClientUnreadCounts(supabase: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("client_unread_message_counts");
  const counts = new Map<string, number>();
  if (error || !Array.isArray(data)) return counts;
  for (const row of data as { appointment_id: string; unread: number }[]) {
    if (row.unread > 0) counts.set(row.appointment_id, row.unread);
  }
  return counts;
}

/** Total unread messages: the number on the nav badge. */
export function totalUnread(counts: Map<string, number>) {
  let total = 0;
  for (const value of counts.values()) total += value;
  return total;
}
