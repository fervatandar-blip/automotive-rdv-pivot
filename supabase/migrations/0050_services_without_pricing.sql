-- 0050: services carry no price.
--
-- RDV no longer shows or collects service prices: clients book a service
-- and its duration, the workshop quotes on site (pay-on-site pilot, 0040).
-- The app stops reading and writing services.price / pricing_type, and
-- automatic invoicing from the list price (0045) is gone with them.
--
-- Non-destructive on purpose: the columns and existing values stay (old
-- invoices keep their own stored amount in invoices.amount), only the
-- rule that forced a price onto 'fixed' / 'from' rows is dropped, and new
-- rows default to 'on_inspection' with no price, so a service inserted
-- without either column is consistent.
--
-- Safe to apply before the code that stops sending these columns: the
-- currently deployed code always sends both explicitly.

alter table public.services
  drop constraint if exists services_price_matches_pricing_type;

alter table public.services
  alter column pricing_type set default 'on_inspection';

comment on column public.services.price is
  'Unused since 0050 (services carry no price). Kept for history; do not read.';
comment on column public.services.pricing_type is
  'Unused since 0050 (services carry no price). Kept for history; do not read.';
