-- =====================================================================
-- دوال الإدخال ورقم الدور — كل الكتابة تمر من هنا
-- الدوال الداخلية في مخطط private غير مكشوف للـ API
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ===== سجل التغييرات =====
create or replace function private.log(p_action text, p_detail text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.change_log (user_id, action, detail) values ((select auth.uid()), p_action, coalesce(p_detail, ''))
$$;

-- ===== الرقم التالي في دور مشروع (ذري: لا يتكرر مع الإدخال المتزامن) =====
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

-- ===== ضبط مشاريع إدخال الاستقبال مع أرقام الدور =====
-- المشروع الباقي يحتفظ برقمه، والمضاف يأخذ الرقم التالي، والمحذوف يُحذف
-- (أو يُعلَّم "حُوّلت" عند تصحيح التوجيه). الرقم الملغى لا يُعاد استخدامه.
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

-- ===== التحقق من المشاريع لمركز =====
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

-- ===== هل يحق للمستخدم تعديل الإدخال؟ صاحبه في نفس اليوم، أو الأدمن =====
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

-- =====================================================================
-- الدوال العامة (RPC)
-- =====================================================================

-- ===== إدخال حالة: الاستقبال يحوّل ويأخذ أرقام دور، والنقطة تسجّل الخدمة =====
create or replace function public.add_entry(
  p_nid text,
  p_center text,
  p_projects text[],
  p_name text default null,
  p_type text default null,
  p_queue_ref uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text := public.my_role();
  v_day date := public.gaza_today();
  v_projects text[];
  v_is_new boolean := false;
  v_entry uuid;
  v_queue jsonb := '{}'::jsonb;
  v_done text[];
  v_skipped text[] := '{}';
  v_ids uuid[] := '{}';
  p text;
  i int := 0;
begin
  if v_role is null or v_role not in ('RECEPTION', 'POINT') then
    raise exception 'هذا الحساب لا يملك صلاحية الإدخال' using errcode = '42501';
  end if;
  if not (p_center = any (public.my_centers())) then
    raise exception 'حسابك غير مسموح له بالعمل في هذا المركز' using errcode = '42501';
  end if;
  if p_nid is null or p_nid !~ '^[0-9]{9}$' then
    raise exception 'رقم الهوية يجب أن يكون 9 أرقام' using errcode = 'P0001';
  end if;

  v_projects := private.check_projects(p_center, p_projects);
  if v_role = 'POINT' and exists (select 1 from unnest(v_projects) x where not (x = any (public.my_projects()))) then
    raise exception 'يمكنك إدخال الخدمة في مشاريعك فقط' using errcode = '42501';
  end if;

  -- المستفيد: الاسم ونوع الهوية مطلوبان للحالة الجديدة
  if not exists (select 1 from public.beneficiaries where nid = p_nid) then
    if coalesce(trim(p_name), '') = '' then
      raise exception 'اكتب اسم المستفيد — الاسم الأول يكفي' using errcode = 'P0001';
    end if;
    if p_type is null or p_type not in ('FATHER', 'MOTHER', 'CHILD') then
      raise exception 'اختر نوع الهوية: أب أو أم أو طفل' using errcode = 'P0001';
    end if;
    insert into public.beneficiaries (nid, name, id_type, created_by)
    values (p_nid, regexp_replace(trim(p_name), '\s+', ' ', 'g'), p_type, v_uid)
    on conflict (nid) do nothing;
    v_is_new := found;
  end if;

  -- ===== الاستقبال =====
  if v_role = 'RECEPTION' then
    select id into v_entry from public.entries
     where kind = 'RECEPTION' and nid = p_nid and center_code = p_center and day = v_day
     for update;
    if v_entry is not null then
      v_queue := private.set_reception_projects(v_entry, v_projects, false);
      perform private.log('تحديث إدخال اليوم', p_nid || ': ' || array_to_string(v_projects, '، '));
      return jsonb_build_object('mode', 'updated', 'entry_id', v_entry, 'is_new', false, 'queue', v_queue, 'skipped', '[]'::jsonb);
    end if;

    begin
      insert into public.entries (nid, center_code, user_id, kind, day, is_new)
      values (p_nid, p_center, v_uid, 'RECEPTION', v_day, v_is_new)
      returning id into v_entry;
    exception when unique_violation then
      raise exception 'هذه الحالة أُدخلت للتو من جهاز آخر. أعد إدخال رقم الهوية' using errcode = 'P0001';
    end;
    v_queue := private.set_reception_projects(v_entry, v_projects, false);
    return jsonb_build_object('mode', 'created', 'entry_id', v_entry, 'is_new', v_is_new, 'queue', v_queue, 'skipped', '[]'::jsonb);
  end if;

  -- ===== النقطة: إدخال لكل مشروع =====
  if p_queue_ref is not null and not exists (
    select 1 from public.entries
     where id = p_queue_ref and kind = 'RECEPTION' and day = v_day and center_code = p_center
  ) then
    p_queue_ref := null;
  end if;

  select coalesce(array_agg(project_code), '{}') into v_done
    from public.entry_projects
   where nid = p_nid and day = v_day and kind = 'POINT' and status = 'active';

  foreach p in array v_projects loop
    if p = any (v_done) then
      v_skipped := v_skipped || p;
      continue;
    end if;
    i := i + 1;
    insert into public.entries (nid, center_code, user_id, kind, day, is_new, queue_ref)
    values (p_nid, p_center, v_uid, 'POINT', v_day, v_is_new and i = 1, p_queue_ref)
    returning id into v_entry;
    insert into public.entry_projects (entry_id, project_code, nid, kind, center_code, day)
    values (v_entry, p, p_nid, 'POINT', p_center, v_day);
    v_ids := v_ids || v_entry;
  end loop;

  if cardinality(v_ids) = 0 then
    raise exception 'هذه الحالة أُدخلت اليوم في هذا المشروع مسبقاً' using errcode = 'P0001';
  end if;

  return jsonb_build_object('mode', 'created', 'entry_id', v_ids[1], 'is_new', v_is_new, 'queue', '{}'::jsonb, 'skipped', to_jsonb(v_skipped));
exception
  when unique_violation then
    raise exception 'هذه الحالة أُدخلت اليوم في هذا المشروع مسبقاً' using errcode = 'P0001';
end;
$$;

-- ===== تعديل مشاريع إدخال =====
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

-- ===== تصحيح التوجيه من نقطة المشروع =====
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

-- ===== حذف إدخال =====
create or replace function public.delete_entry(p_entry uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  v_projects text;
begin
  select * into e from public.entries where id = p_entry;
  if not found then return; end if;
  if not private.can_edit(e) then raise exception 'لا تملك صلاحية حذف هذا الإدخال' using errcode = '42501'; end if;
  select string_agg(project_code, '، ') into v_projects from public.entry_projects where entry_id = p_entry;
  delete from public.entries where id = p_entry;
  -- مستفيد بلا أي إدخال يُحذف (أُدخل بالخطأ)
  delete from public.beneficiaries b where b.nid = e.nid and not exists (select 1 from public.entries x where x.nid = e.nid);
  perform private.log('حذف إدخال', e.nid || ' (' || e.day || ') ' || coalesce(v_projects, ''));
end;
$$;

-- ===== تصحيح رقم الهوية لإدخال =====
create or replace function public.move_entry(p_entry uuid, p_new_nid text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.entries;
  b public.beneficiaries;
begin
  select * into e from public.entries where id = p_entry;
  if not found then raise exception 'الإدخال غير موجود' using errcode = 'P0001'; end if;
  if not private.can_edit(e) then raise exception 'لا تملك صلاحية تعديل هذا الإدخال' using errcode = '42501'; end if;
  if p_new_nid is null or p_new_nid !~ '^[0-9]{9}$' then raise exception 'رقم الهوية يجب أن يكون 9 أرقام' using errcode = 'P0001'; end if;
  if p_new_nid = e.nid then raise exception 'الرقم الجديد مطابق للحالي' using errcode = 'P0001'; end if;

  if e.kind = 'RECEPTION' and exists (
    select 1 from public.entries where kind = 'RECEPTION' and nid = p_new_nid and center_code = e.center_code and day = e.day
  ) then
    raise exception 'الرقم الصحيح له إدخال استقبال اليوم في نفس المركز. عدّل ذلك الإدخال بدلاً من النقل' using errcode = 'P0001';
  end if;
  if e.kind = 'POINT' and exists (
    select 1 from public.entry_projects a
    join public.entry_projects bb on bb.project_code = a.project_code
    where a.entry_id = p_entry and bb.nid = p_new_nid and bb.day = e.day and bb.kind = 'POINT' and bb.status = 'active'
  ) then
    raise exception 'الرقم الصحيح مُدخل اليوم في نفس المشروع' using errcode = 'P0001';
  end if;

  select * into b from public.beneficiaries where nid = e.nid;
  insert into public.beneficiaries (nid, name, id_type, created_at, created_by)
  values (p_new_nid, b.name, b.id_type, e.at, (select auth.uid()))
  on conflict (nid) do nothing;

  update public.entries set nid = p_new_nid where id = p_entry;
  update public.entry_projects set nid = p_new_nid where entry_id = p_entry;
  delete from public.beneficiaries x where x.nid = e.nid and not exists (select 1 from public.entries y where y.nid = e.nid);
  perform private.log('تصحيح رقم هوية', e.nid || ' ← ' || p_new_nid || ' (' || e.day || ')');
end;
$$;

-- ===== تعديل الاسم ونوع الهوية =====
create or replace function public.update_beneficiary(p_nid text, p_name text, p_type text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  b public.beneficiaries;
  v_name text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if public.my_role() is null then raise exception 'غير مسموح' using errcode = '42501'; end if;
  if v_name = '' then raise exception 'اكتب الاسم — الاسم الأول يكفي' using errcode = 'P0001'; end if;
  if p_type is not null and p_type not in ('FATHER', 'MOTHER', 'CHILD') then raise exception 'نوع الهوية غير صحيح' using errcode = 'P0001'; end if;
  select * into b from public.beneficiaries where nid = p_nid for update;
  if not found then raise exception 'رقم الهوية غير مسجل' using errcode = 'P0001'; end if;
  update public.beneficiaries set name = v_name, id_type = coalesce(p_type, id_type) where nid = p_nid;
  perform private.log('تعديل بيانات هوية', p_nid || ': "' || b.name || '" ← "' || v_name || '"'
    || case when p_type is not null and p_type is distinct from b.id_type then ' (تغيير النوع)' else '' end);
end;
$$;

-- =====================================================================
-- إدارة المشاريع والمراكز والإعدادات
-- =====================================================================

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
  if not public.is_back_office() then raise exception 'غير مسموح' using errcode = '42501'; end if;
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

create or replace function public.reorder_projects(p_codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_back_office() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  update public.projects p set sort_order = x.ord
    from unnest(p_codes) with ordinality as x(code, ord)
   where p.code = x.code;
end;
$$;

create or replace function public.rename_center(p_code text, p_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_back_office() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'اكتب اسم المركز' using errcode = 'P0001'; end if;
  update public.centers set name = trim(p_name) where code = p_code;
  perform private.log('تعديل مركز', trim(p_name));
end;
$$;

create or replace function public.save_settings(p_hint_reception text, p_hint_point text, p_idle_minutes int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'غير مسموح' using errcode = '42501'; end if;
  update public.settings
     set hint_reception = coalesce(p_hint_reception, ''),
         hint_point = coalesce(p_hint_point, ''),
         idle_minutes = p_idle_minutes,
         updated_at = now()
   where id = 1;
  perform private.log('تعديل الإعدادات', '');
end;
$$;

-- ===== الصلاحيات على الدوال العامة =====
revoke execute on function
  public.add_entry(text, text, text[], text, text, uuid),
  public.update_entry_projects(uuid, text[]),
  public.correct_routing(uuid, text[], uuid[]),
  public.delete_entry(uuid),
  public.move_entry(uuid, text),
  public.update_beneficiary(text, text, text),
  public.save_project(text, text, boolean, text[], text),
  public.reorder_projects(text[]),
  public.rename_center(text, text),
  public.save_settings(text, text, int)
from public, anon;

grant execute on function
  public.add_entry(text, text, text[], text, text, uuid),
  public.update_entry_projects(uuid, text[]),
  public.correct_routing(uuid, text[], uuid[]),
  public.delete_entry(uuid),
  public.move_entry(uuid, text),
  public.update_beneficiary(text, text, text),
  public.save_project(text, text, boolean, text[], text),
  public.reorder_projects(text[]),
  public.rename_center(text, text),
  public.save_settings(text, text, int)
to authenticated;
