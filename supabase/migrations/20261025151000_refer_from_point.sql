-- تحويل من نقطة المشروع: إذا لم تمر الحالة على الاستقبال اليوم في هذا المركز،
-- يُنشأ تحويل جديد باسم موظف النقطة مع أرقام دور. وإن وُجد تحويل، يُصحَّح كالمعتاد.
create or replace function public.refer_from_point(
  p_nid text,
  p_center text,
  p_projects text[],
  p_name text default null,
  p_type text default null,
  p_delete uuid[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_day date := public.gaza_today();
  v_projects text[];
  v_entry uuid;
  v_is_new boolean := false;
  v_queue jsonb;
begin
  if public.my_role() is distinct from 'POINT' then
    raise exception 'التحويل من النقطة لموظف النقطة' using errcode = '42501';
  end if;
  if not (p_center = any (public.my_centers())) then
    raise exception 'حسابك غير مسموح له بالعمل في هذا المركز' using errcode = '42501';
  end if;
  if p_nid is null or p_nid !~ '^[0-9]{9}$' then
    raise exception 'رقم الهوية يجب أن يكون 9 أرقام' using errcode = 'P0001';
  end if;

  -- يوجد تحويل استقبال اليوم: تصحيح التوجيه المعتاد
  select id into v_entry from public.entries
   where kind = 'RECEPTION' and nid = p_nid and center_code = p_center and day = v_day;
  if v_entry is not null then
    return public.correct_routing(v_entry, p_projects, p_delete) || jsonb_build_object('entry_id', v_entry, 'created', false);
  end if;

  v_projects := private.check_projects(p_center, p_projects);

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

  -- حذف إدخال الخدمة الخاطئ لموظف النقطة نفسه اليوم
  if coalesce(cardinality(p_delete), 0) > 0 then
    delete from public.entries
     where id = any (p_delete) and kind = 'POINT' and user_id = v_uid and day = v_day;
  end if;

  begin
    insert into public.entries (nid, center_code, user_id, kind, day, is_new, corrected_by, corrected_at, corrected_from)
    values (p_nid, p_center, v_uid, 'RECEPTION', v_day, v_is_new, v_uid, now(), '{}')
    returning id into v_entry;
  exception when unique_violation then
    raise exception 'هذه الحالة حُوّلت للتو من جهاز آخر. أعد إدخال رقم الهوية' using errcode = 'P0001';
  end;

  v_queue := private.set_reception_projects(v_entry, v_projects, false);
  perform private.log('تحويل من نقطة', p_nid || ' ← ' || array_to_string(v_projects, '، '));
  return jsonb_build_object('queue', v_queue, 'entry_id', v_entry, 'created', true, 'is_new', v_is_new);
end;
$$;

revoke execute on function public.refer_from_point(text, text, text[], text, text, uuid[]) from public, anon;
grant execute on function public.refer_from_point(text, text, text[], text, text, uuid[]) to authenticated;
