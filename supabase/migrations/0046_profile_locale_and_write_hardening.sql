-- 0046: preferred language on profiles, plus two write-path fixes from the
-- 0044 review.
--
-- 1. preferred_locale: the language the user last used the app in ('fr' |
--    'en'). Emails and push notifications are written in it
--    (lib/notifications.ts). Kept in sync by the proxy
--    (lib/supabase/proxy.ts), which writes it only when it changes.
--
-- 2. INSERT on profiles. 0044 limited UPDATE to a few columns but left
--    INSERT open on every column; RLS only pinned id = auth.uid() and
--    role = 'client', so a user without a profile row could create one with
--    any email, terms_accepted_at or deleted_at. Rows are created by
--    handle_new_user() (SECURITY DEFINER, owner postgres), which is
--    unaffected, and the app never inserts profiles itself.
--
-- 3. deletion_requested_at. It has to stay user-writable (request and
--    cancel go through the user's session), but a direct REST call could
--    backdate it and have the next retention sweep delete the account
--    immediately, skipping the 30-day grace period. A trigger now stamps
--    the server clock whenever a signed-in user sets it; clearing it
--    (cancelling) is unchanged. The service role (admin tools, the sweep)
--    is not affected.

alter table public.profiles
  add column preferred_locale text not null default 'fr'
    constraint profiles_preferred_locale_check check (preferred_locale in ('fr', 'en'));

grant update (preferred_locale) on public.profiles to authenticated;

revoke insert on public.profiles from anon, authenticated;
drop policy if exists "Users can insert their own client profile" on public.profiles;

create or replace function public.stamp_deletion_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and new.deletion_requested_at is not null
     and new.deletion_requested_at is distinct from old.deletion_requested_at then
    new.deletion_requested_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.stamp_deletion_request() from public, anon, authenticated;

create trigger profiles_stamp_deletion_request
  before update of deletion_requested_at on public.profiles
  for each row execute function public.stamp_deletion_request();
