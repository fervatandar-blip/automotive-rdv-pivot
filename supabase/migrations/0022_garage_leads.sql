-- Garage sales leads from the public "Book a Demo" page. Not yet linked to
-- a real garage -- converted_garage_id gets set once an admin provisions an
-- account from a lead (a later pass).

create table garage_leads (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  business_email text not null,
  phone text,
  garage_name text not null,
  country text not null check (country in ('LU', 'BE', 'FR', 'DE')),
  message text,
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'archived')),
  converted_garage_id uuid references garages (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table garage_leads enable row level security;

create policy "Anyone can submit a garage lead"
  on garage_leads for insert
  with check (true);

create policy "Super admins can view leads"
  on garage_leads for select
  using (is_super_admin());

create policy "Super admins can update leads"
  on garage_leads for update
  using (is_super_admin())
  with check (is_super_admin());
