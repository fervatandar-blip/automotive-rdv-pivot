"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseLocale } from "@/lib/i18n/config";
import { getOrigin } from "@/lib/origin";
import {
  ForgotPasswordFormSchema,
  LoginFormSchema,
  SetPasswordFormSchema,
  SignupFormSchema,
  type AuthFormState,
  type ForgotPasswordFormState,
  type SetPasswordFormState,
} from "@/lib/definitions";

export async function signup(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const lang = parseLocale(formData.get("lang"));

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
  const { error } = await supabase.auth.signUp({
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

  redirect(`/${lang}/login?confirm=1`);
}

export async function login(
  state: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const lang = parseLocale(formData.get("lang"));

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
    return { message: "Invalid email or password." };
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
