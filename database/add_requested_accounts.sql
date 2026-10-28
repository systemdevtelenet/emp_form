-- Add the requested account choices once. Each gets a MAIN LOB because the form requires a LOB.
do $migration$
declare
  requested record;
  selected_account_id bigint;
  next_account_id bigint;
  next_lob_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-account-options', 0));
  for requested in
    select * from (values
      ('SALES', 'SALES'),
      ('ADMIN', 'ADMIN'),
      ('NETSTAR', 'NETSTAR'),
      ('INFORMATION TECHNOLOGY', 'IT'),
      ('MANAGEMENT', 'MGMT'),
      ('COSMETICS', 'COSMETICS'),
      ('TELENET KIDS', 'TELENETKIDS'),
      ('TRANSPO3/RESERVATIONS', 'TRANSPO3'),
      ('MARKETING', 'MARKETING'),
      ('HUMAN RESOURCES', 'HR')
    ) as choices(account_name, account_code)
  loop
    select a.account_id into selected_account_id
    from public.accounts a
    where upper(btrim(a.account_name)) = requested.account_name
    order by a.account_id limit 1;
    if selected_account_id is null then
      select coalesce(max(account_id), 0) + 1 into next_account_id from public.accounts;
      insert into public.accounts (account_id, account_code, account_name, is_active)
      values (next_account_id, requested.account_code, requested.account_name, true);
      selected_account_id := next_account_id;
    end if;
    if not exists (select 1 from public.lobs where account_id = selected_account_id) then
      select coalesce(max(lob_id), 0) + 1 into next_lob_id from public.lobs;
      insert into public.lobs (lob_id, account_id, lob_name)
      values (next_lob_id, selected_account_id, 'MAIN');
    end if;
  end loop;
end;
$migration$;
