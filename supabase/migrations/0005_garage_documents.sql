-- Garage verification document pipeline: private storage bucket + a row per
-- uploaded document, reviewed by a super_admin.

insert into storage.buckets (id, name, public)
values ('garage-documents', 'garage-documents', false)
on conflict (id) do nothing;

create table garage_documents (
  id uuid primary key default gen_random_uuid(),
  garage_id uuid not null references garages (id) on delete cascade,
  category text not null check (category in (
    'business_legal', 'operational', 'insurance', 'technical', 'banking', 'premium'
  )),
  document_type text not null check (document_type in (
    -- business_legal
    'company_registration', 'business_authorization', 'vat_certificate',
    'articles_of_incorporation', 'proof_of_address', 'owner_id_document',
    -- operational
    'exterior_photos', 'interior_photos', 'reception_photos', 'logo_branding',
    -- insurance
    'liability_insurance', 'workshop_insurance', 'employee_liability_coverage',
    'environmental_compliance', 'health_safety_compliance',
    -- technical
    'technician_certifications', 'ev_certifications', 'manufacturer_accreditations',
    'diagnostic_equipment_proof', 'obd_compatibility_proof', 'battery_servicing_proof',
    'paint_booth_insurance',
    -- banking
    'iban_certificate',
    -- premium ("Trusted Garage")
    'years_in_operation_proof', 'customer_references', 'manufacturer_partnerships',
    'fleet_servicing_references', 'iso_certifications', 'ev_specialization_proof',
    'warranty_provider_partnerships'
  )),
  file_path text not null,
  file_name text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles (id),
  reviewed_at timestamptz,
  notes text,
  uploaded_at timestamptz not null default now(),
  unique (garage_id, document_type)
);

create index garage_documents_garage_id_idx on garage_documents (garage_id);

alter table garage_documents enable row level security;

create policy "Garage members and super admins can view documents"
  on garage_documents for select
  using (is_garage_member(garage_id) or is_super_admin());

create policy "Garage members can upload documents"
  on garage_documents for insert
  with check (is_garage_member(garage_id));

create policy "Garage members can replace their documents"
  on garage_documents for delete
  using (is_garage_member(garage_id));

create policy "Super admins can review documents"
  on garage_documents for update
  using (is_super_admin())
  with check (is_super_admin());

-- Storage: objects are keyed "${garage_id}/${category}/${document_type}-...",
-- so the garage_id is the first path segment. RLS is already enabled on
-- storage.objects by default in Supabase projects (and the SQL editor's
-- role doesn't own that table, so re-enabling it here would fail) — only
-- the policies need creating.
create policy "Garage members can upload their documents"
  on storage.objects for insert
  with check (
    bucket_id = 'garage-documents'
    and is_garage_member((storage.foldername(name))[1]::uuid)
  );

create policy "Garage members and super admins can view documents"
  on storage.objects for select
  using (
    bucket_id = 'garage-documents'
    and (is_garage_member((storage.foldername(name))[1]::uuid) or is_super_admin())
  );

create policy "Garage members can delete their documents"
  on storage.objects for delete
  using (
    bucket_id = 'garage-documents'
    and is_garage_member((storage.foldername(name))[1]::uuid)
  );
