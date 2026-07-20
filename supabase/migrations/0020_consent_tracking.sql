-- GDPR consent tracking: a general Terms of Service / Privacy Policy
-- acceptance timestamp on profiles (all roles, distinct from
-- garages.platform_terms_accepted_at, which is specifically about business
-- verification protocols), and a per-booking consent timestamp on
-- appointments so every checkout is also a consent checkpoint -- covering
-- accounts created before this migration too.

alter table profiles add column terms_accepted_at timestamptz;
alter table appointments add column terms_accepted_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, email, terms_accepted_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'role', 'client'),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    now()
  );
  return new;
end;
$$;
