-- Web push device tokens: one row per registered browser/device per profile.

create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create index device_tokens_profile_id_idx on device_tokens (profile_id);

alter table device_tokens enable row level security;

create policy "Users can manage their own device tokens"
  on device_tokens for all
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
