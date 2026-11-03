-- Drag-and-drop rescheduling on the garage calendar: move a job's time and,
-- optionally, its mechanic in one atomic step.
--
-- Why not reschedule_appointment (0027) + assign_appointment_mechanic (0028)?
--   1. Two calls aren't atomic: the time could move and the reassignment
--      then fail, leaving the job somewhere nobody chose.
--   2. On a time change alone, the 0037 trigger keeps the current mechanic
--      only if they're free at the new time, and otherwise silently hands
--      the job to someone else. That's right for "move this job, anyone
--      can do it", wrong for "move it into Lea's column".
--
-- move_appointment(id, new_start, new_end, target_mechanic_id):
--   - caller must be a member of the appointment's garage; the job must be
--     pending or confirmed;
--   - target_mechanic_id NULL: time only. The trigger keeps or reassigns
--     the mechanic (or refuses with 23P01 if nobody is free); the function
--     returns whoever holds the job afterwards, so the app can say so;
--   - target_mechanic_id set: the job must end up with exactly that
--     mechanic, or the whole move is rolled back (23P01). Handing it to a
--     different mechanic than now is an owner decision, as in 0028 (42501
--     otherwise).
--   - returns NULL when there's no such movable appointment for the caller.
-- Opening hours aren't checked here, by design: staff may place a job
-- outside them (early drop-off), as with walk-ins (0038). Past times and
-- day boundaries are checked in the server action.

create or replace function move_appointment(
  target_appointment_id uuid,
  new_start timestamptz,
  new_end timestamptz,
  target_mechanic_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_row public.appointments%rowtype;
  holder uuid;
begin
  if new_end <= new_start then
    raise exception 'invalid_range' using errcode = '22023';
  end if;

  select * into current_row
  from public.appointments
  where id = target_appointment_id
  for update;

  if not found
     or not public.is_garage_member(current_row.garage_id)
     or current_row.status not in ('pending', 'confirmed')
  then
    return null;
  end if;

  if target_mechanic_id is not null
     and target_mechanic_id is distinct from current_row.assigned_mechanic_id
     and not exists (
       select 1 from public.garages g
       where g.id = current_row.garage_id and g.owner_id = (select auth.uid())
     )
  then
    raise exception 'owner_only'
      using errcode = '42501',
            detail = 'Only the garage owner can give a job to another mechanic.';
  end if;

  update public.appointments
  set start_time = new_start,
      end_time = new_end,
      assigned_mechanic_id = coalesce(target_mechanic_id, current_row.assigned_mechanic_id)
  where id = target_appointment_id
  returning assigned_mechanic_id into holder;

  -- Same mechanic as before but busy at the new time: the trigger would
  -- have quietly swapped them. A pinned move must not.
  if target_mechanic_id is not null and holder is distinct from target_mechanic_id then
    raise exception 'mechanic_unavailable'
      using errcode = '23P01',
            detail = 'That mechanic already has a job at that time.';
  end if;

  return holder;
end;
$$;

revoke execute on function move_appointment(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function move_appointment(uuid, timestamptz, timestamptz, uuid) to authenticated, service_role;
