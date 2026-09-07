-- Fixes a booking-integrity hole in the appointments table's write policies,
-- present since provider_id became garage_id in 0004_garages_and_roles.sql
-- and never revisited:
--
-- 1. "Participants can update their appointments" is
--    `using (auth.uid() = client_id or is_garage_member(garage_id))` with
--    NO `with check`. Since `using` only re-validates the OLD row on
--    UPDATE, this lets:
--      - a client set their OWN appointment's `status` straight to
--        'confirmed' or 'completed' -- skipping garage approval and the
--        Stripe payment step entirely -- or edit `service_id`/`vehicle_id`
--        after the fact;
--      - a garage member reassign `garage_id` to move the appointment to a
--        DIFFERENT garage entirely (the using clause never re-checks
--        membership against the new garage_id, only the old one).
--
-- 2. The insert policy lets a client insert a row with any `status`, not
--    just 'pending_payment' -- bookAppointment always sets it correctly,
--    but nothing stops a direct client-side insert from skipping payment
--    the same way.
--
-- 3. There has never been a DELETE policy on this table. bookAppointment's
--    cleanup path (delete the just-inserted row if Stripe checkout session
--    creation throws) has therefore been a silent no-op since it was
--    written: RLS blocks the delete, the row survives as 'pending_payment'
--    forever, and the no-overlap exclusion constraint (0003) then holds
--    that slot unbookable indefinitely with no Stripe session left to
--    expire it. This migration also fixes that.
--
-- The fix: after insert, every state transition moves through one of the
-- SECURITY DEFINER functions below, each replicating exactly the auth +
-- status guard the corresponding server action in app/actions/appointments.ts
-- already enforced inline -- just now enforced at the one place a bypass of
-- the server action can't get around it. The blanket UPDATE policy is
-- dropped and not replaced: RLS is already enabled on this table, so zero
-- UPDATE policies means default-deny for the `authenticated` role, the same
-- pattern this schema already uses for `payments`.

drop policy "Participants can update their appointments" on appointments;

drop policy "Clients can create appointments for themselves" on appointments;

create policy "Clients can create a pending-payment appointment for themselves"
  on appointments for insert
  with check (auth.uid() = client_id and status = 'pending_payment');

create policy "Clients can delete their own unpaid appointment"
  on appointments for delete
  using (auth.uid() = client_id and status = 'pending_payment');

create or replace function set_appointment_checkout_session(target_appointment_id uuid, session_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set stripe_checkout_session_id = session_id
  where id = target_appointment_id
    and client_id = auth.uid()
    and status = 'pending_payment';

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function set_appointment_checkout_session(uuid, text) to authenticated;

create or replace function cancel_appointment_as_client(target_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set status = 'cancelled'
  where id = target_appointment_id
    and client_id = auth.uid()
    and status in ('pending', 'confirmed');

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function cancel_appointment_as_client(uuid) to authenticated;

create or replace function confirm_appointment(target_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set status = 'confirmed'
  where id = target_appointment_id
    and status = 'pending'
    and is_garage_member(garage_id);

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function confirm_appointment(uuid) to authenticated;

create or replace function update_appointment_repair_stage(target_appointment_id uuid, new_stage text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  -- Valid values are already enforced by appointments.repair_stage's own
  -- check constraint (0024_repair_stage.sql); an invalid new_stage raises
  -- from there rather than being re-validated here.
  update appointments
  set repair_stage = new_stage
  where id = target_appointment_id
    and status = 'confirmed'
    and is_garage_member(garage_id);

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function update_appointment_repair_stage(uuid, text) to authenticated;

create or replace function complete_appointment(target_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set status = 'completed'
  where id = target_appointment_id
    and status in ('pending', 'confirmed')
    and is_garage_member(garage_id);

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function complete_appointment(uuid) to authenticated;

create or replace function cancel_appointment_as_garage(target_appointment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set status = 'cancelled'
  where id = target_appointment_id
    and status in ('pending', 'confirmed')
    and is_garage_member(garage_id);

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function cancel_appointment_as_garage(uuid) to authenticated;

-- Deliberately does NOT catch exclusion_violation (23P01): the caller
-- (rescheduleAppointment) already distinguishes that Postgres error code to
-- show a "slot taken" message versus a generic error, exactly as it did
-- when this used to be a direct table update against the same constraint.
create or replace function reschedule_appointment(
  target_appointment_id uuid,
  new_start timestamptz,
  new_end timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update appointments
  set start_time = new_start, end_time = new_end
  where id = target_appointment_id
    and status in ('pending', 'confirmed')
    and (client_id = auth.uid() or is_garage_member(garage_id));

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function reschedule_appointment(uuid, timestamptz, timestamptz) to authenticated;

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
    and is_garage_member(garage_id);

  get diagnostics updated_count = row_count;
  return updated_count > 0;
end;
$$;

grant execute on function assign_appointment_mechanic(uuid, uuid) to authenticated;
