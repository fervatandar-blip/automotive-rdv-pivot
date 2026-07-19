"use server";

import { createClient } from "@/lib/supabase/server";

// Called directly from a client component (not via <form action>), so it
// can't use getAuthedUser -- that redirects on failure, which is wrong for
// a background call with no page navigation involved. Silently no-ops
// instead.
export async function saveDeviceToken(token: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  await supabase
    .from("device_tokens")
    .upsert({ profile_id: user.id, token }, { onConflict: "token" });
}
