import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFirebaseMessaging } from "@/lib/firebase/admin";

export async function sendPushToProfile({
  profileId,
  title,
  body,
}: {
  profileId: string;
  title: string;
  body: string;
}) {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.log(
      `[push:mock] to=${profileId}\n[push:mock] title=${title}\n[push:mock] body=${body}\n`
    );
    return;
  }

  const admin = createAdminClient();
  const { data: tokens } = await admin
    .from("device_tokens")
    .select("id, token")
    .eq("profile_id", profileId);

  if (!tokens || tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((row) => row.token),
    notification: { title, body },
  });

  const deadTokenIds = response.responses
    .map((result, index) =>
      !result.success &&
      result.error?.code === "messaging/registration-token-not-registered"
        ? tokens[index].id
        : null
    )
    .filter((id): id is string => id !== null);

  if (deadTokenIds.length > 0) {
    await admin.from("device_tokens").delete().in("id", deadTokenIds);
  }
}
