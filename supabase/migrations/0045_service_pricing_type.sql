-- 0045: flexible service pricing.
--
-- Repair prices depend on the vehicle, so a single mandatory list price was
-- wrong for most services. Each service now declares how it is priced:
--
--   fixed          price is the price                    "89,00 €"
--   from           price is the starting price           "From 89,00 €"
--   on_inspection  no price until the car is inspected   "Price on inspection"
--
-- price becomes nullable, and the pair is kept consistent by a check:
-- on_inspection has no price, the other two must have one. Existing rows
-- all have a price and default to 'fixed', so nothing changes for them.
--
-- Invoicing (generateInvoice, app/actions/appointments.ts) only auto-issues
-- an invoice for fixed-price services: for the other two the list price is
-- not what the client owes.

alter table public.services
  add column pricing_type text not null default 'fixed'
    constraint services_pricing_type_check
      check (pricing_type in ('fixed', 'from', 'on_inspection')),
  alter column price drop not null;

alter table public.services
  add constraint services_price_matches_pricing_type
    check ((pricing_type = 'on_inspection') = (price is null));
