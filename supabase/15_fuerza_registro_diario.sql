-- Manual después de 14. No ejecutar fragmentos. No elimina registros históricos.
begin;
alter table public.workout_sets add column if not exists deleted_at timestamptz;
alter table public.workout_sets add column if not exists series_order integer check(series_order>0);
alter table public.routines add column if not exists deleted_at timestamptz;
-- Vista de lectura común: también filtra cuando la consulta viene de SECURITY DEFINER.
create or replace view public.active_workout_sets with(security_invoker=true) as
 select * from public.workout_sets where deleted_at is null;
revoke all on public.active_workout_sets from public,anon,authenticated;
grant select on public.active_workout_sets to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='workout_sets' and policyname='sets_not_deleted') then
  create policy sets_not_deleted on public.workout_sets as restrictive for select to authenticated using(deleted_at is null);
 end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='routines' and policyname='routines_not_archived') then
  create policy routines_not_archived on public.routines as restrictive for select to authenticated using(deleted_at is null);
 end if;
end $$;
-- Sin FK al ejercicio: la recompensa consumida sobrevive incluso al borrado del catálogo.
create table if not exists public.strength_day_rewards(
 user_id uuid not null references auth.users(id) on delete cascade,
 exercise_id uuid not null, performed_on date not null, primary key(user_id,exercise_id,performed_on)
);
alter table public.strength_day_rewards enable row level security;
revoke all on public.strength_day_rewards from public,anon,authenticated;
-- Conservador: los días ya registrados se consideran recompensados, sin tocar XP ni marcas.
insert into public.strength_day_rewards select distinct user_id,exercise_id,performed_at from public.workout_sets on conflict do nothing;
create or replace function public.strength_reward(p_exercise uuid,p_sets int,p_volume numeric,p_over boolean,p_pr boolean) returns int
language plpgsql security definer set search_path=public as $$
declare earned int; inserted int; d date:=(now() at time zone 'America/Bogota')::date;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 insert into public.strength_day_rewards values(auth.uid(),p_exercise,d) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return 0; end if;
 earned:=p_sets*5+least(40,floor(p_volume/100)::int);
 perform public.award_xp('fuerza',earned);
 if p_over then earned:=earned+public.claim_xp('over:'||p_exercise||':'||d,'fuerza',10); end if;
 if p_pr then earned:=earned+public.claim_xp('pr:'||p_exercise||':'||d,'fuerza',15); end if;
 return earned;
end $$;
-- Guarda/reemplaza el ejercicio completo de HOY. Orden y edición son atómicos.
create or replace function public.save_daily_exercise(p_routine uuid,p_exercise uuid,p_rows jsonb,p_request uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); d date:=(now() at time zone 'America/Bogota')::date;
 r jsonb; payload jsonb; cached public.routine_entry_requests; w numeric; reps int; rest int; rir int;
 n int:=0; v numeric:=0; best numeric; best_w numeric; over_mark boolean:=false; pr boolean:=false; result jsonb;
begin
 if uid is null or p_request is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=uid for update;
 payload:=jsonb_build_object('routine',p_routine,'exercise',p_exercise,'rows',p_rows,'operation','daily');
 select * into cached from public.routine_entry_requests where user_id=uid and request_id=p_request;
 if found then
  if cached.payload<>payload then raise exception 'El registro cambió'; end if;
  return cached.result;
 end if;
 if not exists(select 1 from public.routines where id=p_routine and user_id=uid and deleted_at is null)
 or not exists(select 1 from public.exercises where id=p_exercise and user_id=uid)
 or not exists(select 1 from public.routine_exercises where routine_id=p_routine and exercise_id=p_exercise and user_id=uid) then raise exception 'Rutina no disponible'; end if;
 if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Agrega tus series'; end if;
 if jsonb_array_length(p_rows) not between 1 and 30 then raise exception 'Registra de 1 a 30 series'; end if;
 select max(s.weight_kg*s.reps),max(s.weight_kg) into best,best_w from public.active_workout_sets s
 where s.user_id=uid and s.exercise_id=p_exercise and s.performed_at<d;
 -- Las filas antiguas se conservan como versiones borradas, nunca se eliminan.
 update public.workout_sets set deleted_at=now() where user_id=uid and exercise_id=p_exercise
 and performed_at=d and deleted_at is null and (routine_id=p_routine or(routine_id is null and exists(select 1 from public.exercises e where e.id=p_exercise and e.routine_id=p_routine)));
 for r in select value from jsonb_array_elements(p_rows) loop
  w:=(r->>'weight')::numeric; reps:=(r->>'reps')::int; rest:=nullif(r->>'rest','')::int; rir:=nullif(r->>'rir','')::int;
  if w is null or w not between 0 and 1000 or reps is null or reps not between 1 and 200
  or(rest is not null and rest not between 0 and 86400) or(rir is not null and rir not between 0 and 10) then raise exception 'Revisa los valores de tus series'; end if;
  n:=n+1;v:=v+w*reps;over_mark:=over_mark or coalesce(w*reps>best,false);pr:=pr or coalesce(w>best_w,false);
  insert into public.workout_sets(user_id,exercise_id,routine_id,weight_kg,reps,rest_seconds,rir,performed_at,series_order,overload)
  values(uid,p_exercise,p_routine,w,reps,rest,rir,d,n,coalesce(w*reps>best,false));
 end loop;
 result:=jsonb_build_object('sets',n,'xp_awarded',public.strength_reward(p_exercise,n,v,over_mark,pr));
 insert into public.routine_entry_requests values(uid,p_request,payload,result);
 return result;
end $$;
create or replace function public.remove_daily_exercise(p_routine uuid,p_exercise uuid) returns void
language plpgsql security definer set search_path=public as $$
declare d date:=(now() at time zone 'America/Bogota')::date;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not exists(select 1 from public.routines where id=p_routine and user_id=auth.uid() and deleted_at is null) then raise exception 'Rutina no disponible'; end if;
 if not exists(select 1 from public.exercises where id=p_exercise and user_id=auth.uid()) then raise exception 'Ejercicio no disponible'; end if;
 update public.workout_sets set deleted_at=now() where user_id=auth.uid() and exercise_id=p_exercise and performed_at=d and deleted_at is null
 and(routine_id=p_routine or(routine_id is null and exists(select 1 from public.exercises where id=p_exercise and routine_id=p_routine)));
 delete from public.routine_exercises where user_id=auth.uid() and routine_id=p_routine and exercise_id=p_exercise;
end $$;
create or replace function public.archive_routine(p_routine uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 update public.routines set deleted_at=coalesce(deleted_at,now()) where id=p_routine and user_id=auth.uid();
 if not found then raise exception 'Rutina no disponible'; end if;
end $$;
create or replace function public.set_routine_days(p_routine uuid,p_days int[]) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 if not exists(select 1 from public.routines where id=p_routine and user_id=auth.uid() and deleted_at is null) then raise exception 'Rutina no disponible'; end if;
 if coalesce(cardinality(p_days),0)=0 or exists(select 1 from unnest(p_days) d where d is null or d not between 1 and 7) then raise exception 'Elige al menos un día'; end if;
 delete from public.routine_days where routine_id=p_routine and user_id=auth.uid() and not(weekday=any(p_days));
 insert into public.routine_days select p_routine,auth.uid(),d from unnest(p_days) d on conflict do nothing;
end $$;
create or replace function public.my_today_routines() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb; d date:=(now() at time zone 'America/Bogota')::date;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at),'[]'::jsonb) into result from public.routines r where r.user_id=auth.uid() and r.deleted_at is null
 and exists(select 1 from public.active_workout_sets s left join public.exercises e on e.id=s.exercise_id
 where s.user_id=auth.uid() and s.performed_at=d and(s.routine_id=r.id or(s.routine_id is null and e.routine_id=r.id)));
 return jsonb_build_object('day',d,'routines',result);
end $$;
create or replace function public.routine_workout_state(p_routine uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare d date:=(now() at time zone 'America/Bogota')::date; previous_date date; result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.routines where id=p_routine and user_id=auth.uid()) then raise exception 'Rutina no disponible'; end if;
 with relevant as(select s.* from public.active_workout_sets s join public.exercises e on e.id=s.exercise_id
 where s.user_id=auth.uid() and(s.routine_id=p_routine or(s.routine_id is null and e.routine_id=p_routine)))
 select max(performed_at) into previous_date from relevant where performed_at<d;
 with relevant as(select s.*,e.name from public.active_workout_sets s join public.exercises e on e.id=s.exercise_id
 where s.user_id=auth.uid() and(s.routine_id=p_routine or(s.routine_id is null and e.routine_id=p_routine)))
 select jsonb_build_object('today',d,'previous_day',previous_date,
 'today_sets',coalesce(jsonb_agg(to_jsonb(s) order by series_order nulls last,created_at,id) filter(where performed_at=d),'[]'::jsonb),
 'previous_sets',coalesce(jsonb_agg(to_jsonb(s) order by series_order nulls last,created_at,id) filter(where performed_at=previous_date),'[]'::jsonb)) into result from relevant s;
 return result;
end $$;
create or replace function public.delete_workout_set(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 update public.workout_sets set deleted_at=coalesce(deleted_at,now()) where id=p_id and user_id=auth.uid();
end $$;

-- Entradas antiguas usan la misma recompensa consumible, sin rutas de XP alternativas.
create or replace function public.log_workout_entry(
  p_exercise_id uuid, p_weight_kg numeric, p_reps int, p_sets int,
  p_rpe int default null, p_rest_seconds int default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (now() at time zone 'America/Bogota')::date;
  v_vol numeric; v_set_vol numeric := p_weight_kg * p_reps;
  v_best_vol numeric; v_best_w numeric;
  v_over boolean; v_pr boolean; v_xp int; v_i int;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if not exists (select 1 from public.exercises where id = p_exercise_id and user_id = v_uid) then
    raise exception 'Ejercicio no encontrado';
  end if;
  if p_weight_kg is null or p_weight_kg < 0 or p_weight_kg > 1000 then raise exception 'Peso inválido'; end if;
  if p_reps is null or p_reps < 1 or p_reps > 200 then raise exception 'Repeticiones inválidas'; end if;
  if p_sets is null or p_sets < 1 or p_sets > 30 then raise exception 'Series inválidas (1 a 30)'; end if;
  if p_rpe is not null and p_rpe not between 1 and 10 then raise exception 'El RPE va de 1 a 10'; end if;
  if p_rest_seconds is not null and p_rest_seconds < 0 then raise exception 'Descanso inválido'; end if;

  perform 1 from public.profiles where id=v_uid for update;
  select max(weight_kg * reps), max(weight_kg) into v_best_vol, v_best_w
    from public.active_workout_sets where exercise_id = p_exercise_id and user_id = v_uid and performed_at < v_day;

  v_over := v_best_vol is not null and v_set_vol > v_best_vol;
  v_pr   := v_best_w is not null and p_weight_kg > v_best_w;
  v_vol  := v_set_vol * p_sets;

  for v_i in 1..p_sets loop
    insert into public.workout_sets (user_id, exercise_id, weight_kg, reps, overload, rpe, rest_seconds, notes, performed_at)
    values (v_uid, p_exercise_id, p_weight_kg, p_reps, (v_i = 1 and v_over), p_rpe::smallint, p_rest_seconds,
            nullif(left(trim(coalesce(p_notes,'')), 300), ''), v_day);
  end loop;

  -- XP: base por serie + volumen (tope) + bonos de sobrecarga y récord (1 vez por ejercicio y día)
  v_xp:=public.strength_reward(p_exercise_id,p_sets,v_vol,coalesce(v_over,false),coalesce(v_pr,false));

  return jsonb_build_object('xp_awarded', v_xp, 'overload', v_over, 'pr', v_pr, 'volume', v_vol);
end $$;
create or replace function public.log_workout_set(p_exercise_id uuid,p_weight_kg numeric,p_reps int,p_rpe smallint default null,p_rest_seconds int default null,p_notes text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 return public.log_workout_entry(p_exercise_id,p_weight_kg,p_reps,1,p_rpe,p_rest_seconds,p_notes);
end $$;
create or replace function public.log_set(p_exercise_id uuid,p_weight_kg numeric,p_reps integer) returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 return public.log_workout_entry(p_exercise_id,p_weight_kg,p_reps,1);
end $$;

-- Lectores SECURITY DEFINER: usar la vista filtrada, no depender únicamente de RLS.
-- user_metrics
create or replace function public.user_metrics(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_xp int; v_friends int; v_res jsonb;
begin
  select coalesce(xp,0) into v_xp from public.profiles where id = p_uid;
  select count(*) into v_friends from public.friendships
   where status='accepted' and (requester_id=p_uid or addressee_id=p_uid);
  select jsonb_build_object(
    'streak',   public.compute_streak(p_uid),
    'xp',       coalesce(v_xp,0),
    'level',    floor(sqrt(coalesce(v_xp,0)/100.0))::int + 1,
    'habits',   (select count(*) from public.habit_logs  where user_id=p_uid),
    'sets',     (select count(*) from public.active_workout_sets where user_id=p_uid),
    'friends',  v_friends,
    'habits_vitalidad', (select count(*) from public.habit_logs where user_id=p_uid and pillar='vitalidad'),
    'habits_intelecto', (select count(*) from public.habit_logs where user_id=p_uid and pillar='intelecto'),
    'habits_finanzas',  (select count(*) from public.habit_logs where user_id=p_uid and pillar='finanzas'),
    -- métricas nuevas
    'workouts',      (select count(distinct performed_at) from public.active_workout_sets where user_id=p_uid),
    'study_hours',   (select coalesce(sum(minutes),0)/60 from public.edu_sessions where user_id=p_uid),
    'study_tasks',   (select count(*) from public.edu_tasks where user_id=p_uid and done),
    'water_goals',   (select count(*) from public.xp_claims where user_id=p_uid and claim_key like 'water:goal:%'),
    'sleep_goals',   (select count(*) from public.xp_claims where user_id=p_uid and claim_key like 'sleep:goal:%'),
    'meal_days',     (select count(distinct logged_on) from public.meals where user_id=p_uid),
    'fin_days',      (select count(distinct occurred_on) from public.fin_transactions where user_id=p_uid and from_recurring is null),
    'goals_done',    (select count(*) from public.xp_claims where user_id=p_uid and claim_key like 'goal:%')
  ) into v_res;
  return v_res;
end $$;

-- get_friend_profile
create or replace function public.get_friend_profile(p_username text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare p public.profiles; result jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  result:=public.public_profile_summary(p_username);
  if (result->>'private')::boolean then return result; end if;
  select * into p from public.profiles where username=(result->>'username');
  return (result-'achievements')||jsonb_build_object('pillar_xp',p.pillar_xp,
    'habits',(select count(*) from public.habit_logs where user_id=p.id),
    'sets',(select count(*) from public.active_workout_sets where user_id=p.id),
    'achievements',(select count(*) from public.user_achievements where user_id=p.id),
    'equipped',coalesce((select jsonb_agg(s.data) from public.inventory i join public.shop_items s on s.id=i.item_id where i.user_id=p.id and i.equipped),'[]'::jsonb));
end $$;

-- timer_action
create or replace function public.timer_action(p_kind text, p_action text, p_config jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.active_timers; seconds int; result jsonb := '{}'::jsonb; max_seconds int;
begin
  if auth.uid() is null or p_kind not in ('workout','study','break') then raise exception 'Temporizador inválido'; end if;
  -- Serializa incluso el primer inicio y evita guardar dos veces desde dos pestañas.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':timers', 0));
  select * into t from public.active_timers where user_id = auth.uid() and kind = p_kind for update;
  if p_action = 'start' then
    if t.user_id is not null then return to_jsonb(t); end if;
    if p_kind='study' then delete from public.active_timers where user_id=auth.uid() and kind='break'; end if;
    if p_kind='break' and exists(select 1 from public.active_timers where user_id=auth.uid() and kind='study') then raise exception 'Ya hay una sesión de estudio activa'; end if;
    if p_kind = 'study' and (coalesce(p_config->>'focus','25')::int not between 1 and 120
      or coalesce(p_config->>'brk','5')::int not between 1 and 60) then raise exception 'Duración inválida'; end if;
    insert into public.active_timers(user_id, kind, running_since, config)
      values(auth.uid(), p_kind, now(), case when p_kind='workout' then
        jsonb_build_object('started_at',now(),'initial_xp',(select coalesce((pillar_xp->>'fuerza')::int,0) from public.profiles where id=auth.uid())) else p_config end) returning * into t;
    return to_jsonb(t);
  end if;
  if t.user_id is null then raise exception 'No hay sesión activa. Actualiza la pantalla'; end if;
  seconds := t.elapsed_seconds + case when t.running_since is null then 0 else greatest(0, floor(extract(epoch from now() - t.running_since))::int) end;
  if p_action = 'pause' then
    update public.active_timers set elapsed_seconds = seconds, running_since = null where user_id = auth.uid() and kind = p_kind returning * into t;
  elsif p_action = 'resume' then
    update public.active_timers set running_since = coalesce(running_since, now()) where user_id = auth.uid() and kind = p_kind returning * into t;
  elsif p_action in ('finish','discard') then
    if p_action = 'finish' and p_kind = 'workout' then
      result := public.save_workout_session(seconds);
      result := result || jsonb_build_object(
        'total_xp', (select coalesce((pillar_xp->>'fuerza')::int,0) from public.profiles where id=auth.uid()) - (t.config->>'initial_xp')::int,
        'volume', (select coalesce(sum(weight_kg*reps),0) from public.active_workout_sets where user_id=auth.uid() and created_at >= (t.config->>'started_at')::timestamptz),
        'personal_records', (select count(distinct s.exercise_id) from public.active_workout_sets s
          where s.user_id=auth.uid() and s.created_at >= (t.config->>'started_at')::timestamptz
          and s.weight_kg > (select max(old.weight_kg) from public.active_workout_sets old where old.user_id=auth.uid() and old.exercise_id=s.exercise_id and old.created_at < (t.config->>'started_at')::timestamptz)));
    elsif p_action = 'finish' and p_kind = 'study' then
      max_seconds := case when t.config->>'mode' = 'pomodoro' then coalesce((t.config->>'focus')::int,25)*60 else 43200 end;
      seconds := least(seconds, max_seconds);
      if seconds < 60 then raise exception 'Estudia al menos un minuto para guardar'; end if;
      result := public.log_study_session(coalesce(nullif(left(trim(t.config->>'topic'),80),''),'Estudio'),
        left(coalesce(t.config->>'category','General'),40), coalesce(t.config->>'mode','pomodoro'), seconds/60);
    end if;
    delete from public.active_timers where user_id = auth.uid() and kind = p_kind;
    return result || jsonb_build_object('seconds',seconds);
  else raise exception 'Acción inválida'; end if;
  return to_jsonb(t);
end $$;

-- my_activity
create or replace function public.my_activity() returns table("day" date,pillar text,entries bigint)
language sql stable security definer set search_path=public as $$
 with activity as (
 select performed_at::date AS "day",pillar from public.habit_logs where user_id=auth.uid()
 union all select performed_at::date,'fuerza' from public.active_workout_sets where user_id=auth.uid()
 union all select performed_at,'fuerza' from public.workout_sessions where user_id=auth.uid()
 union all select logged_on,'vitalidad' from public.water_logs where user_id=auth.uid()
 union all select slept_on,'vitalidad' from public.sleep_logs where user_id=auth.uid()
 union all select logged_on,'vitalidad' from public.meals where user_id=auth.uid()
 union all select studied_on,'intelecto' from public.edu_sessions where user_id=auth.uid()
 union all select occurred_on,'finanzas' from public.fin_transactions where user_id=auth.uid() and from_recurring is null
 union all select logged_on,'vitalidad' from public.wellbeing_logs where user_id=auth.uid()
 union all select (done_at at time zone 'America/Bogota')::date,'intelecto' from public.edu_tasks where user_id=auth.uid() and done
 union all select completed_on,'vitalidad' from public.running_sessions where user_id=auth.uid() and status='completed')
 select "day",pillar,count(*) from activity where "day" between public.app_today()-89 and public.app_today() group by "day",pillar order by "day" desc
$$;

-- activity_days_with_protection
create or replace function public.activity_days_with_protection(p_uid uuid) returns table("day" date)
language sql stable security definer set search_path=public as $$
 select performed_at::date from public.habit_logs where user_id=p_uid
 union select performed_at::date from public.active_workout_sets where user_id=p_uid
 union select performed_at from public.workout_sessions where user_id=p_uid
 union select logged_on from public.water_logs where user_id=p_uid
 union select slept_on from public.sleep_logs where user_id=p_uid
 union select logged_on from public.meals where user_id=p_uid
 union select studied_on from public.edu_sessions where user_id=p_uid
 union select occurred_on from public.fin_transactions where user_id=p_uid and from_recurring is null
 union select logged_on from public.wellbeing_logs where user_id=p_uid
 union select (done_at at time zone 'America/Bogota')::date from public.edu_tasks where user_id=p_uid and done
 union select protected_on from public.streak_protections where user_id=p_uid
 union select completed_on from public.running_sessions where user_id=p_uid and status='completed'
$$;

-- premium_trends
create or replace function public.premium_trends() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.has_premium(auth.uid()) then raise exception 'Las tendencias largas requieren Premium'; end if;
  select jsonb_agg(jsonb_build_object('month',m::date,
    'volume',coalesce((select sum(weight_kg*reps) from public.active_workout_sets where user_id=auth.uid() and performed_at>=m::date and performed_at<(m+interval '1 month')::date),0),
    'workouts',(select count(distinct performed_at) from public.active_workout_sets where user_id=auth.uid() and performed_at>=m::date and performed_at<(m+interval '1 month')::date),
    'study_minutes',coalesce((select sum(minutes) from public.edu_sessions where user_id=auth.uid() and studied_on>=m::date and studied_on<(m+interval '1 month')::date),0),
    'sleep_hours',(select round(avg(hours),1) from public.sleep_logs where user_id=auth.uid() and slept_on>=m::date and slept_on<(m+interval '1 month')::date),
    'savings',coalesce((select sum(amount) from public.fin_transactions where user_id=auth.uid() and kind='ahorro' and occurred_on>=m::date and occurred_on<(m+interval '1 month')::date),0)) order by m)
    into result from generate_series(date_trunc('month',public.app_today()::timestamp)-make_interval(months=>(select trend_months-1 from public.feature_rules where id)),date_trunc('month',public.app_today()::timestamp),interval '1 month') m;
  return result;
end $$;
create or replace function public.routine_quota() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 return jsonb_build_object('count',(select count(*) from public.routines where user_id=auth.uid() and deleted_at is null),
 'limit',case when public.has_premium(auth.uid()) then null else(select free_routines from public.feature_rules where id) end);
end $$;
create or replace function public.guard_routine_quota() returns trigger
language plpgsql security definer set search_path=public as $$
declare plan_limit integer;
begin
  -- Serializa creaciones concurrentes de una misma cuenta.
  perform 1 from public.profiles where id=new.user_id for update;
  if public.has_premium(new.user_id) then return new; end if;
  select free_routines into strict plan_limit from public.feature_rules where id;
  if (select count(*) from public.routines where user_id=new.user_id and deleted_at is null)>=plan_limit then
    raise exception 'Ya tienes el máximo de % rutinas de tu plan Gratis. Premium permite rutinas ilimitadas.', plan_limit;
  end if;
  return new;
end $$;
-- El cliente no puede desarchivar ni borrar por cascada; usa los RPC anteriores.
revoke delete on public.routines,public.exercises from public,anon,authenticated;
revoke insert,update on public.routines from public,anon,authenticated;
grant insert(name,user_id),update(name) on public.routines to authenticated;
revoke insert,update,delete on public.workout_sets from public,anon,authenticated;
revoke all on function public.strength_reward(uuid,int,numeric,boolean,boolean) from public,anon,authenticated;
revoke all on function public.save_daily_exercise(uuid,uuid,jsonb,uuid),public.remove_daily_exercise(uuid,uuid),public.archive_routine(uuid),public.set_routine_days(uuid,int[]),public.my_today_routines() from public,anon;
grant execute on function public.save_daily_exercise(uuid,uuid,jsonb,uuid),public.remove_daily_exercise(uuid,uuid),public.archive_routine(uuid),public.set_routine_days(uuid,int[]),public.my_today_routines() to authenticated;
-- Impedir nuevas escrituras sobre rutinas archivadas por endpoints anteriores.
create or replace function public.add_routine_exercise(p_routine uuid,p_weekday int,p_exercise uuid default null,p_name text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); eid uuid:=p_exercise;
begin
  if uid is null or not exists(select 1 from public.routines where id=p_routine and user_id=uid and deleted_at is null) then raise exception 'No encontramos tu rutina'; end if;
  if p_weekday is null or p_weekday not between 1 and 7 then raise exception 'Día inválido'; end if;
  perform 1 from public.routines where id=p_routine for update;
  if (select count(*) from public.routine_exercises where routine_id=p_routine)>=40 then raise exception 'Esta rutina ya tiene 40 ejercicios'; end if;
  if eid is null then
    if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'Escribe el nombre del ejercicio'; end if;
    insert into public.exercises(user_id,name,weekday) values(uid,btrim(p_name),p_weekday) returning id into eid;
  elsif not exists(select 1 from public.exercises where id=eid and user_id=uid) then raise exception 'No encontramos tu ejercicio'; end if;
  insert into public.routine_exercises(routine_id,exercise_id,user_id) values(p_routine,eid,uid) on conflict do nothing;
  return eid;
end $$;
-- Impedir nuevas escrituras sobre rutinas archivadas por endpoints anteriores.
create or replace function public.log_routine_exercise(p_routine uuid,p_exercise uuid,p_rows jsonb,p_request uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); payload jsonb; old_request public.routine_entry_requests; row_data jsonb;
  result jsonb; item jsonb; total_xp int:=0; total_sets int:=0; count_sets int; rir_value int;
begin
  if uid is null or p_request is null then raise exception 'Inicia sesión para registrar'; end if;
  payload:=jsonb_build_object('routine',p_routine,'exercise',p_exercise,'rows',p_rows);
  perform pg_advisory_xact_lock(hashtextextended(uid::text||p_request::text,0));
  select * into old_request from public.routine_entry_requests where user_id=uid and request_id=p_request;
  if found then
    if old_request.payload<>payload then raise exception 'Este registro ya fue enviado con otros valores'; end if;
    return old_request.result;
  end if;
  if not exists(select 1 from public.routine_exercises re join public.routines r on r.id=re.routine_id
    where re.routine_id=p_routine and re.exercise_id=p_exercise and re.user_id=uid and r.user_id=uid and r.deleted_at is null)
    then raise exception 'No encontramos el ejercicio en tu rutina'; end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then raise exception 'Agrega tus series'; end if;
  if jsonb_array_length(p_rows) not between 1 and 30 then raise exception 'Registra entre 1 y 30 filas'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    count_sets:=(row_data->>'sets')::int;
    rir_value:=nullif(row_data->>'rir','')::int;
    if count_sets is null or count_sets not between 1 and 30 then raise exception 'Indica cuántas series hiciste'; end if;
    total_sets:=total_sets+count_sets;
    if total_sets>30 then raise exception 'Registra máximo 30 series a la vez'; end if;
    if rir_value is not null and rir_value not between 0 and 10 then raise exception 'El RIR va de 0 a 10'; end if;
    perform set_config('liferpg.workout_context',jsonb_build_object('routine',p_routine,'rir',rir_value)::text,true);
    -- Conserva validaciones, XP, monedas, récords y sobrecarga del servidor actual.
    item:=public.log_workout_entry(p_exercise,(row_data->>'weight')::numeric,(row_data->>'reps')::int,
      count_sets,null,nullif(row_data->>'rest','')::int,null);
    total_xp:=total_xp+coalesce((item->>'xp_awarded')::int,0);
  end loop;
  perform set_config('liferpg.workout_context','',true);
  result:=jsonb_build_object('xp_awarded',total_xp,'sets',total_sets);
  insert into public.routine_entry_requests(user_id,request_id,payload,result) values(uid,p_request,payload,result);
  return result;
end $$;
notify pgrst,'reload schema';
commit;
