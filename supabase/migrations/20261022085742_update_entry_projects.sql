create or replace function public.update_entry_projects(p_entry uuid, p_projects text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  v_projects text[];
  v_old text;
  v_queue jsonb := '{}'::jsonb;
begin
  select * into e from public.entries where id = p_entry;
  if not found then raise exception 'الإدخال غير موجود' using errcode = 'P0001'; end if;
  if not private.can_edit(e) then raise exception 'لا تملك صلاحية تعديل هذا الإدخال' using errcode = '42501'; end if;

  select coalesce(array_agg(distinct x), '{}') into v_projects from unnest(p_projects) x where x is not null;
  if cardinality(v_projects) = 0 then raise exception 'اختر مشروعاً واحداً على الأقل' using errcode = 'P0001'; end if;
  select string_agg(project_code, '، ') into v_old from public.entry_projects where entry_id = p_entry and status = 'active';

  if e.kind = 'RECEPTION' then
    v_queue := private.set_reception_projects(p_entry, v_projects, false);
  else
    if cardinality(v_projects) <> 1 then raise exception 'إدخال النقطة لمشروع واحد' using errcode = 'P0001'; end if;
    if not public.is_admin() and not (v_projects[1] = any (public.my_projects())) then
      raise exception 'يمكنك إدخال الخدمة في مشاريعك فقط' using errcode = '42501';
    end if;
    begin
      update public.entry_projects set project_code = v_projects[1] where entry_id = p_entry;
    exception when unique_violation then
      raise exception 'هذا المشروع مُدخل لنفس الحالة في نفس اليوم' using errcode = 'P0001';
    end;
  end if;

  perform private.log('تعديل مشاريع إدخال', e.nid || ' (' || e.day || '): ' || coalesce(v_old, '') || ' ← ' || array_to_string(v_projects, '، '));
  return jsonb_build_object('queue', v_queue);
end;
$$;

revoke execute on function
  public.update_entry_projects(uuid, text[])
from public, anon;
grant execute on function
  public.update_entry_projects(uuid, text[])
to authenticated;
