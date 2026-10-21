import { describe, expect, it } from "vitest";
import {
  GarageSignupFormSchema,
  LoginFormSchema,
  SignupFormSchema,
} from "./definitions";

describe("SignupFormSchema (authentication)", () => {
  const validInput = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    password: "Password123",
    role: "client" as const,
  };

  it("accepts a fully valid signup payload", () => {
    const result = SignupFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = SignupFormSchema.safeParse({ ...validInput, password: "Ab1" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no letters", () => {
    const result = SignupFormSchema.safeParse({ ...validInput, password: "12345678" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no digits", () => {
    const result = SignupFormSchema.safeParse({ ...validInput, password: "abcdefgh" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = SignupFormSchema.safeParse({ ...validInput, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a full name under 2 characters", () => {
    const result = SignupFormSchema.safeParse({ ...validInput, fullName: "J" });
    expect(result.success).toBe(false);
  });

  // Security-relevant: this schema is one of two independent layers
  // preventing the *client* signup form specifically from creating
  // anything but a "client" role (garageSignup uses a separate schema,
  // GarageSignupFormSchema below, which has no role field at all; both are
  // additionally backstopped at the database layer by
  // supabase/migrations/0030_restrict_self_signup_roles.sql).
  it("rejects any role other than the literal 'client'", () => {
    for (const role of ["admin_garage", "mecanicien", "super_admin"]) {
      const result = SignupFormSchema.safeParse({ ...validInput, role });
      expect(result.success).toBe(false);
    }
  });
});

describe("GarageSignupFormSchema (authentication, role escalation)", () => {
  const validInput = {
    fullName: "Jane Doe",
    email: "jane@garage.example",
    password: "Password123",
  };

  it("accepts a fully valid garage signup payload", () => {
    const result = GarageSignupFormSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  // The core anti-escalation property of this schema: unlike
  // SignupFormSchema (which at least reads and rejects a bad role value),
  // this schema has no `role` key at all, so parsing succeeds and simply
  // drops it -- app/actions/auth.ts's garageSignup() never sees whatever
  // role an attacker tried to submit, because Zod's default (non-strict)
  // parsing strips unrecognized keys rather than forwarding them.
  it("has no role field -- parsing strips any role the request included", () => {
    const result = GarageSignupFormSchema.safeParse({
      ...validInput,
      role: "super_admin",
    });
    expect(result.success).toBe(true);
    expect(result.success && "role" in result.data).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = GarageSignupFormSchema.safeParse({
      ...validInput,
      password: "Ab1",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = GarageSignupFormSchema.safeParse({
      ...validInput,
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a full name under 2 characters", () => {
    const result = GarageSignupFormSchema.safeParse({
      ...validInput,
      fullName: "J",
    });
    expect(result.success).toBe(false);
  });
});

describe("LoginFormSchema (authentication)", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = LoginFormSchema.safeParse({
      email: "jane@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = LoginFormSchema.safeParse({
      email: "jane@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = LoginFormSchema.safeParse({
      email: "not-an-email",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("does not enforce password strength on login (only on signup)", () => {
    // Login must accept whatever password an existing account already has,
    // even a short/simple one created before stricter rules existed --
    // strength is only enforced at signup/set-password time.
    const result = LoginFormSchema.safeParse({
      email: "jane@example.com",
      password: "a",
    });
    expect(result.success).toBe(true);
  });
});
