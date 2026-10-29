-- Vehicle search for garages: VIN, normalized plate, and garage read access.
--
-- 1. Garages could not see any vehicle at all: the only vehicles policy is
--    "Clients manage their own vehicles" (auth.uid() = client_id). So the
--    client directory couldn't show plates, and a garage didn't even know
--    which car an appointment was for. New SELECT policy: a garage member
--    may read a vehicle only if it is attached to an appointment at their
--    garage -- never the platform-wide vehicle list. Clients keep sole
--    write access.
--
-- 2. vin: optional, validated as a 17-character ISO 3779 VIN (no I, O or
--    Q, stored upper-case). The check digit isn't enforced: it's only
--    mandatory for North-American VINs, not EU ones.
--
-- 3. plate_search / vin are what the directory searches. Plates are typed
--    free-form ("Lu1234", "LU-1234", "lu 1234"), so plate_search is a
--    generated, upper-cased, alphanumeric-only copy that the app compares
--    against the same normalization of the search term.
--
-- 4. appointments.vehicle_id gets the index the advisor flagged as missing
--    (it's the join column for the new policy).

alter table vehicles
  add column vin text
    check (vin is null or vin ~ '^[A-HJ-NPR-Z0-9]{17}$'),
  add column plate_search text
    generated always as (upper(regexp_replace(coalesce(license_plate, ''), '[^A-Za-z0-9]', '', 'g'))) stored;

create index vehicles_plate_search_idx on vehicles (plate_search);
create index vehicles_vin_idx on vehicles (vin) where vin is not null;
create index appointments_vehicle_id_idx on appointments (vehicle_id);

create policy "Garage members view vehicles booked with them"
  on vehicles for select
  to authenticated
  using (
    exists (
      select 1 from appointments
      where appointments.vehicle_id = vehicles.id
        and (select is_garage_member(appointments.garage_id))
    )
  );
