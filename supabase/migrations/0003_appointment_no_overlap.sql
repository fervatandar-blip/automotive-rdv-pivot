-- Guarantee at the database level that a provider can't hold two
-- overlapping non-cancelled appointments, even under concurrent bookings.
create extension if not exists btree_gist;

alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (
    provider_id with =,
    tstzrange(start_time, end_time) with &&
  )
  where (status <> 'cancelled');
