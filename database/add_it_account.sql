-- Add IT as a distinct account from INFORMATION TECHNOLOGY.
-- INFORMATION TECHNOLOGY already uses the internal account code IT.
do $migration$
declare
  it_account_id bigint;
  next_lob_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-account-options', 0));

  select account_id into it_account_id
  from public.accounts
  where upper(btrim(account_name)) = 'IT'
  order by account_id limit 1;

  if it_account_id is null then
    insert into public.accounts (account_id, account_code, account_name, is_active)
    select coalesce(max(account_id), 0) + 1, 'IT-ACCOUNT', 'IT', true
    from public.accounts
    returning account_id into it_account_id;
  else
    update public.accounts set is_active = true where account_id = it_account_id;
  end if;

  if not exists (
    select 1 from public.lobs
    where account_id = it_account_id and upper(btrim(lob_name)) = 'MAIN'
  ) then
    select coalesce(max(lob_id), 0) + 1 into next_lob_id from public.lobs;
    insert into public.lobs (lob_id, account_id, lob_name)
    values (next_lob_id, it_account_id, 'MAIN');
  end if;
end;
$migration$;
