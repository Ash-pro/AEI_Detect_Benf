-- =====================================================================
-- صلاحيات المشرفين: يحددها الأدمن لكل مشرف من لوحة التحكم
--   home           لوحة اليوم (الرئيسية)
--   days           سجل الأيام وتفاصيلها
--   export         التصدير إلى Excel
--   reports        التقارير الشهرية
--   overlap        تقرير التكرار
--   beneficiaries  المستفيدون (عرض)
--   edit_entries   تعديل وحذف الإدخالات وبيانات المستفيدين
--   users          إدارة حسابات الاستقبال والنقاط
--   projects       المشاريع والمراكز
-- الأدمن يملك كل الصلاحيات دائماً.
-- =====================================================================

alter table public.profiles
  add column if not exists permissions text[] not null default '{}';

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array['home', 'days', 'export', 'reports', 'overlap', 'beneficiaries', 'edit_entries', 'users', 'projects']::text[]
);

-- المشرفون الحاليون: صلاحياتهم السابقة + التقارير والتكرار والمستفيدين
update public.profiles
   set permissions = array['days', 'export', 'reports', 'overlap', 'beneficiaries', 'users', 'projects']
 where role = 'SUPERVISOR' and permissions = '{}';

-- هل يملك المستخدم الحالي هذه الصلاحية؟
create or replace function public.has_perm(p text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select pr.role = 'ADMIN' or (pr.role = 'SUPERVISOR' and p = any (pr.permissions))
       from public.profiles pr
      where pr.id = (select auth.uid()) and pr.active),
    false)
$$;
revoke execute on function public.has_perm(text) from public, anon;
grant execute on function public.has_perm(text) to authenticated;

-- ===== تعديل الإدخالات: صاحب الإدخال اليوم، أو الأدمن، أو مشرف بصلاحية التعديل =====
create or replace function private.can_edit(e public.entries)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.has_perm('edit_entries')
      or (e.user_id = (select auth.uid()) and e.day = public.gaza_today() and public.my_role() in ('RECEPTION', 'POINT'))
$$;
revoke all on function private.can_edit(public.entries) from public, anon, authenticated;
