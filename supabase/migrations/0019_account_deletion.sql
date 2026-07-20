-- GDPR account deletion request workflow: a grace-period request/cancel
-- flag on profiles, plus a matching deleted_at marker on both profiles and
-- garages for when a request is actually processed (anonymized, never
-- cascade-deleted -- see lib/account-deletion.ts).

alter table profiles add column deletion_requested_at timestamptz;
alter table profiles add column deleted_at timestamptz;
alter table garages add column deleted_at timestamptz;
