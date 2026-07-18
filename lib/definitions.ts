import * as z from "zod";

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
  role: z.enum(["client", "admin_garage"], {
    error: "Choose whether you're a client or a garage.",
  }),
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

export const AvailabilityFormSchema = z
  .object({
    dayOfWeek: z.coerce
      .number({ error: "Choose a day." })
      .int()
      .min(0)
      .max(6),
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: "Enter a valid start time." }),
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, { error: "Enter a valid end time." }),
  })
  .refine((data) => data.endTime > data.startTime, {
    error: "End time must be after start time.",
    path: ["endTime"],
  });

export type AvailabilityFormState =
  | {
      errors?: {
        dayOfWeek?: string[];
        startTime?: string[];
        endTime?: string[];
      };
      message?: string;
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

export const GarageOnboardingFormSchema = z.object({
  name: z
    .string()
    .min(2, { error: "Name must be at least 2 characters long." })
    .trim(),
  description: z
    .string()
    .trim()
    .max(1000, { error: "Keep the description under 1000 characters." })
    .optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.email({ error: "Please enter a valid email." }).optional(),
  vatNumber: z.string().trim().optional(),
  pricingCategory: z.enum(["budget", "standard", "premium"]).optional(),
  technicianCount: z.coerce
    .number({ error: "Enter a number." })
    .int()
    .nonnegative({ error: "Can't be negative." })
    .optional(),
});

export type GarageOnboardingFormState =
  | {
      errors?: {
        name?: string[];
        description?: string[];
        address?: string[];
        city?: string[];
        phone?: string[];
        email?: string[];
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
});

export type VehicleFormState =
  | {
      errors?: {
        brandId?: string[];
        model?: string[];
        year?: string[];
        licensePlate?: string[];
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
