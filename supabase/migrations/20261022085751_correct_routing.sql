create or replace function public.correct_routing(p_reception uuid, p_projects text[], p_delete uuid[] default '{}')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  v_projects text[];
  v_current text[];
  v_queue jsonb;
begin
  if public.my_role() is distinct from 'POINT' and not public.is_admin() then
    raise exception 'تصحيح التوجيه لموظف النقطة' using errcode = '42501';
  end if;
  select * into e from public.entries where id = p_reception and kind = 'RECEPTION' for update;
  if not found or e.day <> public.gaza_today() then
    raise exception 'لا يوجد توجيه استقبال لهذه الحالة اليوم' using errcode = 'P0001';
  end if;
  if not public.is_admin() and not (e.center_code = any (public.my_centers())) then
    raise exception 'هذه الحالة في مركز آخر' using errcode = '42501';
  end if;

  v_projects := private.check_projects(e.center_code, p_projects);
  select coalesce(array_agg(project_code order by project_code), '{}') into v_current
    from public.entry_projects where entry_id = p_reception and status = 'active';

  -- حذف إدخال الخدمة الخاطئ (إدخالات المستخدم نفسه اليوم فقط)
  if coalesce(cardinality(p_delete), 0) > 0 then
    delete from public.entries
     where id = any (p_delete) and kind = 'POINT' and user_id = (select auth.uid()) and day = public.gaza_today();
  end if;

  v_queue := private.set_reception_projects(p_reception, v_projects, true);
  update public.entries
     set corrected_by = (select auth.uid()),
         corrected_at = now(),
         corrected_from = coalesce(corrected_from, v_current)
   where id = p_reception;

  perform private.log('تصحيح توجيه', e.nid || ': ' || array_to_string(v_current, '، ') || ' ← ' || array_to_string(v_projects, '، ')
    || case when coalesce(cardinality(p_delete), 0) > 0 then ' (مع حذف إدخال الخدمة الخاطئ)' else '' end);
  return jsonb_build_object('queue', v_queue);
end;
$$;

revoke execute on function
  public.correct_routing(uuid, text[], uuid[])
from public, anon;
grant execute on function
  public.correct_routing(uuid, text[], uuid[])
to authenticated;
