-- حالات حضرت ولم تُخدم (غادرت قبل الخدمة)
-- إضافة فقط: عمودان جديدان على entry_projects + دالتان. لا تغيير على أي بيانات أو دوال موجودة.
--
-- الترحيل اليدوي: موظف النقطة بعد الساعة 2:20 ظهراً (بتوقيت غزة) يرحّل المنتظرين في مشاريعه.
-- الترحيل التلقائي بعد الساعة 4:00 عصراً يُحسب في الواجهة (أي دور لم يُخدم بعد 4:00 أو في يوم سابق)،
-- لذلك لا يحتاج أي مهمة مجدولة في قاعدة البيانات.

alter table public.entry_projects
  add column if not exists left_at timestamptz,
  add column if not exists left_by uuid;

comment on column public.entry_projects.left_at is 'وقت ترحيل الدور إلى "حضرت ولم تُخدم" يدوياً من نقطة المشروع';
comment on column public.entry_projects.left_by is 'الموظف الذي رحّل الدور';

-- ترحيل كل المنتظرين اليوم في مشاريع الموظف بهذا المركز
create or replace function public.mark_left(p_center text, p_projects text[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if public.my_role() is distinct from 'POINT' then
    raise exception 'الترحيل من نقاط المشاريع فقط' using errcode = '42501';
  end if;
  if not (p_center = any (public.my_centers())) then
    raise exception 'حسابك غير مسموح له بالعمل في هذا المركز' using errcode = '42501';
  end if;
  if p_projects is null or cardinality(p_projects) = 0
     or exists (select 1 from unnest(p_projects) x where not (x = any (public.my_projects()))) then
    raise exception 'لا يمكنك الترحيل إلا في مشاريعك' using errcode = '42501';
  end if;
  if (now() at time zone 'Asia/Gaza')::time < time '14:20' then
    raise exception 'الترحيل متاح بعد الساعة 2:20 ظهراً' using errcode = 'P0001';
  end if;

  update public.entry_projects ep
     set left_at = now(), left_by = v_uid
   where ep.kind = 'RECEPTION'
     and ep.status = 'active'
     and ep.day = public.gaza_today()
     and ep.center_code = p_center
     and ep.project_code = any (p_projects)
     and ep.queue_no is not null
     and ep.left_at is null
     and not exists (
       select 1
         from public.entries s
         join public.entry_projects sp on sp.entry_id = s.id
        where s.kind = 'POINT'
          and s.day = ep.day
          and s.center_code = ep.center_code
          and sp.project_code = ep.project_code
          and sp.status = 'active'
          and (s.queue_ref = ep.entry_id or (s.queue_ref is null and s.nid = ep.nid))
     );
  get diagnostics v_n = row_count;

  if v_n > 0 then
    perform private.log('ترحيل لم تُخدم', array_to_string(p_projects, '، ') || ' · ' || v_n || ' حالة');
  end if;
  return v_n;
end;
$$;

-- إرجاع دور مُرحّل إلى الانتظار (نفس اليوم، من نقطة المشروع، أو من لديه صلاحية تعديل الإدخالات)
create or replace function public.unmark_left(p_entry uuid, p_project text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.entry_projects;
begin
  select * into r from public.entry_projects
   where entry_id = p_entry and project_code = p_project and status = 'active' and left_at is not null;
  if not found then
    raise exception 'هذا الدور غير مُرحّل' using errcode = 'P0001';
  end if;
  if not public.has_perm('edit_entries')
     and not (public.my_role() = 'POINT' and p_project = any (public.my_projects())
              and r.center_code = any (public.my_centers()) and r.day = public.gaza_today()) then
    raise exception 'لا تملك صلاحية إرجاع هذا الدور' using errcode = '42501';
  end if;
  update public.entry_projects set left_at = null, left_by = null
   where entry_id = p_entry and project_code = p_project and status = 'active';
  perform private.log('إرجاع للانتظار', r.nid || ' · ' || p_project);
end;
$$;

revoke all on function public.mark_left(text, text[]) from public, anon;
revoke all on function public.unmark_left(uuid, text) from public, anon;
grant execute on function public.mark_left(text, text[]) to authenticated;
grant execute on function public.unmark_left(uuid, text) to authenticated;
