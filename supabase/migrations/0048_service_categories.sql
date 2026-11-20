-- 0048: service categories.
--
-- Services were a flat list, which gets hard to scan once a garage lists
-- more than a handful. Each service now belongs to one fixed category, used
-- to group services on the public garage page and in the garage's own
-- service manager.
--
-- The category is a stable key (like services.pricing_type in 0045); its
-- label is translated in the app dictionaries (lib/service-categories.ts),
-- so a key must never be renamed once shipped -- only added.
--
-- 0004 created a service_categories lookup table (name + parent_id) and
-- services.category_id. Neither was ever read or written by the app (the
-- table is empty, every category_id is null), and a free-text, single-
-- language name column can't serve a FR/EN UI, so both are dropped here.

alter table public.services drop column category_id;
drop table public.service_categories;

alter table public.services
  add column category text not null default 'other'
    constraint services_category_check
      check (category in (
        'maintenance', 'brakes', 'tires', 'diagnostics', 'engine',
        'electrical', 'air_conditioning', 'bodywork', 'other'
      ));

-- Best-effort backfill from the service name (EN and FR). Order matters:
-- "Brake inspection" is brakes, not maintenance. Anything unmatched stays
-- 'other' and the garage can recategorize it from /garage/services.
update public.services
set category = case
  when name ~* '(brake|frein|plaquette|disque)' then 'brakes'
  when name ~* '(tire|tyre|pneu|wheel|roue|alignment|parall[eé]lisme|g[eé]om[eé]trie)' then 'tires'
  when name ~* 'diagnos' then 'diagnostics'
  when name ~* '(air con|a/c|clim)' then 'air_conditioning'
  when name ~* '(batter|[eé]lectri|alternat|starter|d[eé]marreur)' then 'electrical'
  when name ~* '(body|carross|paint|peint|dent|bosse|windscreen|pare-brise)' then 'bodywork'
  when name ~* '(engine|moteur|clutch|embrayage|gearbox|bo[iî]te|timing|distribution|exhaust|[eé]chappement)' then 'engine'
  when name ~* '(oil|huile|vidange|entretien|service|filter|filtre|r[eé]vision|maintenance|inspection)' then 'maintenance'
  else 'other'
end;

-- No index on category: services are always fetched per garage
-- (services_provider_id_idx on garage_id) and grouped in the app; a
-- garage lists tens of services at most.
