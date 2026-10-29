-- Add Senior Manager to the shared Position choices without duplicating it on re-run.
do $migration$
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-position-catalog', 0));

  if not exists (
    select 1 from public.positions
    where lower(btrim(position_name)) = 'senior manager'
  ) then
    insert into public.positions (position_id, position_name, position_code)
    select coalesce(max(position_id), 0) + 1, 'Senior Manager', 'SENIOR MANAGER'
    from public.positions;
  end if;
end;
$migration$;
