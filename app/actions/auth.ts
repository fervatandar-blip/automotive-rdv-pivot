"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  ForgotPasswordFormSchema,
  GarageSignupFormSchema,
  LoginFormSchema,
  SetPasswordFormSchema,
  SignupFormSchema,
  type AuthFormState,
  type ForgotPasswordFormState,
  type SetPasswordFormState,
} from "@/lib/definitions";

const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a bit and try again.";

export async function signup(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const lang = parseLocale(formData.get("lang"));

  const ip = await getClientIp();
  if (!(await checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000))) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const validatedFields = SignupFormSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  if (formData.get("termsAccepted") !== "on") {
    return {
      message: "You must agree to the Terms of Service and Privacy Policy to continue.",
    };
  }

  const { fullName, email, password, role } = validatedFields.data;
  const origin = await getOrigin();
  const supabase = await createClient();

  // Profile row is created by the on_auth_user_created DB trigger, which
  // reads role/full_name back out of this metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role },
      emailRedirectTo: `${origin}/auth/callback?next=/${lang}/dashboard`,
    },
  });

  if (error) {
    return { message: error.message };
  }

  // With email confirmation required (the production default), signUp()
  // returns no session -- data.session is null -- until the link is
  // clicked, and the "check your email" redirect below is correct. With
  // confirmation disabled at the project level (dev/staging), signUp()
  // returns an active session immediately instead -- the cookie is already
  // set by this point -- so sending them to a "confirm your email" screen
  // is both wrong and confusing. Go straight in when that's the case.
  if (data.session) {
    redirect(`/${lang}/dashboard`);
  }

  redirect(`/${lang}/login?confirm=1`);
}

// Dedicated garage-owner self-signup. `role` is never read from formData
// anywhere in this function -- GarageSignupFormSchema (lib/definitions.ts)
// has no role field at all, and "admin_garage" below is a hardcoded
// literal in this action's own code. This is one of two independent
// layers preventing role escalation through submitted form data: the
// other is supabase/migrations/0030_restrict_self_signup_roles.sql, which
// restricts what handle_new_user() will grant from signUp() metadata
// regardless of which caller/route produced it -- so even a request that
// bypasses this action entirely (a direct call to Supabase Auth's public
// signup API) still can't self-grant anything beyond client/admin_garage.
export async function garageSignup(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const lang = parseLocale(formData.get("lang"));

  const ip = await getClientIp();
  if (!(await checkRateLimit(`garage-signup:${ip}`, 5, 60 * 60 * 1000))) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const validatedFields = GarageSignupFormSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  if (formData.get("termsAccepted") !== "on") {
    return {
      message: "You must agree to the Terms of Service and Privacy Policy to continue.",
    };
  }

  const { fullName, email, password } = validatedFields.data;
  const origin = await getOrigin();
  const supabase = await createClient();

  // Profile row + an auto-provisioned (pending, unonboarded) garage row are
  // both created by the on_auth_user_created DB trigger -- see
  // supabase/migrations/0021_fix_handle_new_user_garage_creation.sql and
  // 0030 above. The garage lands with platform_terms_accepted_at = null,
  // which /garage/dashboard already treats as "first run" and redirects to
  // the existing onboarding wizard -- reusing that flow unchanged rather
  // than building a parallel one, so it collects the actual garage
  // name/address/hours/etc. exactly as it already does for
  // invite-provisioned and lead-converted garage owners.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, role: "admin_garage" },
      emailRedirectTo: `${origin}/auth/callback?next=/${lang}/garage/dashboard`,
    },
  });

  if (error) {
    return { message: error.message };
  }

  // Same confirmation-required-vs-disabled branch as signup() above.
  if (data.session) {
    redirect(`/${lang}/garage/dashboard`);
  }

  redirect(`/${lang}/garage/login?confirm=1`);
}

export async function login(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const lang = parseLocale(formData.get("lang"));

  const ip = await getClientIp();
  if (!(await checkRateLimit(`login:${ip}`, 10, 5 * 60 * 1000))) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const validatedFields = LoginFormSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email, password } = validatedFields.data;
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Generic message in production -- deliberately doesn't distinguish
    // "wrong password" from "email not confirmed" from "account doesn't
    // exist", which would otherwise leak account-enumeration signals. In
    // development, show Supabase's actual reason instead: without it, a
    // failed test login is a dead end with no way to tell those cases
    // apart. This does not change what's required to log in in either
    // environment, only what's reported when it fails.
    return {
      message:
        process.env.NODE_ENV === "production"
          ? "Invalid email or password."
          : `Login failed (dev detail): ${error.message}`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  if (profile?.role === "admin_garage" || profile?.role === "mecanicien") {
    redirect(`/${lang}/garage/dashboard`);
  }

  redirect(`/${lang}/dashboard`);
}

const FORGOT_PASSWORD_SUCCESS =
  "If an account exists for that email, we've sent a password reset link.";

export async function requestPasswordReset(
  state: ForgotPasswordFormState,
  formData: FormData
): Promise<ForgotPasswordFormState> {
  const lang = parseLocale(formData.get("lang"));

  // Keyed by IP, not email, so this can't be used to enumerate accounts --
  // it only ever reveals "this IP asked too often," never anything about
  // whether a given email exists (that's still hidden behind
  // FORGOT_PASSWORD_SUCCESS below regardless of outcome).
  const ip = await getClientIp();
  if (!(await checkRateLimit(`password-reset:${ip}`, 5, 60 * 60 * 1000))) {
    return { message: RATE_LIMIT_MESSAGE };
  }

  const validatedFields = ForgotPasswordFormSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { email } = validatedFields.data;
  const origin = await getOrigin();
  const supabase = await createClient();

  const nextPath = encodeURIComponent(`/${lang}/set-password?context=recovery`);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${nextPath}`,
  });

  // Always return the same neutral message regardless of outcome, so this
  // form can't be used to enumerate which emails have accounts.
  if (error) {
    console.error("[auth] password reset request failed:", error);
  }

  return { message: FORGOT_PASSWORD_SUCCESS };
}

export async function setPassword(
  state: SetPasswordFormState,
  formData: FormData
): Promise<SetPasswordFormState> {
  const lang = parseLocale(formData.get("lang"));

  const validatedFields = SetPasswordFormSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${lang}/login`);
  }

  const { error } = await supabase.auth.updateUser({
    password: validatedFields.data.password,
  });

  if (error) {
    return { message: error.message };
  }

  redirect(`/${lang}/dashboard`);
}

export async function logout(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${lang}/login`);
}
