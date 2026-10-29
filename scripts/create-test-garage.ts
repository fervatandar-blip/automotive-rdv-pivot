/**
 * One-off local script: creates a garage-owner login (confirmed email, no
 * email sent) for manual testing, then prints its credentials. Follow with
 * scripts/seed-test-garage.ts to fill in and approve its profile.
 *
 * Usage:
 *   node scripts/create-test-garage.ts [email]
 *
 * Defaults to demo-garage@rdv.invalid -- the .invalid TLD is reserved
 * (RFC 2606) and can never receive mail, so nothing the app sends to this
 * account reaches a real person.
 *
 * WARNING: uses the Supabase service-role key. Test accounts only; delete
 * them before launch (they're ordinary, publicly visible accounts).
 */

import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// Same reasoning as scripts/seed-test-garage.ts: lib/supabase/admin.ts
// starts with `import "server-only"`, which throws outside Next's bundler.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local"
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const email = (process.argv[2] ?? "demo-garage@rdv.invalid").toLowerCase();
  // 18 random bytes -> 24 base64url chars; satisfies the signup password
  // rules (letters, digits) without being guessable.
  const password = `Rdv-${randomBytes(18).toString("base64url")}1a`;

  const supabase = createAdminClient();

  // handle_new_user() (0030) grants admin_garage from this metadata and
  // auto-creates the owned garage row, exactly like a real self-serve
  // garage signup.
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Demo Garage Owner", role: "admin_garage" },
  });

  if (error || !data.user) {
    console.error(`Could not create ${email}: ${error?.message ?? "no user returned"}`);
    process.exit(1);
  }

  const { data: garage } = await supabase
    .from("garages")
    .select("id")
    .eq("owner_id", data.user.id)
    .maybeSingle();

  console.log("=== Test garage owner created ===");
  console.log(`Email:    ${email}`);
  console.log(`Password: ${password}`);
  console.log(`User id:  ${data.user.id}`);
  console.log(`Garage:   ${garage?.id ?? "(missing -- check handle_new_user)"}`);
  console.log(`\nNext: node scripts/seed-test-garage.ts ${email}`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
