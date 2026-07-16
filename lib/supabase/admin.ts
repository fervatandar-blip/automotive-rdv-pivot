import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. Bypasses RLS entirely — only ever import
 * this from a "use server" file (server actions), and only for admin-level
 * operations (e.g. inviteUserByEmail) that the anon/session client can't do.
 * Never expose SUPABASE_SERVICE_ROLE_KEY to client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
