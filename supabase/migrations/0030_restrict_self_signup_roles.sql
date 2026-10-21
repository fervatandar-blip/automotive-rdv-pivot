-- Fixes a live privilege-escalation vulnerability in handle_new_user(),
-- present since 0002_profile_trigger.sql and never revisited: the trigger
-- reads `role` directly out of raw_user_meta_data with no allowlist beyond
-- the profiles_role_check CHECK constraint (which permits all four roles).
-- raw_user_meta_data is entirely attacker-controlled input -- it's whatever
-- the caller of Supabase Auth's signUp() passes, and signUp() is reachable
-- by anyone holding the public anon key (a direct POST to
-- /auth/v1/signup, no server involvement required). Empirically confirmed
-- live against this exact trigger, in a rolled-back transaction, before
-- writing this fix: a signup with {"role": "super_admin"} in metadata
-- produced a super_admin profile.
--
-- Fix: the metadata-derived role may only ever be 'client' or
-- 'admin_garage' -- the two roles this app now offers via public
-- self-signup (app/actions/auth.ts's signup() and garageSignup()). Any
-- other requested role (mecanicien, super_admin, or garbage input) is
-- coerced to 'client'. This is unconditional -- applied to every new
-- auth.users row, regardless of whether it was created via the public
-- signUp() API or the admin invite API (admin.auth.admin.inviteUserByEmail)
-- -- because this trigger cannot reliably distinguish which one was used
-- (both ultimately insert into auth.users the same way), so it must not
-- trust either path's metadata to self-elevate to mecanicien/super_admin.
--
-- This does NOT break the existing mecanicien-invite flow
-- (app/actions/staff.ts's inviteMechanic): that flow no longer relies on
-- this trigger to grant the 'mecanicien' role at all -- it now explicitly
-- elevates the freshly-invited profile via a direct service-role update
-- immediately after inviteUserByEmail succeeds, authorized by
-- requireGarageOwner already having gated the caller. See that file's
-- accompanying change.
--
-- This does NOT affect convertLeadToAccount (app/actions/leads.ts), which
-- already only ever requests 'admin_garage' via invite metadata -- still
-- in the allowlist, unchanged behavior.
--
-- Forward-only: this trigger only fires on INSERT into auth.users, so no
-- existing profile is touched by applying this migration.
--
-- Verified live against the connected project (see the session record):
-- pre-fix, a rolled-back test insert with role=super_admin metadata
-- produced a super_admin profile; post-fix, the same input plus
-- role=mecanicien both coerce to 'client', role=admin_garage still grants
-- admin_garage and auto-creates a garage row, and omitted role still
-- defaults to 'client' -- all four cases in one rolled-back transaction,
-- zero rows persisted, existing profiles table row counts unchanged
-- before and after (1 admin_garage, 7 client).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text;
  new_role text;
begin
  requested_role := coalesce(new.raw_user_meta_data ->> 'role', 'client');
  if requested_role = 'provider' then
    requested_role := 'admin_garage';
  end if;

  if requested_role in ('client', 'admin_garage') then
    new_role := requested_role;
  else
    new_role := 'client';
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
