-- A second phone number for the emergency contact belongs to the employee's emergency contact details.
alter table public.employees add column if not exists emergency_contact_additional_number text;

-- Extend the existing atomic save wrapper. The legacy employee save function keeps its original signature.
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
  emergency_extra text;
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
  emergency_extra := nullif(upper(btrim(p_employee ->> 'emergency_contact_additional_number')), '');
  if emergency_extra is not null and (emergency_extra !~ '^[+0-9() .xX-]{5,40}$'
    or length(regexp_replace(emergency_extra, '[^0-9]', '', 'g')) < 5) then
    raise exception 'Invalid additional emergency contact number' using errcode = '22023';
  end if;

  saved_id := public.save_employee_information_with_assignments(
    p_employee, p_assignments, p_existing_employee_id
  )::bigint;
  update public.employees
  set emergency_contact_additional_number = emergency_extra
  where id = saved_id;
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
