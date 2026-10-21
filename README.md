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

## Testing

```bash
npm run test
```

Runs the Vitest suite (`vitest.config.ts`) — logic-level tests for booking-conflict slot
computation (`lib/slots.test.ts`), rate-limit windowing (`lib/rate-limit.test.ts`), auth form
validation (`lib/definitions.test.ts`), and appointment-transition RPC delegation
(`app/actions/appointments.test.ts`). The last of these verifies the application layer keeps
calling the correct `SECURITY DEFINER` RPC for each transition rather than a raw table update —
it does **not** verify the RPCs' own SQL bodies or that Postgres RLS actually enforces them,
which needs a live Postgres instance (no local Supabase/Docker stack is set up in this repo) and
was instead checked directly against the deployed project's `pg_policies`/`pg_proc`. No
component/UI-level tests exist yet.

## Rate limiting

Public-facing actions (`signup`, `garageSignup`, `login`, `requestPasswordReset`,
`submitGarageLead`, `bookAppointment`) are rate-limited via `lib/rate-limit.ts`'s
`checkRateLimit`.

**Distributed by default when configured, in-memory otherwise.** Set `UPSTASH_REDIS_REST_URL`
and `UPSTASH_REDIS_REST_TOKEN` (see `.env.example` — create a database at
[upstash.com](https://upstash.com) or via the Vercel Upstash integration) and every serverless
instance shares the same counters via an atomic `SET key 1 NX PX windowMs` + `INCR` in Redis —
a real guarantee under sustained or distributed abuse, not just a deterrent.

Without those two env vars, `checkRateLimit` falls back to an in-memory `Map` in the Node
process's memory: counters reset on every cold start/redeploy and aren't shared across
concurrent serverless instances, so the effective limit on Vercel is looser than the configured
number suggests. This is also the automatic fallback if Redis itself errors at runtime (a
transient Upstash outage) — `checkRateLimit` fails *open* to the in-memory limiter rather than
rejecting every request platform-wide, logging the error via `console.error` either way.
`lib/rate-limit.distributed.test.ts` covers the Redis path (including the fallback-on-error
behavior) against a mocked `@upstash/redis` client; `lib/rate-limit.test.ts` covers the
in-memory path directly.

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
