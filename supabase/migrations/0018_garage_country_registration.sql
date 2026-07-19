-- Multi-country business registration: a garage's country and its
-- country-specific business register number (RCS/LBR, BCE/KBO, SIRET,
-- Handelsregisternummer), distinct from the existing vat_number column.

alter table garages add column country text not null default 'LU'
  check (country in ('LU', 'BE', 'FR', 'DE'));
alter table garages add column registration_number text;
