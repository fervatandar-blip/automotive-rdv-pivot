-- Split shifts (e.g. 08:00-12:00 + 13:30-18:00) have always been modelled
-- as several availability rows for the same weekday, and slot generation
-- (lib/slots.ts) already walks each window separately, so the gap between
-- them is never bookable.
--
-- What was missing: nothing stopped two windows on the same day from
-- overlapping (08:00-12:00 and 11:00-14:00), which produced duplicate
-- bookable slots and made the weekly schedule ambiguous. This adds the
-- database-level guarantee; app/actions/availability.ts maps the violation
-- (23P01) to a friendly message.
--
-- Ranges are half-open ([start, end)), so back-to-back windows such as
-- 12:00-13:30 and 13:30-18:00 are still allowed. date_part('epoch', time)
-- is IMMUTABLE, as an exclusion constraint expression requires; btree_gist
-- (installed since 0003) provides the uuid/integer equality operators.
--
-- Verified before writing: 0 overlapping pairs in the live data.

alter table availability
  add constraint availability_no_overlap
  exclude using gist (
    garage_id with =,
    day_of_week with =,
    int4range(
      date_part('epoch', start_time)::int,
      date_part('epoch', end_time)::int
    ) with &&
  );
