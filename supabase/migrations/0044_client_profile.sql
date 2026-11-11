-- 0044: client profile -- phone and notification preferences -- plus
-- column-level write privileges on profiles.
--
-- 1. phone: optional, entered by the client. Visible wherever the profile
--    row already is (self, super admins, and members of garages the client
--    has booked with -- see can_view_related_profile, 0026), which is the
--    point: the garage can call about the car. Garages' own notes phone
--    (garage_client_notes.phone, 0042) still takes precedence in garage UI.
--
-- 2. notify_repair_updates / notify_waitlist: opt-outs for the two
--    non-essential client notifications (repair-stage progress, waitlist
--    "a slot opened" alerts). Booking confirmations, cancellations and
--    reschedules are transactional and always sent.
--
-- 3. Privilege hardening. Until now `authenticated` (and `anon`) held
--    UPDATE on every profiles column; RLS only pinned the row to auth.uid()
--    and the role. A signed-in user could therefore rewrite their own
--    email (diverging from auth.users and redirecting notifications),
--    deleted_at, terms_accepted_at or created_at with a direct REST call.
--    Restrict UPDATE to the columns the app actually lets a user change.
--    Server code that needs more (role elevation in staff invites, account
--    deletion processing) already uses the service role, which is
--    unaffected.

alter table public.profiles
  add column phone text
    check (phone is null or (char_length(phone) between 6 and 40 and phone ~ '^[0-9+()./ -]+$')),
  add column notify_repair_updates boolean not null default true,
  add column notify_waitlist boolean not null default true;

revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone, notify_repair_updates, notify_waitlist, deletion_requested_at)
  on public.profiles to authenticated;

-- full_name is user-editable now; keep it a real, bounded name.
alter table public.profiles
  add constraint profiles_full_name_length
    check (char_length(btrim(full_name)) between 1 and 120) not valid;
