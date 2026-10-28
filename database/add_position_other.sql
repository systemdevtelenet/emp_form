-- Run before the employee form lookup and save functions.
alter table public.employees add column if not exists position_other text;

-- Keep approved titles in the shared position list. Re-running skips existing names.
do $positions$
begin
  perform pg_advisory_xact_lock(hashtextextended('ctnp-position-catalog', 0));
  insert into public.positions (position_id, position_name, position_code)
  with requested(position_name) as (
    values
      ('Company Nurse'),
      ('Information Security Officer'),
      ('Customer Service Representative'),
      ('Social Media Coordinator'),
      ('SEO and Content Specialist'),
      ('HR Generalist'),
      ('HR Manager'),
      ('Janitress'),
      ('Copywriter'),
      ('Creative Specialist'),
      ('Team Leader'),
      ('Data Analyst'),
      ('Workforce Management'),
      ('Web Developer'),
      ('Utility Officer'),
      ('Account Manager'),
      ('Special Operations Agent'),
      ('Graphic Artist'),
      ('Web Application'),
      ('HR/Recruitment'),
      ('Workforce'),
      ('Janitor'),
      ('Product Specific Trainer'),
      ('IT'),
      ('Corporate TL'),
      ('Work Force Monitoring'),
      ('Talent Acquisition'),
      ('Accounting Associate'),
      ('IT Support'),
      ('Data Entry'),
      ('Company Driver'),
      ('Account Operation Manager'),
      ('Client Service Delivery Manager'),
      ('RM- Process Improvement Specialist'),
      ('Operation Manager'),
      ('Training & Quality Manager'),
      ('Managers'' Assistant'),
      ('Executives Assistant'),
      ('Manager'),
      ('Admin Staff'),
      ('Chief Sales Officer'),
      ('Call Center Agent'),
      ('General Affairs Manager/Corporate Secretary'),
      ('Technician'),
      ('Other')
  ), missing as (
    select distinct r.position_name from requested r
    where not exists (
      select 1 from public.positions p
      where lower(btrim(p.position_name)) = lower(btrim(r.position_name))
    )
  ), numbered as (
    select position_name, row_number() over (order by position_name) as offset_id from missing
  )
  select (select coalesce(max(position_id), 0) from public.positions) + offset_id,
    position_name,
    btrim(regexp_replace(upper(position_name), '[^A-Z]+', ' ', 'g'))
  from numbered;
end;
$positions$;
