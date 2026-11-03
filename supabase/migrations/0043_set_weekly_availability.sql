-- Save a garage's whole weekly schedule in one transaction, for the
-- "Working hours" form (a row per day: open/closed, opening hours, an
-- optional lunch break).
--
-- Why a function: the form replaces every window at once. Through the REST
-- API that's a delete followed by an insert -- two requests. If the insert
-- failed after the delete, the garage would be left with no opening hours
-- (and no bookable slots) until someone noticed. Inserting first isn't an
-- option either: availability_no_overlap (0035) rejects new windows that
-- overlap the old ones. Here both happen in one transaction: all or
-- nothing.
--
-- SECURITY INVOKER on purpose: the caller's own RLS applies ("Garage
-- members manage their availability", 0004), so this grants nothing new;
-- the explicit membership check just gives a clear error instead of a
-- silent no-op. Overlaps and end <= start are still refused by the table's
-- constraints, rolling the whole save back.
--
-- windows: [{"day_of_week": 1, "start_time": "08:00", "end_time": "12:00"}, ...]
-- An empty array closes every day.

create or replace function set_weekly_availability(target_garage_id uuid, windows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted integer;
begin
  if not public.is_garage_member(target_garage_id) then
    raise exception 'not_a_member' using errcode = '42501';
  end if;
  if jsonb_typeof(windows) <> 'array' then
    raise exception 'windows must be a JSON array' using errcode = '22023';
  end if;

  delete from public.availability where garage_id = target_garage_id;

  insert into public.availability (garage_id, day_of_week, start_time, end_time)
  select target_garage_id, w.day_of_week, w.start_time, w.end_time
  from jsonb_to_recordset(windows) as w(day_of_week integer, start_time time, end_time time);

  get diagnostics inserted = row_count;
  return inserted;
end;
$$;

revoke execute on function set_weekly_availability(uuid, jsonb) from public, anon;
grant execute on function set_weekly_availability(uuid, jsonb) to authenticated, service_role;
