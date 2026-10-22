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

revoke execute on function
  public.update_beneficiary(text, text, text),
  public.reorder_projects(text[]),
  public.rename_center(text, text),
  public.save_settings(text, text, int)
from public, anon;
grant execute on function
  public.update_beneficiary(text, text, text),
  public.reorder_projects(text[]),
  public.rename_center(text, text),
  public.save_settings(text, text, int)
to authenticated;
