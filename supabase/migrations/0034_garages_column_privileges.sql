-- Locks down which garages columns API callers can write.
--
-- Problem: the garages RLS policies only constrained WHICH ROW a caller
-- could touch, never which columns, and the authenticated role held table-
-- wide INSERT/UPDATE. Garage-owner accounts are self-serve, so any visitor
-- could, straight against /rest/v1/garages with the public anon key + their
-- own session:
--   - PATCH their own garage to status = 'approved' -- listing themselves
--     in client discovery with no KYC review -- or set verification_level,
--     stripe_charges_enabled/stripe_payouts_enabled/stripe_account_id,
--     next_invoice_number or deleted_at;
--   - INSERT a brand-new garage row (any role, even 'client': the policy
--     only checked owner_id = auth.uid()) already marked approved.
--
-- Fix:
--   1. No direct INSERT at all. Garages are only ever created by
--      handle_new_user() (SECURITY DEFINER, 0030); nothing in the app
--      inserts them.
--   2. UPDATE is column-scoped to the profile/settings fields an owner may
--      legitimately edit. Everything trust- or money-related (status,
--      verification_level, stripe_*, next_invoice_number, deleted_at,
--      owner_id) is writable only by the service role, i.e. server code
--      that has already authorized the caller: the super-admin review
--      actions (app/actions/documents.ts), Stripe Connect sync
--      (app/actions/stripe-connect.ts, values read from Stripe's API, never
--      from the client), the Stripe webhook and account deletion.
--   3. Once a garage is approved, its verified legal identity (country,
--      registration_number) can no longer be changed by the owner -- that's
--      what the KYC review checked. A super admin (or server code) still can.
--
-- opening_hours and sms_phone_number are intentionally NOT re-granted:
-- opening hours now come solely from the availability table (bookable
-- slots), and SMS isn't implemented.

drop policy "Owners can insert their garage" on garages;
revoke insert on garages from anon, authenticated;

revoke update on garages from anon, authenticated;
grant update (
  name,
  description,
  address,
  city,
  phone,
  email,
  website,
  country,
  registration_number,
  vat_number,
  pricing_category,
  technician_count,
  ev_capable,
  mobile_service,
  emergency_service,
  languages_spoken,
  latitude,
  longitude,
  platform_terms_accepted_at,
  notify_new_booking,
  notify_cancellation,
  notify_message
) on garages to authenticated;

create or replace function protect_verified_garage_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'approved'
     and (select auth.role()) = 'authenticated'
     and not public.is_super_admin()
     and (
       new.country is distinct from old.country
       or new.registration_number is distinct from old.registration_number
     )
  then
    raise exception 'The business country and registration number of an approved garage can only be changed by RDV support.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger garages_protect_verified_identity
  before update on garages
  for each row
  execute function protect_verified_garage_identity();
