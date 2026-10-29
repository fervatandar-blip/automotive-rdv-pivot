-- Per-mechanic scheduling: a garage can run as many jobs in parallel as it
-- has bookable mechanics.
--
-- Before: appointments_no_overlap (0003) excluded ANY two overlapping
-- active appointments at the same garage, so a garage with four
-- technicians could only ever have one car booked at a time.
--
-- After:
--   - The bookable mechanics of a garage are its accepted staff
--     (garage_staff) plus the owner, unless the owner opts out
--     (garages.owner_takes_bookings, so a one-person garage works out of
--     the box).
--   - Every active (non-cancelled) appointment has an assigned mechanic,
--     and one mechanic can't have two overlapping active appointments
--     (appointments_mechanic_no_overlap).
--   - The mechanic is chosen by the database, never by the client: a
--     BEFORE trigger assigns the free mechanic with the fewest jobs that
--     day. A client-supplied assigned_mechanic_id is ignored, so a booking
--     can't name another garage's mechanic. Garage members may choose a
--     specific mechanic; if that mechanic is busy the write fails rather
--     than silently picking someone else.
--   - Assignment is serialized per garage with a transaction-scoped
--     advisory lock, so two clients racing for the last free mechanic get
--     one booking and one 23P01 ("slot just taken", already handled by
--     bookAppointment/rescheduleAppointment). The exclusion constraint is
--     the backstop.
--   - get_booked_ranges now returns an anonymous lane per mechanic (never
--     the mechanic's id -- it's callable by anonymous visitors), and
--     get_bookable_mechanic_count gives the garage's capacity, so
--     lib/slots.ts can offer a slot while at least one mechanic is free.
--     It also now returns appointments that merely overlap the range
--     (previously only those starting inside it).
--
-- Known limitation (v1): all bookable mechanics follow the garage's
-- opening hours; individual days off aren't modelled yet.

alter table garages add column owner_takes_bookings boolean not null default true;
grant update (owner_takes_bookings) on garages to authenticated;

create or replace function garage_mechanic_ids(target_garage_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select g.owner_id
  from public.garages g
  where g.id = target_garage_id and g.owner_takes_bookings
  union
  select s.profile_id
  from public.garage_staff s
  where s.garage_id = target_garage_id;
$$;

revoke execute on function garage_mechanic_ids(uuid) from public, anon, authenticated;

create or replace function assign_appointment_mechanic_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_is_member boolean := public.is_garage_member(new.garage_id);
  explicit_choice boolean;
  chosen uuid;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  -- Serialize mechanic assignment per garage for the rest of this
  -- transaction.
  perform pg_advisory_xact_lock(hashtextextended('appointments:' || new.garage_id::text, 0));

  if tg_op = 'INSERT' and not caller_is_member then
    -- Clients (and server code without a member session) never choose.
    new.assigned_mechanic_id := null;
  end if;

  explicit_choice := new.assigned_mechanic_id is not null and (
    (tg_op = 'INSERT' and caller_is_member)
    or (tg_op = 'UPDATE' and new.assigned_mechanic_id is distinct from old.assigned_mechanic_id)
  );

  if new.assigned_mechanic_id is not null then
    if new.assigned_mechanic_id in (select public.garage_mechanic_ids(new.garage_id))
       and not exists (
         select 1 from public.appointments a
         where a.assigned_mechanic_id = new.assigned_mechanic_id
           and a.id <> new.id
           and a.status <> 'cancelled'
           and tstzrange(a.start_time, a.end_time) && tstzrange(new.start_time, new.end_time)
       )
    then
      return new;
    end if;

    if explicit_choice then
      raise exception 'mechanic_unavailable'
        using errcode = '23P01',
              detail = 'That mechanic is not part of this garage or already has a job at that time.';
    end if;
  end if;

  -- Auto-assign: a current mechanic who is free for the whole range, with
  -- the fewest active jobs that (Luxembourg) day; ties broken by id so the
  -- choice is deterministic.
  select m.id into chosen
  from public.garage_mechanic_ids(new.garage_id) as m(id)
  where not exists (
    select 1 from public.appointments a
    where a.assigned_mechanic_id = m.id
      and a.id <> new.id
      and a.status <> 'cancelled'
      and tstzrange(a.start_time, a.end_time) && tstzrange(new.start_time, new.end_time)
  )
  order by (
    select count(*) from public.appointments a
    where a.assigned_mechanic_id = m.id
      and a.status <> 'cancelled'
      and (a.start_time at time zone 'Europe/Luxembourg')::date
        = (new.start_time at time zone 'Europe/Luxembourg')::date
  ), m.id
  limit 1;

  if chosen is null then
    raise exception 'no_mechanic_available'
      using errcode = '23P01',
            detail = 'Every mechanic at this garage already has a job at that time.';
  end if;

  new.assigned_mechanic_id := chosen;
  return new;
end;
$$;

revoke execute on function assign_appointment_mechanic_trigger() from public, anon, authenticated;

-- Give every active appointment a mechanic (the owner) before the new
-- rules apply. The old garage-wide constraint guarantees these can't
-- overlap, so the new per-mechanic constraint holds for them.
update appointments a
set assigned_mechanic_id = g.owner_id
from garages g
where g.id = a.garage_id
  and a.assigned_mechanic_id is null
  and a.status <> 'cancelled';

alter table appointments drop constraint appointments_no_overlap;

alter table appointments
  add constraint appointments_mechanic_no_overlap
  exclude using gist (
    assigned_mechanic_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status <> 'cancelled');

alter table appointments
  add constraint appointments_active_has_mechanic
  check (status = 'cancelled' or assigned_mechanic_id is not null);

create trigger appointments_assign_mechanic
  before insert or update of start_time, end_time, assigned_mechanic_id, status
  on appointments
  for each row
  execute function assign_appointment_mechanic_trigger();

-- Public slot inputs. Return type changes, so drop and recreate.
drop function get_booked_ranges(uuid, timestamptz, timestamptz, uuid);

create function get_booked_ranges(
  target_garage_id uuid,
  range_start timestamptz,
  range_end timestamptz,
  exclude_appointment_id uuid default null
)
returns table (start_time timestamptz, end_time timestamptz, lane integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.start_time,
         a.end_time,
         dense_rank() over (order by a.assigned_mechanic_id)::integer as lane
  from public.appointments a
  where a.garage_id = target_garage_id
    and a.status <> 'cancelled'
    and a.start_time < range_end
    and a.end_time > range_start
    and (exclude_appointment_id is null or a.id <> exclude_appointment_id)
    and a.assigned_mechanic_id in (select public.garage_mechanic_ids(target_garage_id));
$$;

grant execute on function get_booked_ranges(uuid, timestamptz, timestamptz, uuid) to anon, authenticated, service_role;

create or replace function get_bookable_mechanic_count(target_garage_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.garage_mechanic_ids(target_garage_id);
$$;

grant execute on function get_bookable_mechanic_count(uuid) to anon, authenticated, service_role;

-- The staff/assignment RPC keeps its owner-only check; the trigger now
-- validates the target mechanic and refuses a busy one.
