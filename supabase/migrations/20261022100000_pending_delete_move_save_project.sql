-- بانتظار الموافقة على التطبيق في Supabase

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

revoke execute on function
  public.delete_entry(uuid),
  public.move_entry(uuid, text),
  public.save_project(text, text, boolean, text[], text)
from public, anon;
grant execute on function
  public.delete_entry(uuid),
  public.move_entry(uuid, text),
  public.save_project(text, text, boolean, text[], text)
to authenticated;
