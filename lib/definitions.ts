import * as z from "zod";
import { COUNTRIES, REGISTRATION_CONFIG } from "@/lib/business-registration";
import { normalizeVin, VIN_PATTERN } from "@/lib/vehicle-identifiers";

export const SignupFormSchema = z.object({
  fullName: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." }),
  role: z.literal("client"),
});

// Deliberately has no `role` field at all -- unlike SignupFormSchema, which
// at least validates an attacker-submitted role against a z.literal
// allowlist, this schema structurally never reads a role from form data in
// the first place. garageSignup() (app/actions/auth.ts) hardcodes
// role: "admin_garage" as a literal in its own code, independent of
// anything in the submitted FormData. supabase/migrations/
// 0030_restrict_self_signup_roles.sql is the second, independent layer:
// even a caller that bypasses this app entirely and hits Supabase Auth's
// signup API directly can only ever self-grant 'client' or 'admin_garage'.
export const GarageSignupFormSchema = z.object({
  fullName: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z
    .string()
    .min(8, { error: "Be at least 8 characters long." })
    .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
    .regex(/[0-9]/, { error: "Contain at least one number." }),
});

export const InviteMechanicFormSchema = z.object({
  fullName: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  email: z.email({ error: "Please enter a valid email." }).trim(),
});

export type InviteMechanicFormState =
  | {
      errors?: {
        fullName?: string[];
        email?: string[];
      };
      message?: string;
      // Set on success. Deliberately the same whether or not the email
      // already has an account, so the form can't be used to probe for one.
      sentTo?: string;
    }
  | undefined;

export const SetPasswordFormSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "Be at least 8 characters long." })
      .regex(/[a-zA-Z]/, { error: "Contain at least one letter." })
      .regex(/[0-9]/, { error: "Contain at least one number." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export type SetPasswordFormState =
  | {
      errors?: {
        password?: string[];
        confirmPassword?: string[];
      };
      message?: string;
    }
  | undefined;

export const LoginFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
  password: z.string().min(1, { error: "Password is required." }),
});

export type AuthFormState =
  | {
      errors?: {
        fullName?: string[];
        email?: string[];
        password?: string[];
        role?: string[];
      };
      message?: string;
    }
  | undefined;

export const ForgotPasswordFormSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }).trim(),
});

export type ForgotPasswordFormState =
  | {
      errors?: {
        email?: string[];
      };
      message?: string;
    }
  | undefined;

export const ServiceFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  description: z
    .string()
    .trim()
    .max(500, { error: "Keep the description under 500 characters." })
    .optional(),
  durationMinutes: z.coerce
    .number({ error: "Enter a duration in minutes." })
    .int()
    .positive({ error: "Duration must be a positive number of minutes." }),
  price: z.coerce
    .number({ error: "Enter a price." })
    .nonnegative({ error: "Price can't be negative." }),
});

export type ServiceFormState =
  | {
      errors?: {
        name?: string[];
        description?: string[];
        durationMinutes?: string[];
        price?: string[];
      };
      message?: string;
    }
  | undefined;

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * One weekly opening window, applied to one or more weekdays at once (so a
 * Mon-Fri morning shift is one submission). A split shift is simply two
 * windows on the same days, e.g. 08:00-12:00 and 13:30-18:00; the gap
 * between them is never bookable (lib/slots.ts walks windows separately).
 */
export const AvailabilityFormSchema = z
  .object({
    days: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, { error: "Choose at least one day." })
      .transform((days) => [...new Set(days)].sort()),
    startTime: z.string().regex(TIME_OF_DAY, { error: "Enter a valid start time." }),
    endTime: z.string().regex(TIME_OF_DAY, { error: "Enter a valid end time." }),
  })
  .refine((data) => data.endTime > data.startTime, {
    error: "End time must be after start time.",
    path: ["endTime"],
  });

export type AvailabilityFormState =
  | {
      errors?: {
        days?: string[];
        startTime?: string[];
        endTime?: string[];
      };
      message?: string;
      // Weekdays (0 = Sunday) that already had an overlapping window, so
      // nothing was added for them.
      conflictDays?: number[];
      added?: number;
    }
  | undefined;

export const AvailabilityOverrideFormSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date." }),
    isClosed: z.boolean(),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: "Enter a valid start time." })
      .optional(),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: "Enter a valid end time." })
      .optional(),
  })
  .refine((data) => data.isClosed || (data.startTime && data.endTime), {
    error: "Enter a start and end time, or mark the date as closed.",
    path: ["endTime"],
  })
  .refine(
    (data) =>
      data.isClosed ||
      !data.startTime ||
      !data.endTime ||
      data.endTime > data.startTime,
    {
      error: "End time must be after start time.",
      path: ["endTime"],
    }
  );

export type AvailabilityOverrideFormState =
  | {
      errors?: {
        date?: string[];
        startTime?: string[];
        endTime?: string[];
      };
      message?: string;
    }
  | undefined;

export const GARAGE_DESCRIPTION_MAX_LENGTH = 1000;

// Canonical values stored in garages.languages_spoken -- never localize
// these; only the displayed label (dictionary languageLabels) changes.
export const GARAGE_LANGUAGES = [
  "French",
  "English",
  "German",
  "Luxembourgish",
  "Portuguese",
] as const;

// Field groups shared by the first-run onboarding wizard (all at once) and
// the garage profile editor (one section per form), so both validate the
// same fields identically.
const garageDetailsShape = {
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  description: z
    .string()
    .trim()
    .max(GARAGE_DESCRIPTION_MAX_LENGTH, {
      error: `Keep the description under ${GARAGE_DESCRIPTION_MAX_LENGTH} characters.`,
    })
    .optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.email({ error: "Please enter a valid email." }).optional(),
  // Matches the garages_website_check constraint (0031): http(s) only, so a
  // garage can't put a javascript:/data: URL behind its public profile link.
  website: z
    .url({
      protocol: /^https?$/,
      error: "Enter a full URL, starting with http:// or https://.",
    })
    .optional(),
  country: z.enum(COUNTRIES, { error: "Select a country." }),
  registrationNumber: z.string().trim().optional(),
  vatNumber: z.string().trim().optional(),
};

const garageCapabilitiesShape = {
  pricingCategory: z.enum(["budget", "standard", "premium"]).optional(),
  technicianCount: z.coerce
    .number({ error: "Enter a number." })
    .int()
    .nonnegative({ error: "Can't be negative." })
    .optional(),
};

function refineRegistrationNumber(
  data: { country: (typeof COUNTRIES)[number]; registrationNumber?: string },
  ctx: z.RefinementCtx
) {
  if (
    data.registrationNumber &&
    !REGISTRATION_CONFIG[data.country].pattern.test(data.registrationNumber)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["registrationNumber"],
      message: `Doesn't look like a valid ${REGISTRATION_CONFIG[data.country].label}.`,
    });
  }
}

export const GarageOnboardingFormSchema = z
  .object({ ...garageDetailsShape, ...garageCapabilitiesShape })
  .superRefine(refineRegistrationNumber);

export const GarageDetailsFormSchema = z
  .object(garageDetailsShape)
  .superRefine(refineRegistrationNumber);

export const GarageCapabilitiesFormSchema = z.object(garageCapabilitiesShape);

export const GARAGE_PROFILE_SECTIONS = [
  "details",
  "location",
  "capabilities",
  "catalog",
] as const;
export type GarageProfileSection = (typeof GARAGE_PROFILE_SECTIONS)[number];

export type GarageProfileFormState =
  | {
      errors?: Partial<
        Record<
          | keyof typeof garageDetailsShape
          | keyof typeof garageCapabilitiesShape,
          string[]
        >
      >;
      message?: string;
      savedAt?: number;
    }
  | undefined;

export type GarageOnboardingFormState =
  | {
      errors?: {
        name?: string[];
        description?: string[];
        address?: string[];
        city?: string[];
        phone?: string[];
        email?: string[];
        website?: string[];
        country?: string[];
        registrationNumber?: string[];
        pricingCategory?: string[];
        technicianCount?: string[];
      };
      message?: string;
    }
  | undefined;

export const BookingFormSchema = z.object({
  garageId: z.uuid(),
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date." }),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { error: "Invalid start time." }),
  vehicleId: z.uuid().optional(),
});

export const RescheduleFormSchema = z.object({
  appointmentId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date." }),
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, { error: "Invalid start time." }),
});

export const WaitlistFormSchema = z.object({
  garageId: z.uuid(),
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Invalid date." }),
});

export const VehicleFormSchema = z.object({
  brandId: z.uuid().optional(),
  model: z.string().trim().max(100, { error: "Keep it under 100 characters." }).optional(),
  year: z.coerce
    .number({ error: "Enter a valid year." })
    .int()
    .min(1900, { error: "Enter a valid year." })
    .max(new Date().getFullYear() + 1, { error: "Enter a valid year." })
    .optional(),
  licensePlate: z
    .string()
    .trim()
    .max(20, { error: "Keep it under 20 characters." })
    .optional(),
  vin: z
    .string()
    .transform(normalizeVin)
    .pipe(
      z.string().regex(VIN_PATTERN, {
        error: "A VIN is 17 letters and digits (no I, O or Q).",
      })
    )
    .optional(),
});

/**
 * Quick walk-in (garage side). The customer is an existing walk-in
 * customer, a registered client who has booked here before, or a new
 * walk-in; the vehicle is one of theirs, a new one (walk-in customers
 * only -- registered clients manage their own vehicles), or none.
 * Timing is "now" or a time later today, resolved server-side in the
 * garage's zone.
 */
export const WalkInFormSchema = z
  .object({
    customerKind: z.enum(["garage_customer", "client", "new"], { error: "Choose a customer." }),
    customerId: z.uuid().optional(),
    newName: z.string().trim().max(120, { error: "Keep the name under 120 characters." }).optional(),
    newPhone: z.string().trim().max(40, { error: "Keep the phone number under 40 characters." }).optional(),
    newEmail: z
      .email({ error: "Please enter a valid email." })
      .transform((value) => value.toLowerCase())
      .optional(),
    vehicleChoice: z.union([z.uuid(), z.literal("new"), z.literal("none")]).default("none"),
    plate: z.string().trim().max(20, { error: "Keep it under 20 characters." }).optional(),
    brandId: z.uuid().optional(),
    model: z.string().trim().max(100, { error: "Keep it under 100 characters." }).optional(),
    vin: z
      .string()
      .transform(normalizeVin)
      .pipe(z.string().regex(VIN_PATTERN, { error: "A VIN is 17 letters and digits (no I, O or Q)." }))
      .optional(),
    serviceId: z.uuid({ error: "Choose a service." }),
    mechanicId: z.uuid().optional(),
    when: z.enum(["now", "at"]).default("now"),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: "Enter a valid time." })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.customerKind === "new" && !data.newName) {
      ctx.addIssue({ code: "custom", path: ["newName"], message: "Enter the customer's name." });
    }
    if (data.customerKind === "new" && !data.newPhone && !data.newEmail) {
      ctx.addIssue({
        code: "custom",
        path: ["newPhone"],
        message: "Add a phone number or email so you can reach them.",
      });
    }
    if (data.customerKind !== "new" && !data.customerId) {
      ctx.addIssue({ code: "custom", path: ["customerId"], message: "Choose a customer." });
    }
    if (data.vehicleChoice === "new" && data.customerKind === "client") {
      ctx.addIssue({
        code: "custom",
        path: ["vehicleChoice"],
        message: "Registered clients add their own vehicles. Pick one of theirs or none.",
      });
    }
    if (data.vehicleChoice === "new" && !data.plate && !data.model) {
      ctx.addIssue({ code: "custom", path: ["plate"], message: "Enter at least the plate or the model." });
    }
    if (data.when === "at" && !data.time) {
      ctx.addIssue({ code: "custom", path: ["time"], message: "Enter a time." });
    }
  });

export type WalkInFormState =
  | {
      errors?: Partial<Record<keyof z.input<typeof WalkInFormSchema>, string[]>>;
      message?: string;
      created?: { appointmentId: string; startLabel: string; mechanicName: string | null; customerName: string };
    }
  | undefined;

export type VehicleFormState =
  | {
      errors?: {
        brandId?: string[];
        model?: string[];
        year?: string[];
        licensePlate?: string[];
        vin?: string[];
      };
      message?: string;
    }
  | undefined;

export const ReviewFormSchema = z.object({
  appointmentId: z.uuid(),
  rating: z.coerce
    .number({ error: "Choose a rating." })
    .int()
    .min(1)
    .max(5),
  comment: z.string().trim().max(1000, { error: "Keep it under 1000 characters." }).optional(),
});

export const MessageFormSchema = z.object({
  appointmentId: z.uuid(),
  body: z
    .string()
    .trim()
    .min(1, { error: "Message can't be empty." })
    .max(2000, { error: "Keep it under 2000 characters." }),
});

export const GARAGE_SIZE_TYPES = [
  "independent",
  "small_chain",
  "franchise_dealership",
  "other",
] as const;

export const GARAGE_SIZE_TYPE_LABELS: Record<
  (typeof GARAGE_SIZE_TYPES)[number],
  string
> = {
  independent: "Independent garage",
  small_chain: "Small chain (2–5 locations)",
  franchise_dealership: "Franchise or dealership network",
  other: "Other",
};

export const GarageLeadFormSchema = z.object({
  firstName: z
    .string()
    .min(2, { error: "First name must be at least 2 characters long." })
    .trim(),
  lastName: z
    .string()
    .min(2, { error: "Last name must be at least 2 characters long." })
    .trim(),
  businessEmail: z.email({ error: "Please enter a valid email." }).trim(),
  phone: z.string().trim().optional(),
  garageName: z
    .string()
    .min(2, { error: "Garage name must be at least 2 characters long." })
    .trim(),
  country: z.enum(COUNTRIES, { error: "Select a country." }),
  garageSizeType: z.enum(GARAGE_SIZE_TYPES).optional(),
  message: z
    .string()
    .trim()
    .max(2000, { error: "Keep it under 2000 characters." })
    .optional(),
});

export type GarageLeadFormState =
  | {
      errors?: {
        firstName?: string[];
        lastName?: string[];
        businessEmail?: string[];
        phone?: string[];
        garageName?: string[];
        country?: string[];
        garageSizeType?: string[];
        message?: string[];
      };
      // General/top-level failure (e.g. rate limited) -- distinct from
      // errors.message, which is the optional textarea field's own
      // validation error.
      formError?: string;
      success?: boolean;
    }
  | undefined;

export const REPAIR_STAGES = [
  "received",
  "diagnosis",
  "in_repair",
  "quality_check",
  "ready_for_pickup",
] as const;

export const REPAIR_STAGE_LABELS: Record<
  (typeof REPAIR_STAGES)[number],
  string
> = {
  received: "Received",
  diagnosis: "Diagnosis",
  in_repair: "In repair",
  quality_check: "Quality check",
  ready_for_pickup: "Ready for pickup",
};
