create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.log(p_action text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.change_log (user_id, action, detail) values ((select auth.uid()), p_action, coalesce(p_detail, ''))
$$;

create or replace function private.next_queue(p_day date, p_center text, p_project text)
returns int
language sql
security definer
set search_path = ''
as $$
  insert into public.queue_counters as q (day, center_code, project_code, last_no)
  values (p_day, p_center, p_project, 1)
  on conflict (day, center_code, project_code) do update set last_no = q.last_no + 1
  returning last_no
$$;

create or replace function private.check_projects(p_center text, p_projects text[])
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  clean text[];
begin
  select coalesce(array_agg(distinct x), '{}') into clean from unnest(p_projects) x where x is not null;
  if cardinality(clean) = 0 then
    raise exception 'اختر مشروعاً واحداً على الأقل' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from unnest(clean) x
    where not exists (
      select 1 from public.projects pr
      join public.project_centers pc on pc.project_code = pr.code and pc.center_code = p_center
      where pr.code = x and pr.active
    )
  ) then
    raise exception 'مشروع غير متاح في هذا المركز' using errcode = 'P0001';
  end if;
  return clean;
end;
$$;

create or replace function private.can_edit(e public.entries)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin()
      or (e.user_id = (select auth.uid()) and e.day = public.gaza_today() and public.my_role() in ('RECEPTION', 'POINT'))
$$;

revoke all on all functions in schema private from public, anon, authenticated;
