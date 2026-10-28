-- Optional contact numbers are separate from employees.contact_number, which remains primary.
create table if not exists public.employee_phone_numbers (
  employee_id bigint not null references public.employees(id) on delete cascade,
  sort_order smallint not null check (sort_order between 1 and 5),
  label text not null check (label in ('COMPANY MOBILE', 'PERSONAL MOBILE', 'OFFICE / EXTENSION', 'OTHER')),
  phone_number text not null check (phone_number ~ '^[+0-9() .xX-]{5,40}$'),
  primary key (employee_id, sort_order)
);

alter table public.employee_phone_numbers enable row level security;
revoke all on table public.employee_phone_numbers from public, anon, authenticated;
grant select, insert, update, delete on table public.employee_phone_numbers to service_role;

-- Save extra numbers in the same transaction as the employee and account assignments.
create or replace function public.save_employee_information_with_phones(
  p_employee jsonb,
  p_assignments jsonb,
  p_existing_employee_id bigint,
  p_phone_numbers jsonb
) returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  saved_id bigint;
  phone jsonb;
  phone_order integer;
  phone_label text;
  phone_value text;
begin
  if p_phone_numbers is null or jsonb_typeof(p_phone_numbers) <> 'array' then
    raise exception 'Invalid additional contact numbers' using errcode = '22023';
  end if;
  if jsonb_array_length(p_phone_numbers) > 5 then
    raise exception 'Too many additional contact numbers' using errcode = '22023';
  end if;
  for phone in select value from jsonb_array_elements(p_phone_numbers)
  loop
    if jsonb_typeof(phone) <> 'object' then
      raise exception 'Invalid additional contact number' using errcode = '22023';
    end if;
    phone_label := upper(btrim(phone ->> 'label'));
    phone_value := btrim(phone ->> 'number');
    if phone_label is null or phone_label not in ('COMPANY MOBILE', 'PERSONAL MOBILE', 'OFFICE / EXTENSION', 'OTHER')
      or phone_value is null or phone_value !~ '^[+0-9() .xX-]{5,40}$'
      or length(regexp_replace(phone_value, '[^0-9]', '', 'g')) < 5 then
      raise exception 'Invalid additional contact number' using errcode = '22023';
    end if;
  end loop;

  saved_id := public.save_employee_information_with_assignments(
    p_employee, p_assignments, p_existing_employee_id
  )::bigint;
  delete from public.employee_phone_numbers where employee_id = saved_id;
  for phone, phone_order in
    select value, ordinality::integer from jsonb_array_elements(p_phone_numbers) with ordinality
  loop
    insert into public.employee_phone_numbers (employee_id, sort_order, label, phone_number)
    values (saved_id, phone_order, upper(btrim(phone ->> 'label')), btrim(phone ->> 'number'));
  end loop;
  return saved_id::text;
end;
$function$;

revoke all on function public.save_employee_information_with_phones(jsonb, jsonb, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.save_employee_information_with_phones(jsonb, jsonb, bigint, jsonb) to service_role;
