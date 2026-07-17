-- Client ratings & reviews, one per completed appointment.

create table reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  garage_id uuid not null references garages (id) on delete cascade,
  client_id uuid not null references profiles (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

create index reviews_garage_id_idx on reviews (garage_id);

alter table reviews enable row level security;

create policy "Reviews are publicly readable"
  on reviews for select
  using (true);

create policy "Clients can review their own completed appointments"
  on reviews for insert
  with check (
    auth.uid() = client_id
    and exists (
      select 1 from appointments
      where id = appointment_id
        and client_id = auth.uid()
        and status = 'completed'
    )
  );
