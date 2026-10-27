-- Add present address, emergency contact, and per-account assignment type fields.
alter table public.employees
  add column if not exists present_address text,
  add column if not exists present_address_same_as_home boolean not null default false,
  add column if not exists emergency_contact_name text,
  add column if not exists emergency_contact_relationship text,
  add column if not exists emergency_contact_number text,
  add column if not exists emergency_contact_address text;

alter table public.employee_assignments add column if not exists account_type text;
alter table public.employee_assignments drop constraint if exists employee_assignments_account_type_check;
alter table public.employee_assignments
  add constraint employee_assignments_account_type_check
  check (account_type is null or account_type in (
    'NON VOICE', 'OUTBOUND', 'INBOUND', 'INBOUND/OUTBOUND', 'VOICE', 'ADMIN', 'N/A'
  )) not valid;
