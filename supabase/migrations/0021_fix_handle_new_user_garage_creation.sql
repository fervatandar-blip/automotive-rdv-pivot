-- Fixes a regression introduced by 0020_consent_tracking.sql: that
-- migration redefined handle_new_user() from the stale 0002 version,
-- silently dropping the garage-auto-creation and legacy-role-normalization
-- logic that 0004_garages_and_roles.sql had already added to it. Restores
-- both, keeping this migration's terms_accepted_at addition.

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

  insert into public.profiles (id, role, full_name, email, terms_accepted_at)
  values (
    new.id,
    new_role,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email,
    now()
  );

  if new_role = 'admin_garage' then
    insert into public.garages (owner_id, name)
    values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', 'My Garage'));
  end if;

  return new;
end;
$$;
