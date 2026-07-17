# RDV

A bilingual (FR/EN) marketplace connecting car owners with verified garages in Luxembourg.
Built with Next.js 16 (App Router, Turbopack) and Supabase (Postgres, Auth, Storage).

## Stack

- **Next.js 16.2.10** — App Router, server actions, `proxy.ts` for locale detection + session
  refresh. See `node_modules/next/dist/docs/` for this version's breaking changes vs. older
  Next.js conventions (e.g. Middleware → Proxy).
- **Supabase** — Postgres with RLS-first authorization, `@supabase/ssr` for browser/server
  auth clients, Storage for garage verification documents and generated invoices.
- **Resend** — transactional email (appointment status changes, invites). Falls back to
  console logging when `RESEND_API_KEY` is unset.
- **`@react-pdf/renderer`** — server-side PDF invoice generation.
- **`@vis.gl/react-google-maps`** — garage location picker/display, gated on
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (no-ops gracefully when unset).
- **Stripe Connect** — clients pay at booking time via a fully Stripe-hosted Checkout Session
  (no Stripe.js/Elements in this app); garages are Express connected accounts; the platform
  keeps a flat `PLATFORM_COMMISSION_PERCENT`% via a Checkout application fee, the rest transfers
  automatically to the garage. See `lib/stripe.ts` and `app/api/webhooks/stripe/route.ts`.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in real values, see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example` for the full list and inline documentation. Required for the app to boot:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from your Supabase project settings.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, never prefix with `NEXT_PUBLIC_`. Used for
  admin-level operations (staff invites via `auth.admin.inviteUserByEmail`). Treat as a secret;
  never paste it into a shell command or commit it — read it from `.env.local` only.

Optional, with graceful fallbacks:

- `RESEND_API_KEY` / `EMAIL_FROM` — without a key, emails are logged to the server console
  instead of sent. The default `EMAIL_FROM` uses Resend's sandbox sender
  (`onboarding@resend.dev`), which only delivers to the Resend account owner — real
  transactional email to clients/garages requires verifying a real sending domain in Resend
  and updating `EMAIL_FROM`.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — without it, the garage location picker (onboarding) and
  map display (garage detail page) both render a text fallback instead of a map.

Required for bookings to work at all:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `PLATFORM_COMMISSION_PERCENT` — a garage with no
  connected Stripe account (`stripe_charges_enabled = false`) simply hides its booking slots
  rather than erroring, so the app still boots and is browsable without these, but no payment
  can be taken until they're set and a garage completes Connect onboarding at
  `/garage/stripe-connect`.

## Database migrations

Schema changes live in `supabase/migrations/`, numbered sequentially. They are **applied
manually** via the Supabase SQL editor — there is no automated migration runner in this repo.
When adding a new migration, run it against your Supabase project's SQL editor before relying
on it in application code.

## Deployment

Deployed on Vercel. After connecting the GitHub repo, configure the same environment variables
listed above in the Vercel project settings, then also set, in the Supabase dashboard:

- **Auth → URL Configuration → Site URL**: the deployed app's URL.
- **Auth → URL Configuration → Redirect URLs**: an allowlist entry for the deployed URL (and
  `http://localhost:3000/**` for local development) — Supabase silently drops `redirect_to`/
  `next` params that aren't on this allowlist.
- **Auth → Email Templates**: the "Confirm signup", "Invite user", and "Reset Password"
  templates must link through this app's `/auth/confirm` route using the `token_hash` URL
  format, not Supabase's default `{{ .ConfirmationURL }}` — see `app/auth/confirm/route.ts`.

Also register a webhook endpoint in the Stripe dashboard pointing at
`https://<your-domain>/api/webhooks/stripe`, subscribed to `checkout.session.completed`,
`checkout.session.expired`, and `account.updated` — then copy its signing secret into
`STRIPE_WEBHOOK_SECRET`.
