-- Adds a business-size/type category to garage leads, alongside the
-- existing garage_name field (kept, not replaced).

alter table garage_leads add column garage_size_type text
  check (garage_size_type in ('independent', 'small_chain', 'franchise_dealership', 'other'));
