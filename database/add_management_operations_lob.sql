-- Add OPERATIONS alongside MAIN under the MANAGEMENT account.
-- The account and LOB APIs read these options directly from Supabase.
do $migration$
declare
  management_account_id bigint;
  next_lob_id bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-account-options', 0));

  select account_id into management_account_id
  from public.accounts
  where upper(btrim(account_name)) = 'MANAGEMENT'
  order by account_id limit 1;

  if management_account_id is null then
    raise exception 'MANAGEMENT account is missing' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.lobs
    where account_id = management_account_id and upper(btrim(lob_name)) = 'OPERATIONS'
  ) then
    select coalesce(max(lob_id), 0) + 1 into next_lob_id from public.lobs;
    insert into public.lobs (lob_id, account_id, lob_name)
    values (next_lob_id, management_account_id, 'OPERATIONS');
  end if;
end;
$migration$;
