-- أسماء المراكز تظهر في شاشة اختيار المركز قبل تسجيل الدخول
grant select on public.centers to anon;
create policy "read: anyone" on public.centers for select to anon using (active);
