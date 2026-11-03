-- Intraday time blocks: a garage can block e.g. 14:00-15:00 on one date
-- (staff meeting, delivery, a mechanic's appointment) without touching its
-- opening hours.
--
-- Until now the only per-date tool was availability_overrides (0012), which
-- either closes the whole date or REPLACES its hours with a single window
-- (unique per date since 0029) -- so blocking one hour in the middle of the
-- day was impossible.
--
-- Model:
--   - availability_blocks: garage-wide blocked ranges as real instants
--     (timestamptz), so DST and the Europe/Luxembourg wall clock are
--     resolved once, at write time, by the app (lib/timezone.ts).
--   - A block applies to the whole garage (every mechanic). Per-mechanic
--     time off is a separate, later feature (see 0037's known limitation).
--   - Blocks of one garage can't overlap (exclusion constraint), so the
--     list a garage sees is never ambiguous and subtraction never
--     double-counts.
--   - The reason is internal: garage members read/write the table through
--     RLS; everyone else (including anonymous visitors computing bookable
--     slots) gets only start/end through get_availability_blocks, the same
--     way get_booked_ranges (0037) exposes appointments.
--
-- Enforcement: like opening hours, blocks are applied where slots are
-- computed (lib/availability.ts), which bookAppointment and
-- rescheduleAppointment both re-run server-side before writing. Existing
-- appointments inside a new block are NOT cancelled; the app warns the
-- garage so it can reschedule them.

create table availability_blocks (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 120),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint availability_blocks_valid_range
    check (ends_at > starts_at and ends_at - starts_at <= interval '24 hours'),
  constraint availability_blocks_no_overlap
    exclude using gist (garage_id with =, tstzrange(starts_at, ends_at) with &&)
);

create index availability_blocks_created_by_idx on availability_blocks (created_by);

alter table availability_blocks enable row level security;

create policy "Garage members manage their availability blocks"
  on availability_blocks for all
  to authenticated
  using ((select is_garage_member(garage_id)))
  with check ((select is_garage_member(garage_id)));

revoke all on availability_blocks from anon;

create or replace function get_availability_blocks(
  target_garage_id uuid,
  range_start timestamptz,
  range_end timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at, b.ends_at
  from public.availability_blocks b
  where b.garage_id = target_garage_id
    and b.starts_at < range_end
    and b.ends_at > range_start
  order by b.starts_at;
$$;

revoke execute on function get_availability_blocks(uuid, timestamptz, timestamptz) from public;
grant execute on function get_availability_blocks(uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
