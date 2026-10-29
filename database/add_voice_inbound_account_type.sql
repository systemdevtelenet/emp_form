-- Allow VOICE - INBOUND for existing and new account assignments.
alter table public.employee_assignments drop constraint if exists employee_assignments_account_type_check;
update public.employee_assignments set account_type = 'NON-VOICE' where account_type = 'NON VOICE';
alter table public.employee_assignments
  add constraint employee_assignments_account_type_check
  check (account_type is null or account_type in (
    'NON-VOICE', 'OUTBOUND', 'INBOUND', 'INBOUND/OUTBOUND', 'VOICE', 'VOICE - INBOUND', 'ADMIN', 'N/A'
  )) not valid;
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
      or upper(coalesce(item ->> 'account_type', '')) not in ('NON-VOICE', 'OUTBOUND', 'INBOUND', 'INBOUND/OUTBOUND', 'VOICE', 'VOICE - INBOUND', 'ADMIN', 'N/A')
      or jsonb_typeof(item -> 'lob_ids') is distinct from 'array'
  ) then
    raise exception 'Invalid account or LOB selection' using errcode = '22023';
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
    if jsonb_array_length(assignment_group -> 'lob_ids') = 0 then
      insert into public.employee_assignments (employee_id, account_id, lob_id, role_id, effective_from, account_type)
      values (saved_id, v_account_id, null, saved_role_id, now(), v_account_type);
    end if;
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
