-- 0047: drop garage brands & specialties.
--
-- Garages no longer declare the makes they service or their specialties:
-- the profile editor (19a436e), garage search filters (47414f7) and the
-- onboarding wizard / public garage page (12c289d) all stopped using them.
-- Apply only once that code is deployed -- earlier builds still read these
-- tables.
--
-- public.brands stays: vehicles.brand_id, garage_customer vehicles and the
-- add-client / walk-in forms use it. Nothing else references the dropped
-- tables (no views, functions, triggers or publications at time of
-- writing); specialties is only referenced by garage_specialties.
--
-- Destructive: the existing links (and the specialties lookup seeded in
-- 0006) are deleted for good.

drop table public.garage_specialties;
drop table public.garage_brands;
drop table public.specialties;
