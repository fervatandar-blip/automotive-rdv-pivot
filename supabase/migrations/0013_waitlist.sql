-- Waitlist: a client asks to be notified if a slot opens up for a garage +
-- service + date that currently has none (fully booked or closed). No slot
-- is ever auto-reserved -- see app/actions/appointments.ts's
-- notifyWaitlistOnCancellation for the one-time "heads up" email sent on
-- the next cancellation for that garage/date.

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  client_id uuid not null references profiles (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  date date not null,
  notified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (garage_id, client_id, service_id, date)
);

create index waitlist_garage_date_idx on waitlist (garage_id, date);
create index waitlist_client_id_idx on waitlist (client_id);

alter table waitlist enable row level security;

create policy "Waitlist participants can view their entries"
  on waitlist for select
  using (
    client_id = auth.uid()
    or is_garage_member(garage_id)
    or is_super_admin()
  );

create policy "Clients can join a waitlist for themselves"
  on waitlist for insert
  with check (client_id = auth.uid());

create policy "Clients and garage members can remove waitlist entries"
  on waitlist for delete
  using (client_id = auth.uid() or is_garage_member(garage_id));
