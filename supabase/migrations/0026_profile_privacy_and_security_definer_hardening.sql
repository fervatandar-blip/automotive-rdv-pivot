-- Fixes two profiles-table holes that have existed since 0001_init.sql:
--
-- 1. Privilege escalation: "Users can update their own profile" has no
--    `with check`, so any authenticated user can run
--    `update profiles set role = 'super_admin' where id = auth.uid()`
--    directly against Supabase (no server bypass needed) and become
--    super_admin -- the role every other RLS policy in this schema treats
--    as the platform's master key (document review, lead access, garage
--    approval, all of it). Role changes now go exclusively through
--    admin_set_profile_role(), callable only by an existing super_admin.
--
-- 2. PII exposure: "Profiles are publicly readable" is `using (true)` with
--    no `to` clause, so the anon key alone can list every user's full name
--    and email with a plain `select * from profiles`. Every real read site
--    in the app (grepped across app/ and lib/) only ever needs: a user's
--    own row, a super_admin's full view, or a garage member looking up a
--    client/staff profile tied to their own garage (appointments, waitlist,
--    garage_staff, or garage ownership) -- so that's what the new policy
--    allows, nothing broader.
--
-- inviteMechanic (app/actions/staff.ts) is the one legitimate read that
-- doesn't fit that shape -- a garage owner looking up a profile by email
-- *before* any relationship exists, to decide whether to attach an existing
-- mécanicien or send a fresh invite. find_invitable_profile_by_email() below
-- replaces that raw table read with a narrow accessor returning only
-- (id, role) for an exact email match -- the same non-PII shape the app
-- already exposed by necessity, just no longer as a side effect of a
-- publicly readable table.

create or replace function can_view_related_profile(target_profile_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    exists (
      select 1 from appointments
      where appointments.client_id = target_profile_id
        and is_garage_member(appointments.garage_id)
    )
    or exists (
      select 1 from waitlist
      where waitlist.client_id = target_profile_id
        and is_garage_member(waitlist.garage_id)
    )
    or exists (
      select 1 from garages
      where garages.owner_id = target_profile_id
        and is_garage_member(garages.id)
    )
    or exists (
      select 1 from garage_staff
      where garage_staff.profile_id = target_profile_id
        and is_garage_member(garage_staff.garage_id)
    );
$$;

drop policy "Profiles are publicly readable" on profiles;

create policy "Profiles are visible to self, admins, and related garage members"
  on profiles for select
  using (
    auth.uid() = id
    or is_super_admin()
    or can_view_related_profile(id)
  );

drop policy "Users can insert their own profile" on profiles;

create policy "Users can insert their own client profile"
  on profiles for insert
  with check (auth.uid() = id and role = 'client');

drop policy "Users can update their own profile" on profiles;

create policy "Users can update their own profile (role excluded)"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from profiles where id = auth.uid())
  );

create or replace function admin_set_profile_role(target_profile_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_super_admin() then
    raise exception 'Only a super_admin may change a profile role.';
  end if;

  if new_role not in ('client', 'admin_garage', 'mecanicien', 'super_admin') then
    raise exception 'Invalid role: %', new_role;
  end if;

  update profiles set role = new_role where id = target_profile_id;
end;
$$;

grant execute on function admin_set_profile_role(uuid, text) to authenticated;

-- Returns only (id, role) for an exact, case-sensitive email match -- never
-- full_name, never a partial/fuzzy match, never a list. Enough for
-- inviteMechanic's "attach existing account or send a fresh invite"
-- decision, nothing more.
create or replace function find_invitable_profile_by_email(target_email text)
returns table (id uuid, role text)
language sql
security definer
stable
set search_path = public
as $$
  select profiles.id, profiles.role
  from profiles
  where profiles.email = target_email;
$$;

grant execute on function find_invitable_profile_by_email(text) to authenticated;

-- Search-path hardening: these four SECURITY DEFINER functions predate this
-- migration and were missing `set search_path`, leaving them (in theory)
-- open to a search-path hijack if a lower-privileged role ever creates
-- objects in a schema ahead of `public` in the definer's path. Low risk on
-- a single-schema Supabase project, but free to close.
alter function is_super_admin() set search_path = public;
alter function is_garage_member(uuid) set search_path = public;
alter function get_booked_ranges(uuid, timestamptz, timestamptz, uuid) set search_path = public;
alter function increment_invoice_number(uuid) set search_path = public;
