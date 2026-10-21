-- Garage-side notification preferences, applied uniformly across whichever
-- channels are active for a garage: email today, and push (still gated
-- separately by its own device-token opt-in) -- these three are a
-- content-level filter on top of that, not a channel switch.
-- sms_phone_number is reserved for a future SMS integration; no send logic
-- against it yet.
alter table garages add column notify_new_booking boolean not null default true;
alter table garages add column notify_cancellation boolean not null default true;
alter table garages add column notify_message boolean not null default true;
alter table garages add column sms_phone_number text;
