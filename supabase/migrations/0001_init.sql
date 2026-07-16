-- Core schema for RDV-App: a multi-provider appointment booking marketplace.

create extension if not exists "pgcrypto";

-- One row per auth.users, distinguishing clients from providers.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('client', 'provider')),
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Bookable offerings, each owned by a provider.
create table services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) not null check (price >= 0),
  created_at timestamptz not null default now()
);

-- Recurring weekly windows during which a provider can be booked.
create table availability (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references profiles (id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null check (end_time > start_time),
  created_at timestamptz not null default now()
);

-- A client booking a service with a provider at a specific time.
create table appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles (id) on delete cascade,
  provider_id uuid not null references profiles (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null check (end_time > start_time),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at timestamptz not null default now()
);

create index services_provider_id_idx on services (provider_id);
create index availability_provider_id_idx on availability (provider_id);
create index appointments_client_id_idx on appointments (client_id);
create index appointments_provider_id_idx on appointments (provider_id);
create index appointments_service_id_idx on appointments (service_id);

-- Row Level Security
alter table profiles enable row level security;
alter table services enable row level security;
alter table availability enable row level security;
alter table appointments enable row level security;

-- Profiles: publicly readable (needed to browse providers), self-editable only.
create policy "Profiles are publicly readable"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Services: publicly readable, only the owning provider can manage them.
create policy "Services are publicly readable"
  on services for select
  using (true);

create policy "Providers can insert their own services"
  on services for insert
  with check (auth.uid() = provider_id);

create policy "Providers can update their own services"
  on services for update
  using (auth.uid() = provider_id);

create policy "Providers can delete their own services"
  on services for delete
  using (auth.uid() = provider_id);

-- Availability: publicly readable, only the owning provider can manage it.
create policy "Availability is publicly readable"
  on availability for select
  using (true);

create policy "Providers can insert their own availability"
  on availability for insert
  with check (auth.uid() = provider_id);

create policy "Providers can update their own availability"
  on availability for update
  using (auth.uid() = provider_id);

create policy "Providers can delete their own availability"
  on availability for delete
  using (auth.uid() = provider_id);

-- Appointments: visible only to the client and provider involved.
create policy "Participants can view their appointments"
  on appointments for select
  using (auth.uid() = client_id or auth.uid() = provider_id);

create policy "Clients can create appointments for themselves"
  on appointments for insert
  with check (auth.uid() = client_id);

create policy "Participants can update their appointments"
  on appointments for update
  using (auth.uid() = client_id or auth.uid() = provider_id);
