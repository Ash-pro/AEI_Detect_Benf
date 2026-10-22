-- =====================================================================
-- نظام استقبال وتوجيه المستفيدين — الجداول الأساسية
-- كل الأوقات timestamptz، و"اليوم" بتوقيت غزة
-- =====================================================================

create or replace function public.gaza_today()
returns date
language sql
stable
set search_path = ''
as $$ select (now() at time zone 'Asia/Gaza')::date $$;

-- ===== المراكز =====
create table public.centers (
  code text primary key check (code ~ '^[A-Z]{2,12}$'),
  name text not null,
  short text not null,
  active boolean not null default true,
  sort_order int not null default 0
);

-- ===== المشاريع =====
create table public.projects (
  code text primary key check (code ~ '^[A-Z0-9_]{2,12}$'),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  sort_order int not null default 0,
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.project_centers (
  project_code text not null references public.projects (code) on update cascade on delete cascade,
  center_code text not null references public.centers (code) on update cascade on delete cascade,
  primary key (project_code, center_code)
);
create index project_centers_center_idx on public.project_centers (center_code);

-- ===== المستخدمون (مرتبطون بحسابات Supabase Auth) =====
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,40}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  role text not null check (role in ('RECEPTION', 'POINT', 'SUPERVISOR', 'ADMIN')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.user_centers (
  user_id uuid not null references public.profiles (id) on delete cascade,
  center_code text not null references public.centers (code) on update cascade on delete cascade,
  primary key (user_id, center_code)
);
create index user_centers_center_idx on public.user_centers (center_code);

create table public.user_projects (
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_code text not null references public.projects (code) on update cascade on delete cascade,
  primary key (user_id, project_code)
);
create index user_projects_project_idx on public.user_projects (project_code);

-- ===== المستفيدون: رقم الهوية فريد في كل النظام =====
create table public.beneficiaries (
  nid text primary key check (nid ~ '^[0-9]{9}$'),
  name text not null check (length(trim(name)) > 0),
  id_type text check (id_type in ('FATHER', 'MOTHER', 'CHILD')),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null
);
create index beneficiaries_created_by_idx on public.beneficiaries (created_by);

-- ===== الإدخالات =====
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  nid text not null references public.beneficiaries (nid) on update cascade on delete cascade,
  center_code text not null references public.centers (code) on update cascade,
  user_id uuid not null references public.profiles (id),
  kind text not null check (kind in ('RECEPTION', 'POINT')),
  at timestamptz not null default now(),
  day date not null default public.gaza_today(),
  is_new boolean not null default false,
  -- إدخال النقطة: دور الاستقبال الذي خُدم (قد تكون هوية الطفل مختلفة)
  queue_ref uuid references public.entries (id) on delete set null,
  -- تصحيح التوجيه من نقطة مشروع
  corrected_by uuid references public.profiles (id) on delete set null,
  corrected_at timestamptz,
  corrected_from text[]
);
create index entries_nid_idx on public.entries (nid, at desc);
create index entries_day_center_idx on public.entries (day, center_code);
create index entries_user_day_idx on public.entries (user_id, day);
create index entries_queue_ref_idx on public.entries (queue_ref);
create index entries_corrected_by_idx on public.entries (corrected_by);
-- استقبال واحد لنفس الهوية في نفس المركز ونفس اليوم
create unique index entries_one_reception_per_day
  on public.entries (nid, center_code, day) where kind = 'RECEPTION';

-- مشاريع كل إدخال مع رقم الدور
create table public.entry_projects (
  entry_id uuid not null references public.entries (id) on delete cascade,
  project_code text not null references public.projects (code) on update cascade,
  -- نسخ من الإدخال لقيود التفرد والبحث السريع
  nid text not null,
  kind text not null,
  center_code text not null,
  day date not null,
  queue_no int check (queue_no > 0),
  -- active: فعّال · moved: أُلغي بعد تحويل الحالة لمشروع آخر
  status text not null default 'active' check (status in ('active', 'moved')),
  primary key (entry_id, project_code)
);
create index entry_projects_project_day_idx on public.entry_projects (project_code, center_code, day);
create index entry_projects_nid_day_idx on public.entry_projects (nid, day);
-- لا يتكرر رقم دور في نفس المشروع والمركز واليوم
create unique index entry_projects_queue_unique
  on public.entry_projects (center_code, project_code, day, queue_no) where queue_no is not null;
-- النقطة: نفس الهوية لنفس المشروع مرة واحدة في اليوم
create unique index entry_projects_one_service_per_day
  on public.entry_projects (nid, project_code, day) where kind = 'POINT' and status = 'active';

-- آخر رقم دور لكل مشروع في كل مركز لكل يوم
create table public.queue_counters (
  day date not null,
  center_code text not null references public.centers (code) on update cascade on delete cascade,
  project_code text not null references public.projects (code) on update cascade on delete cascade,
  last_no int not null default 0,
  primary key (day, center_code, project_code)
);
create index queue_counters_center_idx on public.queue_counters (center_code);
create index queue_counters_project_idx on public.queue_counters (project_code);

-- ===== الإعدادات وسجل التغييرات =====
create table public.settings (
  id int primary key default 1 check (id = 1),
  hint_reception text not null default '',
  hint_point text not null default '',
  idle_minutes int not null default 30 check (idle_minutes between 5 and 240),
  updated_at timestamptz not null default now()
);

create table public.change_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  detail text not null default ''
);
create index change_log_at_idx on public.change_log (at desc);
create index change_log_user_idx on public.change_log (user_id);

-- ===== البيانات الأولية =====
insert into public.centers (code, name, short, sort_order) values
  ('GAZA', 'مركز غزة', 'غزة', 1),
  ('KHY', 'مركز خانيونس', 'خانيونس', 2);

insert into public.projects (code, name, sort_order, color) values
  ('WFP', 'WFP', 1, '#2563eb'),
  ('MAP', 'MAP', 2, '#c2410c'),
  ('WHH', 'WHH', 3, '#7c3aed'),
  ('UNICEF', 'UNICEF', 4, '#0e7490'),
  ('STC', 'Save The Children', 5, '#be185d'),
  ('CELIAC', 'السيلياك', 6, '#15803d'),
  ('MECA', 'MECA', 7, '#a16207'),
  ('TAAWON', 'التعاون', 8, '#4f46e5');

insert into public.project_centers (project_code, center_code)
select p.code, c.code from public.projects p cross join public.centers c;

insert into public.settings (id, hint_reception, hint_point, idle_minutes) values (
  1,
  'أدخل رقم هوية ولي الأمر. للحالة الجديدة اكتب الاسم (الأول يكفي) واختر النوع، ثم اختر المشاريع واضغط إدخال وبلّغ المستفيد برقم دوره.',
  'أدخل كل حالة تخدمها، واحدة تلو الأخرى، فور تقديم الخدمة. إذا كان توجيه الاستقبال خاطئاً، اضغط "تعديل التوجيه" ولا تُدخل الخدمة.',
  30
);
