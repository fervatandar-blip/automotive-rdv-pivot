-- Walk-in customers: people a garage serves without an RDV account.
--
-- Until now every vehicle, appointment and invoice had to belong to a
-- registered client (profiles), so a garage could only record jobs for
-- people who had signed up and paid online.
--
-- Model:
--   - garage_customers: a garage's own customer records (name, phone,
--     optional email). Visible to and editable by that garage only. The
--     garage is the data controller for these; they never get a login.
--   - vehicles / appointments / invoices now belong to exactly one of a
--     registered client (client_id) or a garage customer
--     (garage_customer_id) -- enforced by CHECK constraints.
--   - Walk-in appointments are created by garage members only, as
--     already-confirmed jobs (no online payment), and only for
--       (a) the garage's own customers, or
--       (b) registered clients who have booked at this garage before --
--     never for an arbitrary RDV user.
--     The per-mechanic trigger (0037) still assigns/validates the mechanic.
--   - Customers are never hard-deleted while they have history: the FK
--     from appointments/invoices is ON DELETE RESTRICT, and erasure is done
--     by anonymizing the row (see app/actions/walk-ins.ts), mirroring how
--     account deletion already works for registered clients.

create table garage_customers (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or (email = lower(email) and position('@' in email) > 1)),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  anonymized_at timestamptz
);

create index garage_customers_garage_id_idx on garage_customers (garage_id);
create index garage_customers_created_by_idx on garage_customers (created_by);

alter table garage_customers enable row level security;

create policy "Garage members manage their customers"
  on garage_customers for all
  to authenticated
  using ((select is_garage_member(garage_id)))
  with check ((select is_garage_member(garage_id)));

revoke all on garage_customers from anon;

-- Vehicles: owned by a client or by a garage customer.
alter table vehicles alter column client_id drop not null;
alter table vehicles
  add column garage_customer_id uuid references garage_customers (id) on delete cascade,
  add constraint vehicles_single_owner check (num_nonnulls(client_id, garage_customer_id) = 1);
create index vehicles_garage_customer_id_idx on vehicles (garage_customer_id);

create policy "Garage members manage their customers' vehicles"
  on vehicles for all
  to authenticated
  using (
    exists (
      select 1 from garage_customers gc
      where gc.id = vehicles.garage_customer_id
        and (select is_garage_member(gc.garage_id))
    )
  )
  with check (
    exists (
      select 1 from garage_customers gc
      where gc.id = vehicles.garage_customer_id
        and (select is_garage_member(gc.garage_id))
    )
  );

-- Appointments: for a client or a garage customer.
alter table appointments alter column client_id drop not null;
alter table appointments
  add column garage_customer_id uuid references garage_customers (id) on delete restrict,
  add constraint appointments_single_customer check (num_nonnulls(client_id, garage_customer_id) = 1);
create index appointments_garage_customer_id_idx on appointments (garage_customer_id);

create policy "Garage members create walk-in appointments"
  on appointments for insert
  to authenticated
  with check (
    (select is_garage_member(garage_id))
    and status = 'confirmed'
    and stripe_checkout_session_id is null
    and exists (
      select 1 from services s where s.id = appointments.service_id and s.garage_id = appointments.garage_id
    )
    and (
      (
        garage_customer_id is not null
        and exists (
          select 1 from garage_customers gc
          where gc.id = appointments.garage_customer_id
            and gc.garage_id = appointments.garage_id
            and gc.anonymized_at is null
        )
        and (
          vehicle_id is null
          or exists (select 1 from vehicles v where v.id = appointments.vehicle_id and v.garage_customer_id = appointments.garage_customer_id)
        )
      )
      or (
        client_id is not null
        and exists (
          select 1 from appointments prior
          where prior.client_id = appointments.client_id
            and prior.garage_id = appointments.garage_id
        )
        and (
          vehicle_id is null
          or exists (select 1 from vehicles v where v.id = appointments.vehicle_id and v.client_id = appointments.client_id)
        )
      )
    )
  );

-- Invoices: addressed to a client or a garage customer.
alter table invoices alter column client_id drop not null;
alter table invoices
  add column garage_customer_id uuid references garage_customers (id) on delete restrict,
  add constraint invoices_single_recipient check (num_nonnulls(client_id, garage_customer_id) = 1);
create index invoices_garage_customer_id_idx on invoices (garage_customer_id);

-- Pre-existing hole, closed while touching invoices: the insert policy
-- only checked garage membership, so any garage owner (self-serve) could
-- insert an invoice addressed to ANY RDV user, which would then show up
-- in that user's invoice list. An invoice must now match its
-- appointment's garage and customer.
alter policy "Garage members can create invoices for their garage"
  on invoices
  with check (
    (select is_garage_member(garage_id))
    and exists (
      select 1 from appointments a
      where a.id = invoices.appointment_id
        and a.garage_id = invoices.garage_id
        and a.client_id is not distinct from invoices.client_id
        and a.garage_customer_id is not distinct from invoices.garage_customer_id
    )
  );

-- Pre-existing gap: a client's own booking only had to name themselves and
-- 'pending_payment'; nothing tied the service to the booked garage at the
-- DB level (bookAppointment checks it, the REST API didn't).
alter policy "Clients can create a pending-payment appointment for themselves"
  on appointments
  with check (
    (select auth.uid()) = client_id
    and garage_customer_id is null
    and status = 'pending_payment'
    and exists (
      select 1 from services s where s.id = appointments.service_id and s.garage_id = appointments.garage_id
    )
  );
