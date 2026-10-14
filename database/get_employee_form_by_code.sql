-- Returns only form fields, excluding passwords and access roles.
create or replace function public.get_employee_form_by_code(p_employee_code text)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  e public.employees%rowtype;
  assignment public.employee_assignments%rowtype;
  code text := upper(btrim(p_employee_code));
begin
  if code is null or code = '' or length(code) > 100 then
    raise exception 'Employee Code is required' using errcode = '22023';
  end if;
  if (select count(*) from public.employees where upper(btrim(employee_code)) = code) > 1 then
    raise exception 'Employee Code is ambiguous' using errcode = '21000';
  end if;
  select * into e from public.employees where upper(btrim(employee_code)) = code;
  if not found then return null; end if;
  select * into assignment from public.employee_assignments
  where employee_id = e.id and (effective_to is null or effective_to > now())
    and (effective_from is null or effective_from <= now())
  order by effective_from desc nulls last, assignment_id desc limit 1;

  return jsonb_build_object(
    'employeeId', e.id::text,
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('account_id', grouped.account_id::text, 'account_label', grouped.account_name, 'lob_ids', grouped.lob_ids, 'lob_options', grouped.lob_options) order by grouped.account_id)
      from (
        select ea.account_id, a.account_name as account_name,
          jsonb_agg(ea.lob_id::text order by ea.lob_id) as lob_ids,
          jsonb_agg(jsonb_build_object('value', ea.lob_id::text, 'label', l.lob_name) order by ea.lob_id) as lob_options
        from public.employee_assignments ea
        left join public.accounts a on a.account_id = ea.account_id
        left join public.lobs l on l.lob_id = ea.lob_id
        where ea.employee_id = e.id
          and (ea.effective_to is null or ea.effective_to > now())
          and (ea.effective_from is null or ea.effective_from <= now())
          and ea.account_id is not null and ea.lob_id is not null
        group by ea.account_id, a.account_name
      ) grouped
    ), '[]'::jsonb),
    'values', jsonb_build_object(
      'employee_code', e.employee_code,
      'employee_name', e.employee_name,
      'employee_email', e.employee_email,
      'hire_date', e.hire_date,
      'vici_link', e.vici_link,
      'avatar_url', e.avatar_url,
      'gender', e.gender,
      'position_id', e.position_id,
      'first_name', e.first_name,
      'last_name', e.last_name,
      'middle_name', e.middle_name,
      'suffix', e.suffix,
      'contact_number', e.contact_number,
      'personal_email', e.personal_email,
      'company_email', e.company_email,
      'birthdate', e.birthdate,
      'site', e.site,
      'address', e.address,
      'Department', e."Department",
      'levels', e.levels,
      'hire_date_leader', e.hire_date_leader,
      'shift', e.shift,
      'shift_type', e.shift_type,
      'tu_units', e.tu_units,
      'sss_number', e.sss_number,
      'pag_ibig_number', e.pag_ibig_number,
      'tin', e.tin,
      'philhealth', e.philhealth,
      'account_id', assignment.account_id::text,
      'lob_id', assignment.lob_id::text
    ),
    'options', jsonb_strip_nulls(jsonb_build_object(
      'position_id', (select jsonb_build_object('value', position_id::text, 'label', position_name) from public.positions where position_id=e.position_id),
      'account_id', (select jsonb_build_object('value', account_id::text, 'label', account_name) from public.accounts where account_id=assignment.account_id),
      'lob_id', (select jsonb_build_object('value', lob_id::text, 'label', lob_name) from public.lobs where lob_id=assignment.lob_id)
    ))
  );
end;
$function$;
revoke all on function public.get_employee_form_by_code(text) from public, anon, authenticated;
grant execute on function public.get_employee_form_by_code(text) to service_role;
