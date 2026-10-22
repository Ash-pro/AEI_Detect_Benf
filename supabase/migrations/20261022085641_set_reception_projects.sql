create or replace function private.set_reception_projects(p_entry uuid, p_projects text[], p_moved boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  p text;
  result jsonb := '{}'::jsonb;
begin
  select * into e from public.entries where id = p_entry for update;

  -- المحذوف
  if p_moved then
    update public.entry_projects
       set status = 'moved'
     where entry_id = p_entry and status = 'active' and not (project_code = any (p_projects));
  else
    delete from public.entry_projects
     where entry_id = p_entry and status = 'active' and not (project_code = any (p_projects));
  end if;

  -- المضاف (وإن كان سابقاً "حُوّلت" يأخذ رقماً جديداً)
  foreach p in array p_projects loop
    if not exists (select 1 from public.entry_projects where entry_id = p_entry and project_code = p and status = 'active') then
      delete from public.entry_projects where entry_id = p_entry and project_code = p;
      insert into public.entry_projects (entry_id, project_code, nid, kind, center_code, day, queue_no, status)
      values (p_entry, p, e.nid, 'RECEPTION', e.center_code, e.day, private.next_queue(e.day, e.center_code, p), 'active');
    end if;
  end loop;

  select coalesce(jsonb_object_agg(project_code, queue_no), '{}'::jsonb) into result
    from public.entry_projects where entry_id = p_entry and status = 'active';
  return result;
end;
$$;

revoke all on function private.set_reception_projects(uuid, text[], boolean) from public, anon, authenticated;
