-- Aplicar completo manualmente después de las migraciones anteriores.
-- No elimina ni actualiza registros existentes. Las funciones escriben solo al usarlas.
begin;
-- Importar asociaciones antiguas solo cuando se crean las tablas de esta fase.
do $install_state$ begin
  perform set_config('liferpg.import_routine_days', (to_regclass('public.routine_days') is null)::text,true);
  perform set_config('liferpg.import_routine_exercises', (to_regclass('public.routine_exercises') is null)::text,true);
end $install_state$;
create table if not exists public.routine_days (
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday smallint not null check(weekday between 1 and 7),
  primary key(routine_id,weekday)
);
create table if not exists public.routine_exercises (
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(routine_id,exercise_id)
);
alter table public.routine_days enable row level security;
alter table public.routine_exercises enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='routine_days' and policyname='routine_days_own') then
    create policy routine_days_own on public.routine_days for all to authenticated
      using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.routines r where r.id=routine_id and r.user_id=auth.uid()));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='routine_exercises' and policyname='routine_exercises_own') then
    create policy routine_exercises_own on public.routine_exercises for all to authenticated
      using(user_id=auth.uid()) with check(user_id=auth.uid()
        and exists(select 1 from public.routines r where r.id=routine_id and r.user_id=auth.uid())
        and exists(select 1 from public.exercises e where e.id=exercise_id and e.user_id=auth.uid()));
  end if;
end $$;
grant select,insert,update,delete on public.routine_days,public.routine_exercises to authenticated;
-- Conserva las asociaciones anteriores sin cambiar ejercicios ni sus series.
insert into public.routine_days(routine_id,user_id,weekday)
  select distinct e.routine_id,e.user_id,e.weekday from public.exercises e
  join public.routines r on r.id=e.routine_id and r.user_id=e.user_id
  where current_setting('liferpg.import_routine_days',true)='true'
  on conflict do nothing;
insert into public.routine_exercises(routine_id,exercise_id,user_id)
  select e.routine_id,e.id,e.user_id from public.exercises e
  join public.routines r on r.id=e.routine_id and r.user_id=e.user_id
  where current_setting('liferpg.import_routine_exercises',true)='true'
  on conflict do nothing;

alter table public.workout_sets add column if not exists routine_id uuid references public.routines(id) on delete set null;
alter table public.workout_sets add column if not exists rir smallint check(rir between 0 and 10);
create index if not exists workout_sets_routine_day on public.workout_sets(user_id,routine_id,performed_at);
create table if not exists public.routine_entry_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  primary key(user_id,request_id)
);
alter table public.routine_entry_requests enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='routine_entry_requests' and policyname='routine_requests_read') then
    create policy routine_requests_read on public.routine_entry_requests for select to authenticated using(user_id=auth.uid());
  end if;
end $$;
revoke all on public.routine_entry_requests from anon,authenticated;
grant select on public.routine_entry_requests to authenticated;

create or replace function public.create_scheduled_routine(p_name text,p_days int[],p_names text[]) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); rid uuid; eid uuid; n text; d int;
begin
  if uid is null then raise exception 'Inicia sesión'; end if;
  if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'Escribe un nombre de rutina (máximo 80 caracteres)'; end if;
  if coalesce(cardinality(p_days),0)=0 or exists(select 1 from unnest(p_days) x where x is null or x not between 1 and 7) then raise exception 'Elige al menos un día'; end if;
  if coalesce(cardinality(p_names),0) not between 1 and 40 then raise exception 'Agrega al menos un ejercicio (máximo 40)'; end if;
  -- El trigger existente aplica cuota Gratis/Premium y serializa la creación.
  insert into public.routines(user_id,name) values(uid,btrim(p_name)) returning id into rid;
  foreach d in array p_days loop
    insert into public.routine_days(routine_id,user_id,weekday) values(rid,uid,d) on conflict do nothing;
  end loop;
  foreach n in array p_names loop
    if n is null or length(btrim(n)) not between 1 and 80 then raise exception 'Escribe el nombre de cada ejercicio'; end if;
    insert into public.exercises(user_id,name,weekday) values(uid,btrim(n),p_days[1]) returning id into eid;
    insert into public.routine_exercises(routine_id,exercise_id,user_id) values(rid,eid,uid);
  end loop;
  return rid;
end $$;

create or replace function public.add_routine_exercise(p_routine uuid,p_weekday int,p_exercise uuid default null,p_name text default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); eid uuid:=p_exercise;
begin
  if uid is null or not exists(select 1 from public.routines where id=p_routine and user_id=uid) then raise exception 'No encontramos tu rutina'; end if;
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

-- Contexto transaccional: agrega rutina y RIR a las filas NUEVAS del RPC original.
create or replace function public.stamp_routine_workout_set() returns trigger
language plpgsql security definer set search_path=public as $$
declare context jsonb; rid uuid;
begin
  context:=nullif(current_setting('liferpg.workout_context',true),'')::jsonb;
  if context is not null then
    rid:=(context->>'routine')::uuid;
    if new.user_id<>auth.uid() or not exists(select 1 from public.routine_exercises re
      where re.routine_id=rid and re.exercise_id=new.exercise_id and re.user_id=auth.uid()) then raise exception 'El ejercicio no pertenece a tu rutina'; end if;
    new.routine_id:=rid;
    new.rir:=(context->>'rir')::smallint;
  end if;
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='stamp_routine_workout_set' and tgrelid='public.workout_sets'::regclass) then
    create trigger stamp_routine_workout_set before insert on public.workout_sets for each row execute function public.stamp_routine_workout_set();
  end if;
end $$;

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
    where re.routine_id=p_routine and re.exercise_id=p_exercise and re.user_id=uid and r.user_id=uid)
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

create or replace function public.routine_workout_state(p_routine uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare uid uuid:=auth.uid(); d date:=public.app_today(); previous_date date; sets_today jsonb; sets_previous jsonb;
begin
  if uid is null or not exists(select 1 from public.routines where id=p_routine and user_id=uid) then raise exception 'No encontramos tu rutina'; end if;
  select max(s.performed_at) into previous_date from public.workout_sets s join public.exercises e on e.id=s.exercise_id
    where s.user_id=uid and s.performed_at<d and (s.routine_id=p_routine or(s.routine_id is null and e.routine_id=p_routine));
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'exercise_id',s.exercise_id,'name',e.name,'weight_kg',s.weight_kg,
    'reps',s.reps,'rir',s.rir,'rpe',s.rpe,'rest_seconds',s.rest_seconds,'performed_at',s.performed_at) order by s.created_at,s.id),'[]'::jsonb)
    into sets_today from public.workout_sets s join public.exercises e on e.id=s.exercise_id
    where s.user_id=uid and s.performed_at=d and(s.routine_id=p_routine or(s.routine_id is null and e.routine_id=p_routine));
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'exercise_id',s.exercise_id,'name',e.name,'weight_kg',s.weight_kg,
    'reps',s.reps,'rir',s.rir,'rpe',s.rpe,'rest_seconds',s.rest_seconds,'performed_at',s.performed_at) order by s.created_at,s.id),'[]'::jsonb)
    into sets_previous from public.workout_sets s join public.exercises e on e.id=s.exercise_id
    where s.user_id=uid and s.performed_at=previous_date and(s.routine_id=p_routine or(s.routine_id is null and e.routine_id=p_routine));
  return jsonb_build_object('today',d,'previous_day',previous_date,'today_sets',sets_today,'previous_sets',sets_previous);
end $$;
revoke all on function public.stamp_routine_workout_set() from public,anon,authenticated;
revoke all on function public.create_scheduled_routine(text,int[],text[]),public.add_routine_exercise(uuid,int,uuid,text),
  public.log_routine_exercise(uuid,uuid,jsonb,uuid),public.routine_workout_state(uuid) from public,anon;
grant execute on function public.create_scheduled_routine(text,int[],text[]),public.add_routine_exercise(uuid,int,uuid,text),
  public.log_routine_exercise(uuid,uuid,jsonb,uuid),public.routine_workout_state(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
