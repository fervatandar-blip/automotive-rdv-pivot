-- Date-specific agenda overrides: a garage can close a specific date (e.g. a
-- holiday) or replace its recurring weekly hours with one-off hours for a
-- specific date. Read alongside the recurring `availability` table -- see
-- app/[lang]/garages/[id]/page.tsx for the resolution order.

create table availability_overrides (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  date date not null,
  is_closed boolean not null default false,
  start_time time,
  end_time time,
  created_at timestamptz not null default now(),
  check (
    (is_closed and start_time is null and end_time is null)
    or (not is_closed and start_time is not null and end_time is not null and end_time > start_time)
  )
);

create index availability_overrides_garage_date_idx on availability_overrides (garage_id, date);

alter table availability_overrides enable row level security;

create policy "Availability overrides are publicly readable"
  on availability_overrides for select
  using (true);

create policy "Garage members manage their availability overrides"
  on availability_overrides for all
  using (is_garage_member(garage_id))
  with check (is_garage_member(garage_id));
