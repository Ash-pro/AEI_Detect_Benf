-- حراسة دوال الكتابة بصلاحيات المشرف

-- بيانات المستفيد: المشرف يحتاج صلاحية التعديل
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
  if public.my_role() = 'SUPERVISOR' and not public.has_perm('edit_entries') then
    raise exception 'لا تملك صلاحية تعديل بيانات المستفيدين' using errcode = '42501';
  end if;
  if v_name = '' then raise exception 'اكتب الاسم — الاسم الأول يكفي' using errcode = 'P0001'; end if;
  if p_type is not null and p_type not in ('FATHER', 'MOTHER', 'CHILD') then raise exception 'نوع الهوية غير صحيح' using errcode = 'P0001'; end if;
  select * into b from public.beneficiaries where nid = p_nid for update;
  if not found then raise exception 'رقم الهوية غير مسجل' using errcode = 'P0001'; end if;
  update public.beneficiaries set name = v_name, id_type = coalesce(p_type, id_type) where nid = p_nid;
  perform private.log('تعديل بيانات هوية', p_nid || ': "' || b.name || '" ← "' || v_name || '"'
    || case when p_type is not null and p_type is distinct from b.id_type then ' (تغيير النوع)' else '' end);
end;
$$;

-- ترتيب المشاريع وأسماء المراكز: صلاحية المشاريع
create or replace function public.reorder_projects(p_codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_perm('projects') then raise exception 'لا تملك صلاحية إدارة المشاريع' using errcode = '42501'; end if;
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
  if not public.has_perm('projects') then raise exception 'لا تملك صلاحية إدارة المراكز' using errcode = '42501'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'اكتب اسم المركز' using errcode = 'P0001'; end if;
  update public.centers set name = trim(p_name) where code = p_code;
  perform private.log('تعديل مركز', trim(p_name));
end;
$$;
