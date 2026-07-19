-- Real-time chat: one thread per appointment, no separate conversations
-- wrapper table -- an appointment's messages hang directly off it, the
-- same way reviews and invoices already do.

create table messages (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  sender_id uuid not null references profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_appointment_id_idx on messages (appointment_id, created_at);

alter table messages enable row level security;

create policy "Appointment participants can view messages"
  on messages for select
  using (
    exists (
      select 1 from appointments
      where appointments.id = messages.appointment_id
        and (
          appointments.client_id = auth.uid()
          or is_garage_member(appointments.garage_id)
        )
    )
  );

create policy "Appointment participants can send messages"
  on messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from appointments
      where appointments.id = messages.appointment_id
        and (
          appointments.client_id = auth.uid()
          or is_garage_member(appointments.garage_id)
        )
    )
  );

-- Required for postgres_changes realtime subscriptions to fire -- a new
-- table isn't broadcast by default, it must be added explicitly.
alter publication supabase_realtime add table messages;
