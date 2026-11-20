-- 0049: read receipts for appointment chat, so the client portal can show
-- unread indicators (sidebar badge, inbox list).
--
-- One row per (appointment thread, reader): everything in that thread sent
-- by someone else after last_read_at is unread. No row means nothing has
-- been read yet.
--
-- Writes go only through mark_messages_read(), which stamps the server
-- clock and checks participation; a direct REST write could otherwise set
-- last_read_at in the future and hide replies that haven't arrived yet.

create table public.message_reads (
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (appointment_id, user_id)
);

create index message_reads_user_id_idx on public.message_reads (user_id);

alter table public.message_reads enable row level security;

create policy "Users can view their own read receipts"
  on public.message_reads for select
  to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.message_reads from anon, authenticated;

-- Marks the given threads read for the caller. Threads the caller isn't a
-- participant in are skipped silently (same answer as "no such thread").
create or replace function public.mark_messages_read(p_appointment_ids uuid[])
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.message_reads (appointment_id, user_id, last_read_at)
  select a.id, (select auth.uid()), now()
  from public.appointments a
  where a.id = any (p_appointment_ids)
    and (select auth.uid()) is not null
    and (
      a.client_id = (select auth.uid())
      or public.is_garage_member(a.garage_id)
    )
  on conflict (appointment_id, user_id)
  do update set last_read_at = excluded.last_read_at;
$$;

revoke execute on function public.mark_messages_read(uuid[]) from public, anon;
grant execute on function public.mark_messages_read(uuid[]) to authenticated;

-- Unread counts per thread for the signed-in client: messages in their own
-- bookings, sent by the workshop, newer than their read receipt. Security
-- invoker, so the messages/appointments RLS still applies on top.
create or replace function public.client_unread_message_counts()
returns table (appointment_id uuid, unread integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.appointment_id, count(*)::integer
  from public.appointments a
  join public.messages m on m.appointment_id = a.id
  left join public.message_reads r
    on r.appointment_id = a.id and r.user_id = (select auth.uid())
  where a.client_id = (select auth.uid())
    and m.sender_id <> (select auth.uid())
    and (r.last_read_at is null or m.created_at > r.last_read_at)
  group by m.appointment_id;
$$;

revoke execute on function public.client_unread_message_counts() from public, anon;
grant execute on function public.client_unread_message_counts() to authenticated;
