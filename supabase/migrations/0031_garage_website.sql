-- Adds a public-facing website URL to the garage business profile. The
-- garages table already covers identity (name, description,
-- registration_number, vat_number, country), contact (phone, email,
-- address, city), location (latitude/longitude), capabilities
-- (ev_capable, mobile_service, emergency_service, languages_spoken,
-- pricing_category), and verification (verification_level, status, plus
-- the garage_documents KYC table) -- website was the one field missing
-- from an otherwise already-rich, already-separate-from-profiles business
-- profile.

alter table garages add column website text
  check (website is null or website ~ '^https?://');
