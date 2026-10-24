-- وضع الموقع: حقيقي أو عرض تجريبي (على مستوى الموقع كله)
alter table public.settings add column if not exists demo_mode boolean not null default false;

-- قراءة الوضع قبل تسجيل الدخول (لكل الزوار)
create or replace function public.site_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select coalesce((select demo_mode from public.settings where id = 1), false) $$;

-- تغيير الوضع: الأدمن فقط
create or replace function public.set_demo_mode(p_on boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'تغيير وضع الموقع للأدمن فقط' using errcode = '42501'; end if;
  update public.settings set demo_mode = p_on, updated_at = now() where id = 1;
  perform private.log(case when p_on then 'تشغيل العرض التجريبي' else 'الرجوع للوضع الحقيقي' end, '');
end;
$$;

revoke execute on function public.site_mode() from public;
grant execute on function public.site_mode() to anon, authenticated;
revoke execute on function public.set_demo_mode(boolean) from public, anon;
grant execute on function public.set_demo_mode(boolean) to authenticated;
