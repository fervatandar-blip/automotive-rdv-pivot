-- Consent-based staff invitations.
--
-- Problem: a garage owner could attach ANY existing mecanicien account to
-- their staff without that mechanic agreeing, and garage-owner accounts are
-- self-serve (/garage/signup). Two paths existed:
--   1. app/actions/staff.ts inviteMechanic: look up the email, and if it
--      belonged to a mecanicien, insert garage_staff directly.
--   2. Directly, with no app involvement at all: the "Garage owners add
--      staff" RLS policy let an owner INSERT any profile_id into
--      garage_staff via /rest/v1/garage_staff.
-- Once attached, is_garage_member()/can_view_related_profile() let the
-- garage read the mechanic's profile, and the mechanic's dashboard would
-- silently switch to that garage.
--
-- inviteMechanic's lookup was also an account-enumeration oracle for any
-- garage owner ("That email already belongs to a non-mecanicien account",
-- "They're already on your staff").
--
-- Fix:
--   - garage_invites holds pending invitations keyed by EMAIL, not
--     profile_id, so the inviting garage never learns whether an email has
--     an account or what role it has.
--   - garage_staff rows can now only be created by accept_garage_invite(),
--     which matches the invite against the caller's VERIFIED auth.users
--     email (never profiles.email, which its owner can edit), requires the
--     mecanicien role, an unexpired pending invite, and that the caller
--     isn't already on another garage's staff.
--   - The owner INSERT policy on garage_staff is dropped.
--   - One garage per mechanic is enforced with a unique constraint;
--     getGarageMembership (lib/dal.ts) already assumes it (.maybeSingle()).
--   - find_invitable_profile_by_email is no longer needed and is dropped.
--
-- garage_staff had 0 rows when this was written, so no existing membership
-- is affected.

create table garage_invites (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  invited_by uuid references profiles (id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  responded_at timestamptz
);

-- At most one live invite per garage+email; accepted/declined history
-- doesn't block re-inviting.
create unique index garage_invites_one_pending_per_email
  on garage_invites (garage_id, email)
  where status = 'pending';

-- Lookup path for accept_garage_invite / list_my_garage_invites.
create index garage_invites_email_idx on garage_invites (email) where status = 'pending';
create index garage_invites_invited_by_idx on garage_invites (invited_by);

alter table garage_invites enable row level security;

-- Owners see and manage their own garage's invites; super admins see all.
-- No UPDATE policy: status changes only happen inside
-- accept_garage_invite / decline_garage_invite.
create policy "Garage owners view their invites"
  on garage_invites for select
  to authenticated
  using (
    exists (
      select 1 from garages
      where garages.id = garage_invites.garage_id
        and garages.owner_id = (select auth.uid())
    )
    or (select is_super_admin())
  );

create policy "Garage owners create pending invites"
  on garage_invites for insert
  to authenticated
  with check (
    status = 'pending'
    and responded_at is null
    and invited_by = (select auth.uid())
    and expires_at <= now() + interval '14 days'
    and exists (
      select 1 from garages
      where garages.id = garage_invites.garage_id
        and garages.owner_id = (select auth.uid())
    )
  );

create policy "Garage owners cancel their invites"
  on garage_invites for delete
  to authenticated
  using (
    exists (
      select 1 from garages
      where garages.id = garage_invites.garage_id
        and garages.owner_id = (select auth.uid())
    )
  );

revoke all on garage_invites from anon;

-- garage_staff: no more direct inserts by owners. Removal by the owner
-- ("Garage owners remove staff") and the member SELECT policy stay.
drop policy "Garage owners add staff" on garage_staff;

alter table garage_staff
  add constraint garage_staff_profile_id_key unique (profile_id);

-- Superseded: account existence is no longer looked up at invite time.
drop function find_invitable_profile_by_email(text);

-- The caller's verified email, from auth.users rather than profiles.email
-- (which the profile owner can change to anything). Null if unconfirmed.
create or replace function current_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = (select auth.uid())
    and u.email_confirmed_at is not null;
$$;

revoke execute on function current_verified_email() from public, anon, authenticated;

-- Pending, unexpired invites addressed to the caller, with the garage name
-- (which the caller usually can't read directly: an unapproved garage is
-- only visible to its own members).
create or replace function list_my_garage_invites()
returns table (id uuid, garage_id uuid, garage_name text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.garage_id, g.name, i.created_at, i.expires_at
  from public.garage_invites i
  join public.garages g on g.id = i.garage_id
  where i.status = 'pending'
    and i.expires_at > now()
    and g.deleted_at is null
    and i.email = public.current_verified_email()
  order by i.created_at desc;
$$;

revoke execute on function list_my_garage_invites() from public, anon;
grant execute on function list_my_garage_invites() to authenticated;

-- Accepts an invite addressed to the caller. Returns a status code rather
-- than raising, so the app can show a specific message:
--   'accepted' | 'not_found' (no matching pending, unexpired invite for
--   this verified email) | 'not_mechanic' | 'already_staff'.
create or replace function accept_garage_invite(target_invite_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  caller_email text := public.current_verified_email();
  invite public.garage_invites%rowtype;
begin
  if caller is null or caller_email is null then
    return 'not_found';
  end if;

  select * into invite
  from public.garage_invites
  where id = target_invite_id
    and status = 'pending'
    and expires_at > now()
    and email = caller_email
  for update;

  if not found then
    return 'not_found';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = caller and role = 'mecanicien' and deleted_at is null
  ) then
    return 'not_mechanic';
  end if;

  if exists (select 1 from public.garage_staff where profile_id = caller) then
    return 'already_staff';
  end if;

  begin
    insert into public.garage_staff (garage_id, profile_id)
    values (invite.garage_id, caller);
  exception when unique_violation then
    -- Lost a race with a concurrent accept of another garage's invite.
    return 'already_staff';
  end;

  update public.garage_invites
  set status = 'accepted', responded_at = now()
  where id = invite.id;

  -- Any other pending invites to this email are now moot (one garage per
  -- mechanic); close them so they stop showing up.
  update public.garage_invites
  set status = 'declined', responded_at = now()
  where email = caller_email
    and status = 'pending'
    and id <> invite.id;

  return 'accepted';
end;
$$;

revoke execute on function accept_garage_invite(uuid) from public, anon;
grant execute on function accept_garage_invite(uuid) to authenticated;

create or replace function decline_garage_invite(target_invite_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_email text := public.current_verified_email();
  updated_count integer;
begin
  if caller_email is null then
    return false;
  end if;

  update public.garage_invites
  set status = 'declined', responded_at = now()
  where id = target_invite_id
    and status = 'pending'
    and email = caller_email;

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

revoke execute on function decline_garage_invite(uuid) from public, anon;
grant execute on function decline_garage_invite(uuid) to authenticated;
