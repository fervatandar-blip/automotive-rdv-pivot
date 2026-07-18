-- Fixes a latent booking-availability bug: appointments' SELECT RLS only
-- lets the appointment's own client (or a garage member) see a row, so a
-- browsing client's session can't see a *different* client's booked
-- appointment when the garage detail page computes "available" slots --
-- undercounting what's actually taken. This security-definer function
-- returns only start_time/end_time (no client identity, no other columns)
-- for a garage's non-cancelled appointments in a date range, callable by
-- any authenticated user -- public availability info, same trust level as
-- the slots the booking page already shows. `exclude_appointment_id` lets
-- the reschedule picker treat the appointment being moved as not-yet-booked
-- against itself.
create or replace function get_booked_ranges(
  target_garage_id uuid,
  range_start timestamptz,
  range_end timestamptz,
  exclude_appointment_id uuid default null
)
returns table (start_time timestamptz, end_time timestamptz)
language sql
security definer
stable
as $$
  select appointments.start_time, appointments.end_time
  from appointments
  where appointments.garage_id = target_garage_id
    and appointments.status <> 'cancelled'
    and appointments.start_time >= range_start
    and appointments.start_time < range_end
    and (exclude_appointment_id is null or appointments.id <> exclude_appointment_id);
$$;

grant execute on function get_booked_ranges(uuid, timestamptz, timestamptz, uuid) to authenticated;
