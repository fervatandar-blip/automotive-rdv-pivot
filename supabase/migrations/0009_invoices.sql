-- PDF invoicing: one invoice generated per completed appointment.

alter table garages add column vat_number text;
alter table garages add column next_invoice_number integer not null default 1;

-- Atomically claims the next per-garage invoice number so concurrent
-- completions never collide (single UPDATE...RETURNING, no read-then-write).
create or replace function increment_invoice_number(target_garage_id uuid)
returns integer
language plpgsql
security definer
as $$
declare
  claimed_number integer;
begin
  update garages
  set next_invoice_number = next_invoice_number + 1
  where id = target_garage_id
  returning next_invoice_number - 1 into claimed_number;

  return claimed_number;
end;
$$;

grant execute on function increment_invoice_number(uuid) to authenticated;

insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create table invoices (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete cascade,
  garage_id uuid not null references garages (id) on delete cascade,
  client_id uuid not null references profiles (id) on delete cascade,
  invoice_number text not null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'EUR',
  file_path text not null,
  issued_at timestamptz not null default now(),
  unique (garage_id, invoice_number)
);

create index invoices_garage_id_idx on invoices (garage_id);
create index invoices_client_id_idx on invoices (client_id);

alter table invoices enable row level security;

create policy "Invoice recipients can view their invoices"
  on invoices for select
  using (
    client_id = auth.uid()
    or is_garage_member(garage_id)
    or is_super_admin()
  );

create policy "Garage members can create invoices for their garage"
  on invoices for insert
  with check (is_garage_member(garage_id));

-- Storage: objects are keyed "${garage_id}/${appointment_id}.pdf". RLS is
-- already enabled by default on storage.objects (see 0005's note), so only
-- policies need creating here.
create policy "Garage members can upload invoice files"
  on storage.objects for insert
  with check (
    bucket_id = 'invoices'
    and is_garage_member((storage.foldername(name))[1]::uuid)
  );

create policy "Invoice recipients can view invoice files"
  on storage.objects for select
  using (
    bucket_id = 'invoices'
    and exists (
      select 1 from invoices
      where invoices.file_path = storage.objects.name
        and (
          invoices.client_id = auth.uid()
          or is_garage_member(invoices.garage_id)
          or is_super_admin()
        )
    )
  );
