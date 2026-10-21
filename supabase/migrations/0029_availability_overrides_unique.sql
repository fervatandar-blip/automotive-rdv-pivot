-- Defense-in-depth for the fix in app/actions/availability.ts's
-- createAvailabilityOverride (delete-then-insert to replace, not add to,
-- an existing override for a date). Without a DB-level constraint that
-- app-layer fix is still racy under two concurrent submissions for the
-- same date; this closes that gap and matches the shape
-- getAvailableSlotsForDate already assumes (at most one override's windows
-- apply per date).
--
-- NOT YET APPLIED to the live project as of this migration being written --
-- application requires a Supabase management-API token, which is not
-- available in this session. Verify with
-- `select conname from pg_constraint where conname =
-- 'availability_overrides_garage_id_date_key'` (or equivalent) before
-- applying, in case this was already run through another channel.

alter table availability_overrides
  add constraint availability_overrides_garage_id_date_key unique (garage_id, date);
