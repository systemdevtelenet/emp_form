-- Correct an employee code while saving the same employee profile atomically.
-- The server validates a signed lookup token before passing the original code and ID.
create or replace function public.save_employee_information_with_code_change(
  p_employee jsonb,
  p_assignments jsonb,
  p_existing_employee_id bigint,
  p_phone_numbers jsonb,
  p_original_employee_code text
) returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  old_code text;
  new_code text;
  current_code text;
begin
  old_code := nullif(upper(btrim(p_original_employee_code)), '');
  new_code := nullif(upper(btrim(p_employee ->> 'employee_code')), '');
  if p_existing_employee_id is null or old_code is null or new_code is null
    or length(old_code) > 100 or length(new_code) > 100 then
    raise exception 'Invalid employee code correction' using errcode = '22023';
  end if;

  -- Match the save function's code lock, so a simultaneous create cannot claim this code.
  perform pg_advisory_xact_lock(pg_catalog.hashtextextended('employee-form-code:' || new_code, 0));
  select employee_code into current_code
  from public.employees where id = p_existing_employee_id for update;
  if not found or upper(btrim(current_code)) <> old_code then
    raise exception 'Employee record no longer matches the checked code' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.employees
    where id <> p_existing_employee_id and upper(btrim(employee_code)) = new_code
  ) then
    raise exception 'Employee Code already registered' using errcode = '23505';
  end if;

  update public.employees set employee_code = new_code where id = p_existing_employee_id;
  -- Any validation or save error rolls the code correction back as well.
  return public.save_employee_information_with_phones(
    p_employee, p_assignments, p_existing_employee_id, p_phone_numbers
  );
end;
$function$;

revoke all on function public.save_employee_information_with_code_change(jsonb, jsonb, bigint, jsonb, text) from public, anon, authenticated;
grant execute on function public.save_employee_information_with_code_change(jsonb, jsonb, bigint, jsonb, text) to service_role;
