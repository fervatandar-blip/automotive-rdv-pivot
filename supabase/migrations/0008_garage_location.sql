-- Garage location for the Google Maps picker/display integration.
alter table garages add column latitude double precision
  check (latitude between -90 and 90);
alter table garages add column longitude double precision
  check (longitude between -180 and 180);
