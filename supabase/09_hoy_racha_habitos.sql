-- Ejecutar manualmente. Solo agrega una consulta privada; no modifica registros ni XP.
begin;
create or replace function public.my_habit_week() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid(); current_date_co date:=public.app_today(); monday date; current_streak integer; result jsonb;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  monday:=date_trunc('week',current_date_co::timestamp)::date;
  with dates as (
    select distinct performed_at::date d from public.habit_logs where user_id=uid and performed_at<=current_date_co
  ), day_groups as (
    select d,d-(row_number() over(order by d))::integer g from dates
  ) select case when max(d)>=current_date_co-1 then
      (select count(*)::integer from day_groups where g=(select g from day_groups order by d desc limit 1)) else 0 end
    into current_streak from day_groups;

  select jsonb_agg(jsonb_build_object('date',monday+i,'habits',coalesce((
    select jsonb_agg(jsonb_build_object('pillar',h.pillar,'habit',h.habit,'count',h.n) order by h.pillar,h.habit)
    from (select pillar,habit,count(*) n from public.habit_logs
      where user_id=uid and performed_at=monday+i and performed_at<=current_date_co group by pillar,habit) h
  ),'[]'::jsonb)) order by i) into result from generate_series(0,6) i;
  return jsonb_build_object('today',current_date_co,'week_start',monday,'streak',coalesce(current_streak,0),'days',result);
end $$;
revoke all on function public.my_habit_week() from public,anon;
grant execute on function public.my_habit_week() to authenticated;
notify pgrst,'reload schema';
commit;
