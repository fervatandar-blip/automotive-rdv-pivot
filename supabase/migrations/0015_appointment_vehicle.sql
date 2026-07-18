-- Lets a client optionally attach one of their saved vehicles (already
-- supported by the `vehicles` table + RLS since 0004_garages_and_roles.sql,
-- never previously wired into booking) to an appointment.

alter table appointments add column vehicle_id uuid references vehicles (id) on delete set null;
