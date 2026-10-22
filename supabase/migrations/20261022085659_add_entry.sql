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

revoke execute on function
  public.add_entry(text, text, text[], text, text, uuid)
from public, anon;
grant execute on function
  public.add_entry(text, text, text[], text, text, uuid)
to authenticated;
