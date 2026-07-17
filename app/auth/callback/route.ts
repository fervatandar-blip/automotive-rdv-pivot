import { type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { defaultLocale } from "@/lib/i18n/config";

// PKCE code-exchange path. Supabase's *default* (unedited) email templates
// link straight to Supabase's own hosted verify endpoint, which redirects
// here with a `?code=` param rather than the `token_hash`/`type` pair that
// /auth/confirm expects -- @supabase/ssr hard-codes flowType: "pkce", so
// this is the path real signup/invite/reset emails take until custom SMTP
// + edited templates are set up (see README's Deployment section).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? `/${defaultLocale}/dashboard`;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirect(next);
    }
  }

  redirect(`/${defaultLocale}/login?confirm=error`);
}
