-- Lets a garage assign a specific mecanicien to an appointment. Assignment
-- is a workflow field, not an access-control one: any garage member can
-- still see/manage all of the garage's appointments per existing RLS.
alter table appointments
  add column assigned_mechanic_id uuid references profiles (id) on delete set null;

create index appointments_assigned_mechanic_id_idx on appointments (assigned_mechanic_id);
