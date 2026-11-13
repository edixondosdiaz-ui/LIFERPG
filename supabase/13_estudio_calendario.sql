-- Aplicar manualmente. Agrega metadatos; no modifica sesiones históricas ni XP previo.
begin;
alter table public.edu_sessions add column if not exists xp_awarded int check(xp_awarded>=0);
-- Los registros ya se crean desde RPC. El cliente conserva lectura/borrado propio,
-- pero no puede falsificar minutos ni el nuevo XP de una sesión.
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='edu_sessions' and policyname='study_server_insert') then
    create policy study_server_insert on public.edu_sessions as restrictive for insert to authenticated with check(false);
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='edu_sessions' and policyname='study_server_update') then
    create policy study_server_update on public.edu_sessions as restrictive for update to authenticated using(false) with check(false);
  end if;
end $$;
-- Sin acceso de escritura nuevo para el cliente. Se conservan las RLS propias.
-- Misma fórmula y mismos bonos que 03_pilares.sql; solo conserva su resultado.
create or replace function public.log_study_session(p_topic text,p_category text,p_mode text,p_minutes int) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
  v_day date:=public.app_today();
  v_week date:=date_trunc('week',public.app_today()::timestamp)::date;
  v_goal int; v_week_min int; v_xp int; v_id uuid;
begin
  if p_minutes is null or p_minutes<1 or p_minutes>720 then raise exception 'Duración inválida'; end if;
  insert into public.edu_sessions(user_id,topic,category,mode,minutes,studied_on)
    values(auth.uid(),btrim(p_topic),coalesce(nullif(btrim(p_category),''),'General'),
      case when p_mode='pomodoro' then 'pomodoro' else 'libre' end,p_minutes,v_day) returning id into v_id;
  v_xp:=least(120,greatest(1,p_minutes/2));
  perform public.award_xp('intelecto',v_xp);
  v_xp:=v_xp+public.claim_xp('study:day:'||v_day,'intelecto',10);
  select coalesce((select study_goal_min_week from public.pillar_settings where user_id=auth.uid()),600) into v_goal;
  select coalesce(sum(minutes),0) into v_week_min from public.edu_sessions where user_id=auth.uid() and studied_on>=v_week;
  if v_week_min>=v_goal then v_xp:=v_xp+public.claim_xp('study:week:'||v_week,'intelecto',50); end if;
  update public.edu_sessions set xp_awarded=v_xp where id=v_id and user_id=auth.uid();
  return jsonb_build_object('xp_awarded',v_xp,'week_minutes',v_week_min,'goal',v_goal);
end $$;
revoke all on function public.log_study_session(text,text,text,int) from public,anon;
grant execute on function public.log_study_session(text,text,text,int) to authenticated;
notify pgrst,'reload schema';
commit;
