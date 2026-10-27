alter table public.employees
  add column if not exists tax_status_code text;

alter table public.employees
  drop constraint if exists employees_tax_status_code_check;

alter table public.employees
  add constraint employees_tax_status_code_check
  check (
    tax_status_code is not null
    and tax_status_code = any (array[
      'SINGLE',
      'MARRIED',
      'WIDOWED',
      'LEGALLY SEPARATED',
      'DIVORCED',
      'ANNULLED'
    ]::text[])
  ) not valid;