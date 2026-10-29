-- Add TRANSPO as a separate account from TRANSPO3/RESERVATIONS.
-- A MAIN LOB is needed because every selected account requires at least one LOB.
do $migration$
declare
  transpo_account_id bigint;
  next_lob_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-account-options', 0));

  select account_id into transpo_account_id
  from public.accounts
  where upper(btrim(account_name)) = 'TRANSPO'
  order by account_id limit 1;

  if transpo_account_id is null then
    insert into public.accounts (account_id, account_code, account_name, is_active)
    select coalesce(max(account_id), 0) + 1, 'TRANSPO', 'TRANSPO', true
    from public.accounts
    returning account_id into transpo_account_id;
  else
    update public.accounts set is_active = true where account_id = transpo_account_id;
  end if;

  if not exists (
    select 1 from public.lobs
    where account_id = transpo_account_id and upper(btrim(lob_name)) = 'MAIN'
  ) then
    select coalesce(max(lob_id), 0) + 1 into next_lob_id from public.lobs;
    insert into public.lobs (lob_id, account_id, lob_name)
    values (next_lob_id, transpo_account_id, 'MAIN');
  end if;
end;
$migration$;
