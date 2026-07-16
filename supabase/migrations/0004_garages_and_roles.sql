-- Pivot from a flat client/provider model to garages as first-class entities
-- with staff, plus the full 4-role model (client, admin_garage, mecanicien,
-- super_admin).

-- 1. Expand roles, migrate existing 'provider' profiles to 'admin_garage'.
alter table profiles drop constraint profiles_role_check;
update profiles set role = 'admin_garage' where role = 'provider';
alter table profiles add constraint profiles_role_check
  check (role in ('client', 'admin_garage', 'mecanicien', 'super_admin'));

-- 2. Garages: the business entity a garage account and its staff belong to.
create table garages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles (id) on delete cascade,
  name text not null,
  description text,
  address text,
  city text,
  phone text,
  email text,
  opening_hours jsonb,
  ev_capable boolean not null default false,
  mobile_service boolean not null default false,
  emergency_service boolean not null default false,
  pricing_category text,
  technician_count integer,
  languages_spoken text[],
  verification_level text not null default 'basic'
    check (verification_level in ('basic', 'verified', 'ev_certified', 'trusted_partner')),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  platform_terms_accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index garages_owner_id_idx on garages (owner_id);

-- 3. Garage staff: mecanicien membership. Ownership (admin_garage) is via
-- garages.owner_id, not this table.
create table garage_staff (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (garage_id, profile_id)
);

create index garage_staff_garage_id_idx on garage_staff (garage_id);
create index garage_staff_profile_id_idx on garage_staff (profile_id);

-- 4. Lookup tables + vehicles.
create table brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table garage_brands (
  garage_id uuid not null references garages (id) on delete cascade,
  brand_id uuid not null references brands (id) on delete cascade,
  primary key (garage_id, brand_id)
);

create table specialties (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table garage_specialties (
  garage_id uuid not null references garages (id) on delete cascade,
  specialty_id uuid not null references specialties (id) on delete cascade,
  primary key (garage_id, specialty_id)
);

create table service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  parent_id uuid references service_categories (id) on delete cascade
);

create table vehicles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles (id) on delete cascade,
  brand_id uuid references brands (id),
  model text,
  year integer,
  license_plate text,
  created_at timestamptz not null default now()
);

create index vehicles_client_id_idx on vehicles (client_id);

-- 5. services/availability/appointments move from a single provider profile
-- to a garage. The appointments no-overlap exclusion constraint references
-- this column by attribute, not name, so it keeps working across the rename.
alter table services rename column provider_id to garage_id;
alter table services drop constraint services_provider_id_fkey;
alter table services add constraint services_garage_id_fkey
  foreign key (garage_id) references garages (id) on delete cascade;
alter table services add column category_id uuid references service_categories (id);

alter table availability rename column provider_id to garage_id;
alter table availability drop constraint availability_provider_id_fkey;
alter table availability add constraint availability_garage_id_fkey
  foreign key (garage_id) references garages (id) on delete cascade;

alter table appointments rename column provider_id to garage_id;
alter table appointments drop constraint appointments_provider_id_fkey;
alter table appointments add constraint appointments_garage_id_fkey
  foreign key (garage_id) references garages (id) on delete cascade;

-- 6. RLS helper functions.
create or replace function is_super_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function is_garage_member(check_garage_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from garages where id = check_garage_id and owner_id = auth.uid()
  ) or exists (
    select 1 from garage_staff
    where garage_id = check_garage_id and profile_id = auth.uid()
  );
$$;

-- 7. RLS: garages.
alter table garages enable row level security;

create policy "Approved garages are publicly readable"
  on garages for select
  using (
    status = 'approved'
    or owner_id = auth.uid()
    or is_garage_member(id)
    or is_super_admin()
  );

create policy "Owners can insert their garage"
  on garages for insert
  with check (auth.uid() = owner_id);

create policy "Owners and super admins can update garages"
  on garages for update
  using (auth.uid() = owner_id or is_super_admin());

-- 8. RLS: garage_staff.
alter table garage_staff enable row level security;

create policy "Garage members can view staff list"
  on garage_staff for select
  using (is_garage_member(garage_id) or is_super_admin());

create policy "Garage owners add staff"
  on garage_staff for insert
  with check (
    exists (select 1 from garages where id = garage_id and owner_id = auth.uid())
    or is_super_admin()
  );

create policy "Garage owners remove staff"
  on garage_staff for delete
  using (
    exists (select 1 from garages where id = garage_id and owner_id = auth.uid())
    or is_super_admin()
  );

-- 9. RLS: lookup tables (public read, super admin write) and their garage joins.
alter table brands enable row level security;
create policy "Brands are publicly readable" on brands for select using (true);
create policy "Super admins manage brands" on brands for all
  using (is_super_admin()) with check (is_super_admin());

alter table specialties enable row level security;
create policy "Specialties are publicly readable" on specialties for select using (true);
create policy "Super admins manage specialties" on specialties for all
  using (is_super_admin()) with check (is_super_admin());

alter table service_categories enable row level security;
create policy "Categories are publicly readable" on service_categories for select using (true);
create policy "Super admins manage categories" on service_categories for all
  using (is_super_admin()) with check (is_super_admin());

alter table garage_brands enable row level security;
create policy "Garage brands are publicly readable" on garage_brands for select using (true);
create policy "Garage members manage their brands" on garage_brands for all
  using (is_garage_member(garage_id)) with check (is_garage_member(garage_id));

alter table garage_specialties enable row level security;
create policy "Garage specialties are publicly readable" on garage_specialties for select using (true);
create policy "Garage members manage their specialties" on garage_specialties for all
  using (is_garage_member(garage_id)) with check (is_garage_member(garage_id));

-- 10. RLS: vehicles (owned solely by the client).
alter table vehicles enable row level security;
create policy "Clients manage their own vehicles" on vehicles for all
  using (auth.uid() = client_id) with check (auth.uid() = client_id);

-- 11. Replace services/availability/appointments policies with garage-membership checks.
drop policy "Services are publicly readable" on services;
drop policy "Providers can insert their own services" on services;
drop policy "Providers can update their own services" on services;
drop policy "Providers can delete their own services" on services;

create policy "Services are publicly readable" on services for select using (true);
create policy "Garage members manage their services" on services for all
  using (is_garage_member(garage_id)) with check (is_garage_member(garage_id));

drop policy "Availability is publicly readable" on availability;
drop policy "Providers can insert their own availability" on availability;
drop policy "Providers can update their own availability" on availability;
drop policy "Providers can delete their own availability" on availability;

create policy "Availability is publicly readable" on availability for select using (true);
create policy "Garage members manage their availability" on availability for all
  using (is_garage_member(garage_id)) with check (is_garage_member(garage_id));

drop policy "Participants can view their appointments" on appointments;
drop policy "Clients can create appointments for themselves" on appointments;
drop policy "Participants can update their appointments" on appointments;

create policy "Participants can view their appointments" on appointments for select
  using (auth.uid() = client_id or is_garage_member(garage_id) or is_super_admin());
create policy "Clients can create appointments for themselves" on appointments for insert
  with check (auth.uid() = client_id);
create policy "Participants can update their appointments" on appointments for update
  using (auth.uid() = client_id or is_garage_member(garage_id));

-- 12. Profile-creation trigger now also provisions a pending garage row for
-- new admin_garage signups (the Phase 4 onboarding wizard fills it in), and
-- normalizes a legacy 'provider' role value to 'admin_garage' just in case.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_role text;
begin
  new_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  if new_role = 'provider' then
    new_role := 'admin_garage';
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    new_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );

  if new_role = 'admin_garage' then
    insert into public.garages (owner_id, name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'My Garage'));
  end if;

  return new;
end;
$$;

-- 13. Backfill: existing admin_garage profiles (migrated from 'provider' in
-- step 1) get a garage row too, grandfathered in as already-approved since
-- they were functioning providers before this migration.
insert into garages (owner_id, name, status)
select p.id, coalesce(nullif(p.full_name, ''), 'My Garage'), 'approved'
from profiles p
where p.role = 'admin_garage'
  and not exists (select 1 from garages g where g.owner_id = p.id);
