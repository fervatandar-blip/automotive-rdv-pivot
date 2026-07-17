-- Stripe Connect payments: clients pay at booking time, the platform takes a
-- flat commission, the garage receives the rest via a destination charge.

-- 1. appointments: a new status that holds the slot while checkout is in
-- flight (the existing no-overlap exclusion constraint already blocks any
-- status <> 'cancelled', so no change needed there -- see
-- 0003_appointment_no_overlap.sql).
alter table appointments drop constraint appointments_status_check;
alter table appointments add constraint appointments_status_check
  check (status in ('pending_payment', 'pending', 'confirmed', 'cancelled', 'completed'));

alter table appointments add column stripe_checkout_session_id text;

-- 2. garages: Stripe Express connected account state.
alter table garages add column stripe_account_id text;
alter table garages add column stripe_charges_enabled boolean not null default false;
alter table garages add column stripe_payouts_enabled boolean not null default false;

-- 3. payments: one row per successfully paid appointment. Deliberately no
-- insert/update policy -- only the service-role webhook handler (which
-- bypasses RLS) may ever write a financial record.
create table payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  garage_id uuid not null references garages (id) on delete cascade,
  client_id uuid not null references profiles (id) on delete cascade,
  amount numeric(10, 2) not null check (amount >= 0),
  commission_amount numeric(10, 2) not null check (commission_amount >= 0),
  payout_amount numeric(10, 2) not null check (payout_amount >= 0),
  currency text not null default 'eur',
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  status text not null default 'succeeded' check (status in ('succeeded', 'refunded', 'failed')),
  created_at timestamptz not null default now()
);

create index payments_garage_id_idx on payments (garage_id);
create index payments_client_id_idx on payments (client_id);

alter table payments enable row level security;

create policy "Payment participants can view their payments"
  on payments for select
  using (
    client_id = auth.uid()
    or is_garage_member(garage_id)
    or is_super_admin()
  );
