-- حراسة حفظ المشاريع وتعديل مشاريع الإدخال بصلاحيات المشرف

create or replace function public.save_project(
  p_code text,
  p_name text,
  p_active boolean,
  p_centers text[],
  p_color text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
begin
  if not public.has_perm('projects') then raise exception 'لا تملك صلاحية إدارة المشاريع' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'اكتب اسم المشروع' using errcode = 'P0001'; end if;
  select exists (select 1 from public.projects where code = p_code) into v_exists;
  if v_exists then
    update public.projects set name = trim(p_name), active = p_active, color = coalesce(p_color, color) where code = p_code;
  else
    if p_code !~ '^[A-Z0-9_]{2,12}$' then raise exception 'الرمز من 2 إلى 12 حرفاً إنجليزياً كبيراً أو أرقام' using errcode = 'P0001'; end if;
    insert into public.projects (code, name, active, sort_order, color)
    values (p_code, trim(p_name), coalesce(p_active, true), (select coalesce(max(sort_order), 0) + 1 from public.projects), p_color);
  end if;
  delete from public.project_centers where project_code = p_code and not (center_code = any (coalesce(p_centers, '{}')));
  insert into public.project_centers (project_code, center_code)
  select p_code, c from unnest(coalesce(p_centers, '{}')) c on conflict do nothing;
  perform private.log(case when v_exists then 'تعديل مشروع' else 'إضافة مشروع' end, trim(p_name));
end;
$$;

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
    if not public.has_perm('edit_entries') and not (v_projects[1] = any (public.my_projects())) then
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
