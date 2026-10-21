-- Fixes two issues found auditing assign_appointment_mechanic
-- (0027_appointment_write_integrity.sql):
--
-- 1. No target validation: the function only checked that the CALLER was a
--    member of the appointment's garage -- it never checked that
--    `target_mechanic_id` actually belongs to that garage. Any garage
--    member could set assigned_mechanic_id to an arbitrary profile UUID
--    anywhere in the system (a client, a mechanic at an unrelated garage,
--    even a super_admin). Not an active cross-tenant read today (every
--    current read of assigned_mechanic_id is additionally scoped by
--    garage_id -- see garage/dashboard/page.tsx), but a landmine for any
--    future feature that trusts the column, and a data-integrity bug
--    regardless. garage_staff has no active/inactive flag -- removal is a
--    hard delete (removeMechanic in app/actions/staff.ts) -- so "an active
--    staff member" just means a current garage_staff row.
--
-- 2. Authorization mismatch: the function allowed any garage member (owner
--    OR staff, via is_garage_member) to reassign a mechanic, but the only
--    caller, assignMechanic in app/actions/appointments.ts, gates on
--    requireGarageOwner (owner only). The DB layer was more permissive than
--    the app layer intended, reachable by any staff account calling the
--    RPC directly. Tightened to match: only the garage's owner may call
--    this now.

create or replace function assign_appointment_mechanic(target_appointment_id uuid, target_mechanic_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set assigned_mechanic_id = target_mechanic_id
  where id = target_appointment_id
    -- Caller must be the garage's owner (matches requireGarageOwner in
    -- assignMechanic -- staff may not reassign mechanics).
    and exists (
      select 1 from garages
      where garages.id = appointments.garage_id
        and garages.owner_id = auth.uid()
    )
    -- Target must be null (unassign) or an actual staff member/owner of
    -- this same garage -- never an arbitrary profile.
    and (
      target_mechanic_id is null
      or exists (
        select 1 from garage_staff
        where garage_staff.garage_id = appointments.garage_id
          and garage_staff.profile_id = target_mechanic_id
      )
      or exists (
        select 1 from garages
        where garages.id = appointments.garage_id
          and garages.owner_id = target_mechanic_id
      )
    );

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function assign_appointment_mechanic(uuid, uuid) to authenticated;
