-- Creates or updates an employee and their Account/LOB assignment atomically.
-- Only the server's service_role client may call this function.
create or replace function public.save_employee_information(
  p_employee jsonb,
  p_account_id bigint,
  p_lob_id bigint,
  p_existing_employee_id bigint
) returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  employee_record public.employees%rowtype;
  saved_id bigint;
  original_record public.employees%rowtype;
  current_assignment public.employee_assignments%rowtype;
  required_field text;
begin
  if p_employee is null or jsonb_typeof(p_employee) <> 'object' then
    raise exception 'Invalid employee information' using errcode = '22023';
  end if;

  foreach required_field in array array[
    'employee_code', 'first_name', 'last_name', 'employee_email', 'personal_email',
    'company_email', 'gender', 'tax_status_code', 'birthdate', 'contact_number', 'site', 'hire_date',
    'position_id', 'Department', 'shift_type', 'shift', 'employment_status'
  ] loop
    if nullif(btrim(p_employee ->> required_field), '') is null then
      raise exception 'Missing required employee field' using errcode = '22023';
    end if;
  end loop;
  if p_employee ->> 'levels' = 'JUNIOR LEAD'
     and nullif(btrim(p_employee ->> 'hire_date_leader'), '') is null then
    raise exception 'Leadership start date is required' using errcode = '22023';
  end if;

  employee_record := jsonb_populate_record(null::public.employees, p_employee);
  if upper(btrim(p_employee ->> 'employment_status')) not in ('ACTIVE', 'INACTIVE', 'RESIGNED', 'ON LEAVE', 'AWOL', 'LATERAL') then
    raise exception 'Invalid employment status' using errcode = '22023';
  end if;
  select s.status_id into employee_record.status_id from public.statuses s
  where upper(btrim(s.status_name)) = upper(btrim(p_employee ->> 'employment_status'))
  order by s.status_id limit 1;
  if employee_record.status_id is null then
    raise exception 'Employment status is not configured' using errcode = '22023';
  end if;
  employee_record.employee_code := upper(btrim(employee_record.employee_code));
  employee_record.first_name := upper(btrim(employee_record.first_name));
  employee_record.middle_name := nullif(upper(btrim(employee_record.middle_name)), '');
  employee_record.last_name := upper(btrim(employee_record.last_name));
  employee_record.suffix := nullif(upper(btrim(employee_record.suffix)), '');
  employee_record.employee_name := concat_ws(' ', employee_record.first_name,
    employee_record.middle_name, employee_record.last_name, employee_record.suffix);

  if not exists (select 1 from public.positions where position_id = employee_record.position_id)
     or ((p_account_id is null) <> (p_lob_id is null))
     or (p_account_id is not null and (
       not exists (select 1 from public.accounts where account_id = p_account_id and is_active)
       or not exists (select 1 from public.lobs where lob_id = p_lob_id and account_id = p_account_id)
     )) then
    raise exception 'Invalid position, account, or LOB' using errcode = '22023';
  end if;

  -- Serialize repeated submissions without changing existing employee records.
  perform pg_advisory_xact_lock(hashtextextended('employee-form-code:' || employee_record.employee_code, 0));
  perform pg_advisory_xact_lock(hashtextextended('employee-form-email:' || lower(btrim(employee_record.employee_email)), 0));
  if p_existing_employee_id is not null then
    select * into original_record from public.employees where id = p_existing_employee_id for update;
    if not found or upper(btrim(original_record.employee_code)) <> employee_record.employee_code then
      raise exception 'Employee record no longer matches the checked code' using errcode = 'P0002';
    end if;
  end if;
  if exists (
    select 1 from public.employees
    where (p_existing_employee_id is null or id <> p_existing_employee_id)
      and (upper(btrim(employee_code)) = employee_record.employee_code
        or lower(btrim(employee_email)) = lower(btrim(employee_record.employee_email)))
  ) then
    raise exception 'Employee ID or Company Gmail already registered' using errcode = '23505';
  end if;

  if p_existing_employee_id is null then
  -- Explicit column list excludes privileges, login credentials, and caller-supplied IDs.
  insert into public.employees (
    employee_code, employee_name, employee_email, hire_date, vici_link, avatar_url, status_id,
    gender, position_id, first_name, last_name, middle_name, suffix, contact_number,
    personal_email, company_email, birthdate, tax_status_code, site, address, present_address,
    present_address_same_as_home, emergency_contact_name, emergency_contact_relationship,
    emergency_contact_number, emergency_contact_address, "Department", levels,
    hire_date_leader, shift, shift_type, tu_units, sss_number, pag_ibig_number, tin, philhealth
  ) values (
    employee_record.employee_code, employee_record.employee_name, employee_record.employee_email,
    employee_record.hire_date, employee_record.vici_link, employee_record.avatar_url, employee_record.status_id,
    employee_record.gender, employee_record.position_id, employee_record.first_name,
    employee_record.last_name, employee_record.middle_name, employee_record.suffix,
    employee_record.contact_number, employee_record.personal_email, employee_record.company_email,
    employee_record.birthdate, employee_record.tax_status_code, employee_record.site, employee_record.address,
    employee_record.present_address, employee_record.present_address_same_as_home,
    employee_record.emergency_contact_name, employee_record.emergency_contact_relationship,
    employee_record.emergency_contact_number, employee_record.emergency_contact_address,
    employee_record."Department", employee_record.levels, employee_record.hire_date_leader,
    employee_record.shift, employee_record.shift_type, employee_record.tu_units,
    employee_record.sss_number, employee_record.pag_ibig_number, employee_record.tin,
    employee_record.philhealth
  ) returning id into saved_id;


    if p_account_id is not null then
      insert into public.employee_assignments (employee_id, account_id, lob_id, effective_from)
      values (saved_id, p_account_id, p_lob_id, employee_record.hire_date::timestamptz);
    end if;
  else
    saved_id := p_existing_employee_id;
    update public.employees set
      employee_name = employee_record.employee_name,
      employee_email = employee_record.employee_email,
      hire_date = employee_record.hire_date,
      status_id = employee_record.status_id,
      vici_link = employee_record.vici_link,
      gender = employee_record.gender,
      position_id = employee_record.position_id,
      first_name = employee_record.first_name,
      last_name = employee_record.last_name,
      middle_name = employee_record.middle_name,
      suffix = employee_record.suffix,
      contact_number = employee_record.contact_number,
      personal_email = employee_record.personal_email,
      company_email = employee_record.company_email,
      birthdate = employee_record.birthdate,
      tax_status_code = employee_record.tax_status_code,
      site = employee_record.site,
      address = employee_record.address,
      present_address = employee_record.present_address,
      present_address_same_as_home = employee_record.present_address_same_as_home,
      emergency_contact_name = employee_record.emergency_contact_name,
      emergency_contact_relationship = employee_record.emergency_contact_relationship,
      emergency_contact_number = employee_record.emergency_contact_number,
      emergency_contact_address = employee_record.emergency_contact_address,
      "Department" = employee_record."Department",
      levels = employee_record.levels,
      hire_date_leader = employee_record.hire_date_leader,
      shift = employee_record.shift,
      shift_type = employee_record.shift_type,
      tu_units = employee_record.tu_units,
      sss_number = employee_record.sss_number,
      pag_ibig_number = employee_record.pag_ibig_number,
      tin = employee_record.tin,
      philhealth = employee_record.philhealth,
      avatar_url = case when p_employee ? 'avatar_url' then employee_record.avatar_url else original_record.avatar_url end
    where id = saved_id;

    if p_account_id is not null then
      select * into current_assignment from public.employee_assignments
      where employee_id = saved_id
        and (effective_to is null or effective_to > now())
        and (effective_from is null or effective_from <= now())
      order by effective_from desc nulls last, assignment_id desc limit 1 for update;
      if not found or current_assignment.account_id is distinct from p_account_id
        or current_assignment.lob_id is distinct from p_lob_id then
        if current_assignment.assignment_id is not null then
          update public.employee_assignments set effective_to = now()
          where assignment_id = current_assignment.assignment_id;
        end if;
        insert into public.employee_assignments (employee_id, account_id, lob_id, role_id, effective_from)
        values (saved_id, p_account_id, p_lob_id, coalesce(current_assignment.role_id, original_record.role_id), now());
      end if;
    end if;
  end if;

  return saved_id::text;
end;
$function$;

revoke all on function public.save_employee_information(jsonb, bigint, bigint, bigint) from public, anon, authenticated;
grant execute on function public.save_employee_information(jsonb, bigint, bigint, bigint) to service_role;

-- Preserve the original three-argument create-only API for existing callers.
create or replace function public.save_employee_information(p_employee jsonb, p_account_id bigint, p_lob_id bigint)
returns text language sql security invoker set search_path = ''
as $wrapper$
  select public.save_employee_information(p_employee, p_account_id, p_lob_id, null::bigint);
$wrapper$;
revoke all on function public.save_employee_information(jsonb, bigint, bigint) from public, anon, authenticated;
grant execute on function public.save_employee_information(jsonb, bigint, bigint) to service_role;

-- Replaces the employee's current account/LOB set in the same transaction as the profile update.
create or replace function public.save_employee_information_with_assignments(
  p_employee jsonb,
  p_assignments jsonb,
  p_existing_employee_id bigint
) returns text
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  saved_id bigint;
  saved_role_id bigint;
  assignment_group jsonb;
  v_account_id bigint;
  lob_ids jsonb;
  v_lob_id bigint;
  v_account_type text;
begin
  if p_assignments is null or jsonb_typeof(p_assignments) <> 'array' then
    raise exception 'Invalid account and LOB selections' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) item
    where jsonb_typeof(item) <> 'object'
      or nullif(item ->> 'account_id', '') is null
      or upper(coalesce(item ->> 'account_type', '')) not in ('NON VOICE', 'OUTBOUND', 'INBOUND', 'INBOUND/OUTBOUND', 'VOICE', 'ADMIN', 'N/A')
      or case when jsonb_typeof(item -> 'lob_ids') = 'array'
              then jsonb_array_length(item -> 'lob_ids') = 0
              else true end
  ) then
    raise exception 'Each selected account must have at least one LOB' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_assignments) item
    group by (item ->> 'account_id') having count(*) > 1
  ) then
    raise exception 'Duplicate account selection' using errcode = '22023';
  end if;

  for assignment_group in select value from jsonb_array_elements(p_assignments)
  loop
    v_account_id := (assignment_group ->> 'account_id')::bigint;
    v_account_type := upper(assignment_group ->> 'account_type');
    lob_ids := assignment_group -> 'lob_ids';
    if v_account_id <= 0 or not exists (
      select 1 from public.accounts a where a.account_id = v_account_id
        and (a.is_active or (p_existing_employee_id is not null and exists (
          select 1 from public.employee_assignments ea where ea.employee_id = p_existing_employee_id
            and ea.account_id = a.account_id and (ea.effective_to is null or ea.effective_to > now())
            and (ea.effective_from is null or ea.effective_from <= now())
        )))
    ) then
      raise exception 'Invalid account selection' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(lob_ids) lob(value)
      group by value having count(*) > 1
    ) then
      raise exception 'Duplicate LOB selection' using errcode = '22023';
    end if;
    for v_lob_id in select value::bigint from jsonb_array_elements_text(lob_ids)
    loop
      if v_lob_id <= 0 or not exists (
        select 1 from public.lobs l where l.lob_id = v_lob_id and l.account_id = v_account_id
      ) then
        raise exception 'LOB does not belong to selected account' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select ea.role_id into saved_role_id
  from public.employee_assignments ea
  where ea.employee_id = p_existing_employee_id
    and (ea.effective_to is null or ea.effective_to > now())
    and (ea.effective_from is null or ea.effective_from <= now())
  order by ea.effective_from desc nulls last, ea.assignment_id desc
  limit 1;
  saved_id := public.save_employee_information(
    p_employee, null::bigint, null::bigint, p_existing_employee_id
  )::bigint;
  if saved_role_id is null then
    select e.role_id into saved_role_id from public.employees e where e.id = saved_id;
  end if;

  update public.employee_assignments
  set effective_to = now()
  where employee_id = saved_id
    and (effective_to is null or effective_to > now())
    and (effective_from is null or effective_from <= now());
  for assignment_group in select value from jsonb_array_elements(p_assignments)
  loop
    v_account_id := (assignment_group ->> 'account_id')::bigint;
    v_account_type := upper(assignment_group ->> 'account_type');
    for v_lob_id in select value::bigint from jsonb_array_elements_text(assignment_group -> 'lob_ids')
    loop
      insert into public.employee_assignments (employee_id, account_id, lob_id, role_id, effective_from, account_type)
      values (saved_id, v_account_id, v_lob_id, saved_role_id, now(), v_account_type);
    end loop;
  end loop;
  return saved_id::text;
end;
$function$;
revoke all on function public.save_employee_information_with_assignments(jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.save_employee_information_with_assignments(jsonb, jsonb, bigint) to service_role;
