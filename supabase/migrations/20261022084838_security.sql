-- =====================================================================
-- الأمان: صلاحيات القراءة حسب الدور، والكتابة فقط عبر دوال الخادم
-- =====================================================================

-- ===== دوال مساعدة: دور المستخدم الحالي ومراكزه ومشاريعه =====
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.active
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.my_role() = 'ADMIN', false) $$;

create or replace function public.is_back_office()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce(public.my_role() in ('ADMIN', 'SUPERVISOR'), false) $$;

create or replace function public.my_projects()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(up.project_code), '{}')
  from public.user_projects up
  where up.user_id = (select auth.uid())
$$;

create or replace function public.my_centers()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(uc.center_code), '{}')
  from public.user_centers uc
  where uc.user_id = (select auth.uid())
$$;

revoke execute on function public.my_role(), public.is_admin(), public.is_back_office(), public.my_projects(), public.my_centers() from public, anon;
grant execute on function public.my_role(), public.is_admin(), public.is_back_office(), public.my_projects(), public.my_centers() to authenticated;
revoke execute on function public.gaza_today() from anon;

-- ===== تفعيل RLS على كل الجداول =====
alter table public.centers enable row level security;
alter table public.projects enable row level security;
alter table public.project_centers enable row level security;
alter table public.profiles enable row level security;
alter table public.user_centers enable row level security;
alter table public.user_projects enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.entries enable row level security;
alter table public.entry_projects enable row level security;
alter table public.queue_counters enable row level security;
alter table public.settings enable row level security;
alter table public.change_log enable row level security;

-- لا وصول لغير المسجلين
revoke all on all tables in schema public from anon;

-- ===== القراءة: أي مستخدم مفعّل =====
create policy "read: active users" on public.centers
  for select to authenticated using ((select public.my_role()) is not null);
create policy "read: active users" on public.projects
  for select to authenticated using ((select public.my_role()) is not null);
create policy "read: active users" on public.project_centers
  for select to authenticated using ((select public.my_role()) is not null);
create policy "read: active users" on public.settings
  for select to authenticated using ((select public.my_role()) is not null);
create policy "read: active users" on public.queue_counters
  for select to authenticated using ((select public.my_role()) is not null);
create policy "read: active users" on public.beneficiaries
  for select to authenticated using ((select public.my_role()) is not null);
-- أسماء الموظفين تظهر في السجلات للجميع؛ وكل مستخدم يقرأ حسابه حتى لو موقوفاً
create policy "read: active users or self" on public.profiles
  for select to authenticated using ((select public.my_role()) is not null or id = (select auth.uid()));

-- ===== إسناد المراكز والمشاريع: صاحب الحساب أو الإدارة =====
create policy "read: self or back office" on public.user_centers
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_back_office()));
create policy "read: self or back office" on public.user_projects
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_back_office()));

-- ===== الإدخالات =====
-- الإدارة والاستقبال: الكل. النقطة: إدخالات الاستقبال + خدمات مشاريعها
create policy "read: by role" on public.entries
  for select to authenticated using (
    (select public.is_back_office())
    or (select public.my_role()) = 'RECEPTION'
    or (
      (select public.my_role()) = 'POINT'
      and (
        kind = 'RECEPTION'
        or exists (
          select 1 from public.entry_projects ep
          where ep.entry_id = entries.id and ep.project_code = any ((select public.my_projects())::text[])
        )
      )
    )
  );

create policy "read: by role" on public.entry_projects
  for select to authenticated using (
    (select public.is_back_office())
    or (select public.my_role()) = 'RECEPTION'
    or (
      (select public.my_role()) = 'POINT'
      and (kind = 'RECEPTION' or project_code = any ((select public.my_projects())::text[]))
    )
  );

-- ===== سجل التغييرات: الأدمن فقط =====
create policy "read: admin" on public.change_log
  for select to authenticated using ((select public.is_admin()));

-- لا توجد سياسات insert/update/delete: كل الكتابة عبر دوال الخادم أو المفتاح السري

-- ===== التحديث اللحظي لقائمة الانتظار =====
alter publication supabase_realtime add table public.entries, public.entry_projects;
