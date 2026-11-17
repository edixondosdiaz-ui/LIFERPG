begin;
alter table public.routine_exercises add column if not exists default_weight_kg numeric(6,2) check(default_weight_kg between 0 and 1000);
alter table public.routine_exercises add column if not exists default_reps int check(default_reps between 1 and 200);
alter table public.routine_exercises add column if not exists default_sets int check(default_sets between 1 and 30);
create table if not exists public.routine_creation_requests(user_id uuid not null references auth.users(id) on delete cascade,request_id uuid not null,payload jsonb not null,routine_id uuid not null,primary key(user_id,request_id));
alter table public.routine_creation_requests enable row level security;
revoke all on public.routine_creation_requests from public,anon,authenticated;
create or replace function public.create_training_routine(p_name text,p_days int[],p_exercises jsonb,p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare cached public.routine_creation_requests; payload jsonb; rid uuid; eid uuid; item jsonb; d int; w numeric; n int; reps int;
begin
 if auth.uid() is null or p_request is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 payload:=jsonb_build_object('name',btrim(p_name),'days',p_days,'exercises',p_exercises);
 select * into cached from public.routine_creation_requests where user_id=auth.uid() and request_id=p_request;
 if found then if cached.payload<>payload then raise exception 'La solicitud cambió'; end if;return cached.routine_id;end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or coalesce(cardinality(p_days),0)=0 or exists(select 1 from unnest(p_days) day_value where day_value is null or day_value not between 1 and 7) then raise exception 'Revisa el nombre y los días'; end if;
 if p_exercises is null or jsonb_typeof(p_exercises)<>'array' then raise exception 'Agrega un ejercicio'; end if;
 if jsonb_array_length(p_exercises) not between 1 and 40 then raise exception 'Agrega de 1 a 40 ejercicios'; end if;
 insert into public.routines(user_id,name) values(auth.uid(),btrim(p_name)) returning id into rid;
 foreach d in array p_days loop insert into public.routine_days values(rid,auth.uid(),d) on conflict do nothing;end loop;
 for item in select value from jsonb_array_elements(p_exercises) loop
  w:=nullif(item->>'weight','')::numeric;n:=nullif(item->>'sets','')::int;reps:=nullif(item->>'reps','')::int;
  if length(btrim(coalesce(item->>'name',''))) not between 1 and 80 or w is null or w not between 0 and 1000 or n is null or n not between 1 and 30 or reps is null or reps not between 1 and 200 then raise exception 'Completa nombre, peso, series y repeticiones';end if;
  insert into public.exercises(user_id,name,weekday) values(auth.uid(),btrim(item->>'name'),p_days[1]) returning id into eid;
  insert into public.routine_exercises(routine_id,exercise_id,user_id,default_weight_kg,default_reps,default_sets) values(rid,eid,auth.uid(),w,reps,n);
 end loop;
 insert into public.routine_creation_requests values(auth.uid(),p_request,payload,rid);
 return rid;
end $$;
revoke all on function public.create_training_routine(text,int[],jsonb,uuid) from public,anon;
grant execute on function public.create_training_routine(text,int[],jsonb,uuid) to authenticated;
-- Las plantillas son sugerencias, no series realizadas y no generan XP.
alter table public.edu_sessions add column if not exists timer_session_id uuid;
alter table public.edu_sessions add column if not exists focused_seconds int check(focused_seconds between 60 and 10800);
create unique index if not exists study_timer_once on public.edu_sessions(user_id,timer_session_id) where timer_session_id is not null;
create table if not exists public.study_daily_rewards(user_id uuid not null references auth.users(id) on delete cascade,reward_day date not null,xp int not null check(xp between 0 and 120),primary key(user_id,reward_day));
create table if not exists public.study_completions(user_id uuid not null references auth.users(id) on delete cascade,session_id uuid not null,result jsonb not null,primary key(user_id,session_id));
alter table public.study_daily_rewards enable row level security;
alter table public.study_completions enable row level security;
revoke all on public.study_daily_rewards,public.study_completions from public,anon,authenticated;
-- Reconoce consumo histórico sin otorgar ni restar XP. No depende de futuras eliminaciones.
insert into public.study_daily_rewards select user_id,studied_on,least(120,sum(coalesce(xp_awarded,least(120,greatest(1,minutes/2))))::int) from public.edu_sessions group by user_id,studied_on on conflict do nothing;

-- El bloque workout conserva la lógica previa, incluidas las sesiones de actividad.
create or replace function public.timer_action(p_kind text, p_action text, p_config jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.active_timers; seconds int; result jsonb := '{}'::jsonb; max_seconds int; session_key uuid; focus_minutes int; earned int; spent int; d date:=(now() at time zone 'America/Bogota')::date;
begin
  if auth.uid() is null or p_kind not in ('workout','study','break') then raise exception 'Temporizador inválido'; end if;
  -- Serializa incluso el primer inicio y evita guardar dos veces desde dos pestañas.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':timers', 0));
  if p_kind='study' and p_action='finish' and p_config->>'session_id' is not null then
    session_key:=(p_config->>'session_id')::uuid;
    select c.result into result from public.study_completions c where c.user_id=auth.uid() and c.session_id=session_key;
    if found then return result; end if;
  end if;
  select * into t from public.active_timers where user_id = auth.uid() and kind = p_kind for update;
  if p_action = 'start' then
    if t.user_id is not null then return to_jsonb(t); end if;
    if p_kind='study' then delete from public.active_timers where user_id=auth.uid() and kind='break'; end if;
    if p_kind='break' and exists(select 1 from public.active_timers where user_id=auth.uid() and kind='study') then raise exception 'Ya hay una sesión de estudio activa'; end if;
    if p_kind = 'study' and (coalesce(p_config->>'focus','25')::int not between 1 and 180
      or coalesce(p_config->>'brk','5')::int not between 1 and 60) then raise exception 'Duración inválida'; end if;
    if p_kind='study' then
      if coalesce(p_config->>'mode','pomodoro')<>'pomodoro' then raise exception 'Usa una sesión Pomodoro'; end if;
      p_config:=p_config||jsonb_build_object('mode','pomodoro','focus',coalesce((p_config->>'focus')::int,25),'brk',coalesce((p_config->>'brk')::int,5),'session_id',gen_random_uuid());
    end if;
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
      focus_minutes:=coalesce((t.config->>'focus')::int,25);
      if focus_minutes not between 1 and 180 then raise exception 'Duración inválida'; end if;
      if seconds<focus_minutes*60 then raise exception 'Completa todo el tiempo de enfoque antes de guardar'; end if;
      session_key:=coalesce((t.config->>'session_id')::uuid,gen_random_uuid());
      if p_config->>'session_id' is not null and (p_config->>'session_id')::uuid<>session_key then raise exception 'La sesión cambió'; end if;
      seconds:=focus_minutes*60;
      insert into public.study_daily_rewards values(auth.uid(),d,0) on conflict do nothing;
      select xp into spent from public.study_daily_rewards where user_id=auth.uid() and reward_day=d for update;
      earned:=greatest(0,least(greatest(1,focus_minutes/2),120-spent));
      insert into public.edu_sessions(user_id,topic,category,mode,minutes,studied_on,xp_awarded,timer_session_id,focused_seconds)
      values(auth.uid(),coalesce(nullif(left(btrim(t.config->>'topic'),80),''),'Estudio'),left(coalesce(t.config->>'category','General'),40),'pomodoro',focus_minutes,d,earned,session_key,seconds);
      update public.study_daily_rewards set xp=xp+earned where user_id=auth.uid() and reward_day=d;
      if earned>0 then perform public.award_xp('intelecto',earned); end if;
      result:=jsonb_build_object('seconds',seconds,'xp_awarded',earned,'daily_cap',120);
      insert into public.study_completions values(auth.uid(),session_key,result);

    end if;
    delete from public.active_timers where user_id = auth.uid() and kind = p_kind;
    return result || jsonb_build_object('seconds',seconds);
  else raise exception 'Acción inválida'; end if;
  return to_jsonb(t);
end $$;
-- Cerrar entradas antiguas de tiempo declarado que permitían saltarse el temporizador.
revoke all on function public.log_study_session(text,text,text,int),public.log_study(text,int,text) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
