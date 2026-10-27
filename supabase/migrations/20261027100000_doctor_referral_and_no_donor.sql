-- =====================================================================
-- 1) مشاريع الطبيب: أي نقطة تحوّل لها، ولا تُحسب تكراراً
-- 2) خدمة بدون تطبيق الممول (بت) + موعد بعد أسبوعين — حسب المشروع والمركز
-- كل التغييرات إضافية: أعمدة بقيم افتراضية، جدول جديد، دوال جديدة.
-- التعديل الوحيد على دالة قائمة: set_reception_projects لا تحذف تحويلات الطبيب من النقاط.
-- =====================================================================

-- ===== المشاريع =====
alter table public.projects add column if not exists is_doctor boolean not null default false;
alter table public.projects add column if not exists defer_centers text[] not null default '{}';
alter table public.projects add column if not exists defer_days int not null default 14;
alter table public.projects drop constraint if exists projects_defer_days_check;
alter table public.projects add constraint projects_defer_days_check check (defer_days between 1 and 90);

update public.projects set is_doctor = true where code like 'DR%' or code = 'MEDDIRECTOR';
update public.projects set defer_centers = '{KHY}' where code in ('WFP', 'WFPTSFP') and defer_centers = '{}';

-- أي مشروع جديد رمزه يبدأ بـ DR يكون مشروع طبيب تلقائياً
create or replace function private.projects_doctor_default()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.code like 'DR%' then new.is_doctor := true; end if;
  return new;
end;
$$;
drop trigger if exists projects_doctor_default on public.projects;
create trigger projects_doctor_default before insert on public.projects
  for each row execute function private.projects_doctor_default();

-- خيارات المشروع من لوحة التحكم
create or replace function public.save_project_options(p_code text, p_is_doctor boolean, p_defer_centers text[], p_defer_days int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('projects') then raise exception 'لا تملك صلاحية إدارة المشاريع' using errcode = '42501'; end if;
  if p_defer_days is null or p_defer_days not between 1 and 90 then
    raise exception 'مدة الموعد من 1 إلى 90 يوماً' using errcode = 'P0001';
  end if;
  if exists (select 1 from unnest(coalesce(p_defer_centers, '{}')) c where not exists (select 1 from public.centers where code = c)) then
    raise exception 'مركز غير معروف' using errcode = 'P0001';
  end if;
  update public.projects
     set is_doctor = coalesce(p_is_doctor, false),
         defer_centers = coalesce((select array_agg(distinct c) from unnest(p_defer_centers) c), '{}'),
         defer_days = p_defer_days
   where code = p_code;
  if not found then raise exception 'المشروع غير موجود' using errcode = 'P0001'; end if;
  perform private.log('خيارات مشروع', p_code
    || case when p_is_doctor then ' · مشروع طبيب' else '' end
    || case when cardinality(coalesce(p_defer_centers, '{}')) > 0 then ' · بدون بت: ' || array_to_string(p_defer_centers, '، ') || ' (' || p_defer_days || ' يوماً)' else '' end);
end;
$$;

-- ===== تحويل الطبيب من نقطة: معلومات على صف المشروع في إدخال الاستقبال =====
alter table public.entry_projects add column if not exists referred_by uuid references public.profiles (id) on delete set null;
alter table public.entry_projects add column if not exists referred_from text;
alter table public.entry_projects add column if not exists ref_note text;

-- تحويلات الطبيب من النقاط لا تُحذف ولا تُنقل عند تعديل توجيه الاستقبال
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

  if p_moved then
    update public.entry_projects
       set status = 'moved'
     where entry_id = p_entry and status = 'active' and not (project_code = any (p_projects)) and referred_by is null;
  else
    delete from public.entry_projects
     where entry_id = p_entry and status = 'active' and not (project_code = any (p_projects)) and referred_by is null;
  end if;

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

create or replace function public.refer_to_doctor(
  p_nid text,
  p_center text,
  p_project text,
  p_from text default null,
  p_note text default null,
  p_name text default null,
  p_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_day date := public.gaza_today();
  v_entry uuid;
  v_created boolean := false;
  v_is_new boolean := false;
  v_no int;
  v_from text := nullif(trim(coalesce(p_from, '')), '');
begin
  if public.my_role() is distinct from 'POINT' then
    raise exception 'التحويل للطبيب من نقاط المشاريع' using errcode = '42501';
  end if;
  if not (p_center = any (public.my_centers())) then
    raise exception 'حسابك غير مسموح له بالعمل في هذا المركز' using errcode = '42501';
  end if;
  if p_nid is null or p_nid !~ '^[0-9]{9}$' then
    raise exception 'رقم الهوية يجب أن يكون 9 أرقام' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.projects where code = p_project and is_doctor) then
    raise exception 'هذا المشروع ليس مشروع طبيب' using errcode = 'P0001';
  end if;
  perform private.check_projects(p_center, array[p_project]);
  if v_from is not null and not (v_from = any (public.my_projects())) then v_from := null; end if;

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

  select id into v_entry from public.entries
   where kind = 'RECEPTION' and nid = p_nid and center_code = p_center and day = v_day
   for update;

  if v_entry is null then
    begin
      insert into public.entries (nid, center_code, user_id, kind, day, is_new, corrected_by, corrected_at, corrected_from)
      values (p_nid, p_center, v_uid, 'RECEPTION', v_day, v_is_new, v_uid, now(), '{}')
      returning id into v_entry;
      v_created := true;
    exception when unique_violation then
      raise exception 'هذه الحالة حُوّلت للتو من جهاز آخر. أعد المحاولة' using errcode = 'P0001';
    end;
  end if;

  select queue_no into v_no from public.entry_projects
   where entry_id = v_entry and project_code = p_project and status = 'active';
  if found then
    raise exception 'الحالة محوّلة لهذا الطبيب اليوم (دور %)', v_no using errcode = 'P0001';
  end if;

  delete from public.entry_projects where entry_id = v_entry and project_code = p_project;
  v_no := private.next_queue(v_day, p_center, p_project);
  insert into public.entry_projects (entry_id, project_code, nid, kind, center_code, day, queue_no, status, referred_by, referred_from, ref_note)
  values (v_entry, p_project, p_nid, 'RECEPTION', p_center, v_day, v_no, 'active', v_uid, v_from, nullif(trim(coalesce(p_note, '')), ''));

  perform private.log('تحويل لطبيب', p_nid || ' ← ' || p_project || coalesce(' (من ' || v_from || ')', '') || ' دور ' || v_no);
  return jsonb_build_object('entry_id', v_entry, 'queue_no', v_no, 'created', v_created);
end;
$$;

create or replace function public.cancel_doctor_referral(p_entry uuid, p_project text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.entry_projects;
  e public.entries;
begin
  select * into r from public.entry_projects
   where entry_id = p_entry and project_code = p_project and status = 'active' and referred_by is not null;
  if not found then raise exception 'لا يوجد تحويل للطبيب لإلغائه' using errcode = 'P0001'; end if;
  if not public.has_perm('edit_entries') and not (r.referred_by = (select auth.uid()) and r.day = public.gaza_today()) then
    raise exception 'يمكن إلغاء التحويل من نفس الموظف وفي نفس اليوم' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.entry_projects s
     where s.kind = 'POINT' and s.status = 'active' and s.nid = r.nid and s.project_code = r.project_code
       and s.center_code = r.center_code and s.day = r.day
  ) then
    raise exception 'الطبيب أدخل خدمة هذه الحالة. لا يمكن إلغاء التحويل' using errcode = 'P0001';
  end if;

  delete from public.entry_projects where entry_id = p_entry and project_code = p_project;
  select * into e from public.entries where id = p_entry;
  -- إدخال استقبال أُنشئ فقط لأجل هذا التحويل ولم يبقَ فيه شيء: يُحذف
  if not exists (select 1 from public.entry_projects where entry_id = p_entry) then
    delete from public.entries where id = p_entry;
    delete from public.beneficiaries b where b.nid = e.nid and not exists (select 1 from public.entries x where x.nid = e.nid);
  end if;
  perform private.log('إلغاء تحويل طبيب', r.nid || ' ← ' || p_project || ' دور ' || coalesce(r.queue_no::text, ''));
end;
$$;

-- ===== خدمة بدون تطبيق الممول + الموعد =====
alter table public.entries add column if not exists no_donor boolean not null default false;
alter table public.entries add column if not exists no_donor_reason text;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  nid text not null references public.beneficiaries (nid) on update cascade on delete cascade,
  center_code text not null references public.centers (code) on update cascade,
  project_code text not null references public.projects (code) on update cascade,
  due_day date not null,
  attempt int not null default 1 check (attempt > 0),
  -- الخدمة التي حُجز فيها الموعد: التراجع عنها يحذف الموعد
  created_entry uuid not null references public.entries (id) on delete cascade,
  -- الخدمة التي أغلقته: التراجع عنها يعيده قادماً
  done_entry uuid references public.entries (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists appointments_due_idx on public.appointments (center_code, project_code, due_day);
create index if not exists appointments_nid_idx on public.appointments (nid);
create index if not exists appointments_created_entry_idx on public.appointments (created_entry);
create index if not exists appointments_done_entry_idx on public.appointments (done_entry);

alter table public.appointments enable row level security;
drop policy if exists "read: by role" on public.appointments;
create policy "read: by role" on public.appointments
  for select to authenticated using (
    (select public.is_back_office())
    or (select public.my_role()) = 'RECEPTION'
    or ((select public.my_role()) = 'POINT' and project_code = any ((select public.my_projects())::text[]))
  );

-- أي خدمة نقطة لنفس الهوية والمشروع والمركز تغلق الموعد القادم
create or replace function private.close_appointments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'POINT' and new.status = 'active' then
    update public.appointments
       set done_entry = new.entry_id
     where nid = new.nid and project_code = new.project_code and center_code = new.center_code
       and done_entry is null and created_entry <> new.entry_id;
  end if;
  return new;
end;
$$;
drop trigger if exists entry_projects_close_appointments on public.entry_projects;
create trigger entry_projects_close_appointments after insert on public.entry_projects
  for each row execute function private.close_appointments();

create or replace function public.serve_without_donor(
  p_nid text,
  p_center text,
  p_project text,
  p_due date,
  p_reason text default null,
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
  v_today date := public.gaza_today();
  v_res jsonb;
  v_entry uuid;
  v_attempt int;
  v_appt uuid;
begin
  if public.my_role() is distinct from 'POINT' then
    raise exception 'هذه الخدمة لموظف نقطة المشروع' using errcode = '42501';
  end if;
  if not (p_project = any (public.my_projects())) then
    raise exception 'يمكنك إدخال الخدمة في مشاريعك فقط' using errcode = '42501';
  end if;
  if not exists (select 1 from public.projects where code = p_project and p_center = any (defer_centers)) then
    raise exception 'هذا الخيار غير مفعّل لهذا المشروع في هذا المركز' using errcode = 'P0001';
  end if;
  if p_due is null or p_due <= v_today or p_due > v_today + 90 then
    raise exception 'اختر موعداً بعد اليوم وخلال 90 يوماً' using errcode = 'P0001';
  end if;

  -- نفس مسار إدخال الخدمة المعتاد (التحقق من المشروع والمركز والتكرار)
  v_res := public.add_entry(p_nid, p_center, array[p_project], p_name, p_type, p_queue_ref);
  v_entry := (v_res ->> 'entry_id')::uuid;

  update public.entries
     set no_donor = true, no_donor_reason = nullif(trim(coalesce(p_reason, '')), '')
   where id = v_entry;

  -- رقم المحاولة: الموعد السابق الذي أغلقته هذه الخدمة + 1
  select coalesce(max(attempt), 0) + 1 into v_attempt from public.appointments where done_entry = v_entry;

  insert into public.appointments (nid, center_code, project_code, due_day, attempt, created_entry, created_by)
  values (p_nid, p_center, p_project, p_due, v_attempt, v_entry, v_uid)
  returning id into v_appt;

  perform private.log('خدمة بدون تطبيق الممول', p_nid || ' · ' || p_project || ' · موعد ' || p_due || case when v_attempt > 1 then ' (محاولة ' || v_attempt || ')' else '' end);
  return v_res || jsonb_build_object('appointment_id', v_appt, 'due_day', p_due, 'attempt', v_attempt);
end;
$$;

-- ===== الصلاحيات والتحديث اللحظي =====
revoke execute on function
  public.save_project_options(text, boolean, text[], int),
  public.refer_to_doctor(text, text, text, text, text, text, text),
  public.cancel_doctor_referral(uuid, text),
  public.serve_without_donor(text, text, text, date, text, text, text, uuid)
from public, anon;
grant execute on function
  public.save_project_options(text, boolean, text[], int),
  public.refer_to_doctor(text, text, text, text, text, text, text),
  public.cancel_doctor_referral(uuid, text),
  public.serve_without_donor(text, text, text, date, text, text, text, uuid)
to authenticated;
revoke all on function private.projects_doctor_default(), private.close_appointments() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'appointments') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;
