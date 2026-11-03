-- Garage CRM notes: what a garage keeps about a client for its own use --
-- free-text notes, a VIP flag, when they prefer to be contacted, and (for
-- registered RDV clients only) a phone number, since RDV profiles don't
-- store one.
--
-- One row per garage per person, about exactly one of:
--   - a registered client (client_id), or
--   - the garage's own customer (garage_customer_id, 0038), whose name,
--     phone and email already live on garage_customers.
--
-- Privacy:
--   - Visible to and editable by that garage's members only; never to the
--     client, never to other garages. The garage is the data controller.
--   - A garage may only create notes about a registered client who has
--     booked with it -- never about an arbitrary RDV user (same rule as
--     walk-in bookings, 0038).
--   - Erasure: account deletion (lib/account-deletion.ts) anonymizes
--     profiles in place rather than deleting them, so the ON DELETE CASCADE
--     below would never fire for it; that code deletes these rows itself.
--     Anonymizing a walk-in customer (app/actions/walk-ins.ts) does the
--     same.

create table garage_client_notes (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  client_id uuid references profiles (id) on delete cascade,
  garage_customer_id uuid references garage_customers (id) on delete cascade,
  notes text check (notes is null or char_length(notes) <= 2000),
  is_vip boolean not null default false,
  preferred_contact_time text
    check (preferred_contact_time is null or char_length(preferred_contact_time) <= 80),
  -- Garage-kept phone for a registered client. A garage customer's phone
  -- is on garage_customers.
  phone text check (phone is null or char_length(phone) <= 40),
  updated_by uuid references profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint garage_client_notes_single_subject
    check (num_nonnulls(client_id, garage_customer_id) = 1),
  constraint garage_client_notes_phone_for_clients_only
    check (phone is null or client_id is not null),
  unique (garage_id, client_id),
  unique (garage_id, garage_customer_id)
);

create index garage_client_notes_client_id_idx on garage_client_notes (client_id);
create index garage_client_notes_garage_customer_id_idx on garage_client_notes (garage_customer_id);
create index garage_client_notes_updated_by_idx on garage_client_notes (updated_by);

alter table garage_client_notes enable row level security;

create policy "Garage members read their client notes"
  on garage_client_notes for select
  to authenticated
  using ((select is_garage_member(garage_id)));

create policy "Garage members delete their client notes"
  on garage_client_notes for delete
  to authenticated
  using ((select is_garage_member(garage_id)));

create policy "Garage members write notes about their own clients"
  on garage_client_notes for insert
  to authenticated
  with check (
    (select is_garage_member(garage_id))
    and (
      exists (
        select 1 from garage_customers gc
        where gc.id = garage_client_notes.garage_customer_id
          and gc.garage_id = garage_client_notes.garage_id
          and gc.anonymized_at is null
      )
      or exists (
        select 1 from appointments a
        where a.client_id = garage_client_notes.client_id
          and a.garage_id = garage_client_notes.garage_id
      )
    )
  );

create policy "Garage members update notes about their own clients"
  on garage_client_notes for update
  to authenticated
  using ((select is_garage_member(garage_id)))
  with check (
    (select is_garage_member(garage_id))
    and (
      exists (
        select 1 from garage_customers gc
        where gc.id = garage_client_notes.garage_customer_id
          and gc.garage_id = garage_client_notes.garage_id
          and gc.anonymized_at is null
      )
      or exists (
        select 1 from appointments a
        where a.client_id = garage_client_notes.client_id
          and a.garage_id = garage_client_notes.garage_id
      )
    )
  );

revoke all on garage_client_notes from anon;
