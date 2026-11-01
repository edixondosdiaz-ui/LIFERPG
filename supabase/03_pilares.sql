-- =====================================================================
-- LifeRPG · Migración 03 · Funcionalidad real de los 4 pilares
-- Ejecutar completa en Supabase → SQL Editor (después de modulosql3 / v2).
-- Es idempotente: se puede correr varias veces sin perder datos.
--
-- Usa tablas NUEVAS (prefijos fit_/water_/sleep_/meals/edu_/fin_) para no
-- chocar con las tablas health_logs / study_sessions / finance_entries de
-- scripts anteriores, que tienen esquemas distintos entre sí.
-- =====================================================================

begin;

-- 0) Requisitos -------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'award_xp') then
    raise exception 'Falta la función award_xp (modulosql2). Ejecuta los scripts anteriores primero.';
  end if;
  if not exists (select 1 from pg_proc where proname = 'app_today') then
    raise exception 'Falta la función app_today (modulosql3 / v2). Ejecuta los scripts anteriores primero.';
  end if;
end $$;

-- 1) Utilidades comunes -------------------------------------------------

-- Libro de XP "una sola vez": evita regalar XP repetido (p. ej. borrar y volver a registrar)
create table if not exists public.xp_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  claim_key text not null,
  xp int not null,
  created_at timestamptz not null default now(),
  primary key (user_id, claim_key)
);
alter table public.xp_claims enable row level security;   -- sin políticas: solo las funciones lo tocan

-- Interna: otorga XP una sola vez por clave. Devuelve el XP realmente dado.
create or replace function public.claim_xp(p_key text, p_pillar text, p_xp int) returns int
language plpgsql security definer set search_path = public as $$
declare v_rows int;
begin
  if p_xp <= 0 then return 0; end if;
  insert into public.xp_claims (user_id, claim_key, xp) values (auth.uid(), p_key, p_xp)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return 0; end if;
  perform public.award_xp(p_pillar, p_xp);
  return p_xp;
end $$;
revoke all on function public.claim_xp(text, text, int) from public, anon, authenticated;

-- Objetivos y ajustes de los pilares (una fila por usuario)
create table if not exists public.pillar_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  water_goal_ml int not null default 2500 check (water_goal_ml between 500 and 10000),
  water_reminder_min int check (water_reminder_min is null or water_reminder_min between 15 and 480),
  sleep_goal_h numeric(3,1) not null default 8 check (sleep_goal_h between 3 and 14),
  kcal_goal int not null default 2200 check (kcal_goal between 800 and 8000),
  protein_goal int not null default 120 check (protein_goal between 0 and 500),
  carbs_goal int not null default 250 check (carbs_goal between 0 and 1000),
  fat_goal int not null default 70 check (fat_goal between 0 and 400),
  study_goal_min_week int not null default 600 check (study_goal_min_week between 30 and 6000),
  updated_at timestamptz not null default now()
);
alter table public.pillar_settings enable row level security;
drop policy if exists pillar_settings_own on public.pillar_settings;
create policy pillar_settings_own on public.pillar_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2) FUERZA ----------------------------------------------------------------

-- Duración de cada entrenamiento (cronómetro de la sesión)
create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_at date not null default public.app_today(),
  duration_seconds int not null check (duration_seconds between 60 and 43200),
  created_at timestamptz not null default now()
);
create index if not exists workout_sessions_user_day on public.workout_sessions (user_id, performed_at desc);
alter table public.workout_sessions enable row level security;
drop policy if exists workout_sessions_own on public.workout_sessions;
create policy workout_sessions_own on public.workout_sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro por ejercicio: peso, repeticiones y series OBLIGATORIOS; descanso, RPE y notas opcionales.
-- Inserta una fila por serie (así el historial y el volumen salen exactos).
create or replace function public.log_workout_entry(
  p_exercise_id uuid, p_weight_kg numeric, p_reps int, p_sets int,
  p_rpe int default null, p_rest_seconds int default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date := public.app_today();
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

  select max(weight_kg * reps), max(weight_kg) into v_best_vol, v_best_w
    from public.workout_sets where exercise_id = p_exercise_id and user_id = v_uid and performed_at < v_day;

  v_over := v_best_vol is not null and v_set_vol > v_best_vol;
  v_pr   := v_best_w is not null and p_weight_kg > v_best_w;
  v_vol  := v_set_vol * p_sets;

  for v_i in 1..p_sets loop
    insert into public.workout_sets (user_id, exercise_id, weight_kg, reps, overload, rpe, rest_seconds, notes, performed_at)
    values (v_uid, p_exercise_id, p_weight_kg, p_reps, (v_i = 1 and v_over), p_rpe::smallint, p_rest_seconds,
            nullif(left(trim(coalesce(p_notes,'')), 300), ''), v_day);
  end loop;

  -- XP: base por serie + volumen (tope) + bonos de sobrecarga y récord (1 vez por ejercicio y día)
  v_xp := p_sets * 5 + least(40, floor(v_vol / 100)::int);
  if v_over then v_xp := v_xp + public.claim_xp('over:' || p_exercise_id || ':' || v_day, 'fuerza', 10); end if;
  if v_pr   then v_xp := v_xp + public.claim_xp('pr:'   || p_exercise_id || ':' || v_day, 'fuerza', 15); end if;
  perform public.award_xp('fuerza', p_sets * 5 + least(40, floor(v_vol / 100)::int));

  return jsonb_build_object('xp_awarded', v_xp, 'overload', v_over, 'pr', v_pr, 'volume', v_vol);
end $$;

-- Borrar una serie propia (no revierte el XP; el bono diario no se puede repetir gracias a xp_claims)
create or replace function public.delete_workout_set(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.workout_sets where id = p_id and user_id = auth.uid()
$$;

-- Guardar la duración del entrenamiento (+10 XP una vez al día)
create or replace function public.save_workout_session(p_seconds int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_day date := public.app_today(); v_xp int;
begin
  if p_seconds is null or p_seconds < 60 then raise exception 'El entrenamiento debe durar al menos 1 minuto'; end if;
  insert into public.workout_sessions (user_id, performed_at, duration_seconds)
  values (auth.uid(), v_day, least(p_seconds, 43200));
  v_xp := public.claim_xp('workout:' || v_day, 'fuerza', 10);
  return jsonb_build_object('xp_awarded', v_xp);
end $$;

-- 3) SALUD ------------------------------------------------------------------

create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ml int not null check (ml between 1 and 5000),
  logged_on date not null default public.app_today(),
  created_at timestamptz not null default now()
);
create index if not exists water_logs_user_day on public.water_logs (user_id, logged_on desc);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  slept_on date not null,                       -- día en que te despiertas
  bed_time time, wake_time time,
  hours numeric(4,2) not null check (hours > 0 and hours <= 24),
  quality smallint check (quality between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, slept_on)
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  meal_type text not null check (meal_type in ('desayuno','almuerzo','cena','snack')),
  food_name text not null check (char_length(btrim(food_name)) between 1 and 80),
  quantity text,
  kcal int not null default 0 check (kcal between 0 and 5000),
  protein_g numeric(6,1) not null default 0 check (protein_g >= 0),
  carbs_g numeric(6,1) not null default 0 check (carbs_g >= 0),
  fat_g numeric(6,1) not null default 0 check (fat_g >= 0),
  logged_on date not null default public.app_today(),
  created_at timestamptz not null default now()
);
create index if not exists meals_user_day on public.meals (user_id, logged_on desc);

-- Agua: +5 XP por el primer vaso del día y +25 XP al cumplir el objetivo (una vez al día)
create or replace function public.log_water(p_ml int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_day date := public.app_today(); v_goal int; v_total int; v_xp int := 0;
begin
  if p_ml is null or p_ml < 1 or p_ml > 5000 then raise exception 'Cantidad inválida'; end if;
  insert into public.water_logs (user_id, ml, logged_on) values (auth.uid(), p_ml, v_day);
  select coalesce((select water_goal_ml from public.pillar_settings where user_id = auth.uid()), 2500) into v_goal;
  select coalesce(sum(ml), 0) into v_total from public.water_logs where user_id = auth.uid() and logged_on = v_day;
  v_xp := public.claim_xp('water:first:' || v_day, 'vitalidad', 5);
  if v_total >= v_goal then v_xp := v_xp + public.claim_xp('water:goal:' || v_day, 'vitalidad', 25); end if;
  return jsonb_build_object('xp_awarded', v_xp, 'total', v_total, 'goal', v_goal);
end $$;

-- Sueño: acepta hora de dormir/despertar o horas manuales. +10 XP por registrar, +20 XP por cumplir el objetivo.
create or replace function public.log_sleep(p_slept_on date, p_bed time default null, p_wake time default null,
  p_hours numeric default null, p_quality int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_h numeric := p_hours; v_goal numeric; v_xp int := 0;
begin
  if p_slept_on is null or p_slept_on > public.app_today() then raise exception 'Fecha inválida'; end if;
  if p_bed is not null and p_wake is not null then
    v_h := round((extract(epoch from (p_wake - p_bed + case when p_wake <= p_bed then interval '24 hours' else interval '0' end)) / 3600)::numeric, 2);
  end if;
  if v_h is null or v_h <= 0 or v_h > 24 then raise exception 'Indica las horas de sueño'; end if;
  if p_quality is not null and p_quality not between 1 and 5 then raise exception 'La calidad va de 1 a 5'; end if;

  insert into public.sleep_logs (user_id, slept_on, bed_time, wake_time, hours, quality)
  values (auth.uid(), p_slept_on, p_bed, p_wake, v_h, p_quality::smallint)
  on conflict (user_id, slept_on) do update set bed_time = excluded.bed_time, wake_time = excluded.wake_time,
    hours = excluded.hours, quality = excluded.quality;

  select coalesce((select sleep_goal_h from public.pillar_settings where user_id = auth.uid()), 8) into v_goal;
  v_xp := public.claim_xp('sleep:log:' || p_slept_on, 'vitalidad', 10);
  if v_h >= v_goal then v_xp := v_xp + public.claim_xp('sleep:goal:' || p_slept_on, 'vitalidad', 20); end if;
  return jsonb_build_object('xp_awarded', v_xp, 'hours', v_h);
end $$;

-- Comidas: +5 XP por cada tipo de comida registrado en el día (máx. 20 XP/día)
create or replace function public.log_meal(p_meal_type text, p_food_name text, p_quantity text default null,
  p_kcal int default 0, p_protein numeric default 0, p_carbs numeric default 0, p_fat numeric default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_day date := public.app_today();
begin
  if coalesce(p_kcal, 0) < 0 or coalesce(p_protein, 0) < 0 or coalesce(p_carbs, 0) < 0 or coalesce(p_fat, 0) < 0 then
    raise exception 'Los valores nutricionales no pueden ser negativos';
  end if;
  insert into public.meals (user_id, meal_type, food_name, quantity, kcal, protein_g, carbs_g, fat_g, logged_on)
  values (auth.uid(), p_meal_type, btrim(p_food_name), nullif(btrim(coalesce(p_quantity,'')), ''),
          coalesce(p_kcal,0), coalesce(p_protein,0), coalesce(p_carbs,0), coalesce(p_fat,0), v_day);
  return jsonb_build_object('xp_awarded', public.claim_xp('meal:' || p_meal_type || ':' || v_day, 'vitalidad', 5));
end $$;

-- 4) EDUCACIÓN --------------------------------------------------------------

create table if not exists public.edu_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topic text not null check (char_length(btrim(topic)) between 1 and 80),
  category text not null default 'General' check (char_length(btrim(category)) between 1 and 40),
  mode text not null default 'libre' check (mode in ('pomodoro','libre')),
  minutes int not null check (minutes between 1 and 720),
  studied_on date not null default public.app_today(),
  created_at timestamptz not null default now()
);
create index if not exists edu_sessions_user_day on public.edu_sessions (user_id, studied_on desc);

create table if not exists public.edu_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  priority text not null default 'media' check (priority in ('alta','media','baja')),
  due_on date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists edu_tasks_user on public.edu_tasks (user_id, done, due_on);

-- Sesión de estudio: 1 XP cada 2 min (máx. 120) + 10 XP por la primera sesión del día
-- + 50 XP la primera vez que cumples el objetivo semanal.
create or replace function public.log_study_session(p_topic text, p_category text, p_mode text, p_minutes int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_day date := public.app_today();
  v_week date := date_trunc('week', public.app_today()::timestamp)::date;
  v_goal int; v_week_min int; v_xp int;
begin
  if p_minutes is null or p_minutes < 1 or p_minutes > 720 then raise exception 'Duración inválida'; end if;
  insert into public.edu_sessions (user_id, topic, category, mode, minutes, studied_on)
  values (auth.uid(), btrim(p_topic), coalesce(nullif(btrim(p_category), ''), 'General'),
          case when p_mode = 'pomodoro' then 'pomodoro' else 'libre' end, p_minutes, v_day);
  v_xp := least(120, greatest(1, p_minutes / 2));
  perform public.award_xp('intelecto', v_xp);
  v_xp := v_xp + public.claim_xp('study:day:' || v_day, 'intelecto', 10);
  select coalesce((select study_goal_min_week from public.pillar_settings where user_id = auth.uid()), 600) into v_goal;
  select coalesce(sum(minutes), 0) into v_week_min from public.edu_sessions
   where user_id = auth.uid() and studied_on >= v_week;
  if v_week_min >= v_goal then v_xp := v_xp + public.claim_xp('study:week:' || v_week, 'intelecto', 50); end if;
  return jsonb_build_object('xp_awarded', v_xp, 'week_minutes', v_week_min, 'goal', v_goal);
end $$;

-- Completar / reabrir una tarea (+10 XP, +5 si la entregas a tiempo; una sola vez por tarea)
create or replace function public.set_task_done(p_id uuid, p_done boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.edu_tasks; v_xp int := 0;
begin
  select * into t from public.edu_tasks where id = p_id and user_id = auth.uid();
  if not found then raise exception 'Tarea no encontrada'; end if;
  update public.edu_tasks set done = p_done, done_at = case when p_done then now() else null end where id = p_id;
  if p_done then
    v_xp := public.claim_xp('task:' || p_id, 'intelecto', 10 + case when t.due_on is null or t.due_on >= public.app_today() then 5 else 0 end);
  end if;
  return jsonb_build_object('xp_awarded', v_xp);
end $$;

-- 5) FINANZAS ---------------------------------------------------------------

create table if not exists public.fin_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default '🎯',
  target_amount numeric(14,2) not null check (target_amount > 0),
  deadline date,
  created_at timestamptz not null default now()
);

create table if not exists public.fin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingreso','gasto','ahorro')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Otros',
  description text,
  goal_id uuid references public.fin_goals(id) on delete set null,
  occurred_on date not null default public.app_today(),
  from_recurring uuid,
  created_at timestamptz not null default now()
);
create index if not exists fin_transactions_user_day on public.fin_transactions (user_id, occurred_on desc);

-- Plantillas de ingresos / gastos periódicos (sueldo, arriendo, suscripciones...)
create table if not exists public.fin_recurring (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingreso','gasto')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'Otros',
  description text,
  every text not null check (every in ('semanal','quincenal','mensual')),
  next_on date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['water_logs','sleep_logs','meals','edu_sessions','edu_tasks','fin_goals','fin_transactions','fin_recurring'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;
end $$;

-- Registrar movimiento: +5 XP por el primer movimiento del día, +15 XP por ahorrar (1 vez al día),
-- +100 XP al completar una meta de ahorro.
create or replace function public.log_fin(p_kind text, p_amount numeric, p_category text default 'Otros',
  p_description text default null, p_goal_id uuid default null, p_date date default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_day date := coalesce(p_date, public.app_today()); v_xp int := 0; v_saved numeric; v_target numeric;
begin
  if p_kind not in ('ingreso','gasto','ahorro') then raise exception 'Tipo inválido'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'El monto debe ser mayor a 0'; end if;
  if v_day > public.app_today() then raise exception 'La fecha no puede ser futura'; end if;
  if p_goal_id is not null then
    if p_kind <> 'ahorro' then raise exception 'Solo los ahorros se asignan a una meta'; end if;
    if not exists (select 1 from public.fin_goals where id = p_goal_id and user_id = auth.uid()) then
      raise exception 'Meta no encontrada';
    end if;
  end if;

  insert into public.fin_transactions (user_id, kind, amount, category, description, goal_id, occurred_on)
  values (auth.uid(), p_kind, round(p_amount, 2), coalesce(nullif(btrim(p_category), ''), 'Otros'),
          nullif(left(btrim(coalesce(p_description,'')), 120), ''), p_goal_id, v_day);

  v_xp := public.claim_xp('fin:first:' || public.app_today(), 'finanzas', 5);
  if p_kind = 'ahorro' then v_xp := v_xp + public.claim_xp('fin:save:' || public.app_today(), 'finanzas', 15); end if;
  if p_goal_id is not null then
    select sum(amount) into v_saved from public.fin_transactions where goal_id = p_goal_id and user_id = auth.uid();
    select target_amount into v_target from public.fin_goals where id = p_goal_id;
    if v_saved >= v_target then v_xp := v_xp + public.claim_xp('goal:' || p_goal_id, 'finanzas', 100); end if;
  end if;
  return jsonb_build_object('xp_awarded', v_xp);
end $$;

-- Genera los movimientos periódicos vencidos (la app lo llama al abrir Finanzas). Devuelve cuántos creó.
create or replace function public.apply_recurring() returns int
language plpgsql security definer set search_path = public as $$
declare r public.fin_recurring; v_n int := 0; v_today date := public.app_today(); v_guard int;
begin
  for r in select * from public.fin_recurring where user_id = auth.uid() and active and next_on <= v_today loop
    v_guard := 0;
    while r.next_on <= v_today and v_guard < 60 loop
      insert into public.fin_transactions (user_id, kind, amount, category, description, occurred_on, from_recurring)
      values (auth.uid(), r.kind, r.amount, r.category, r.description, r.next_on, r.id);
      v_n := v_n + 1; v_guard := v_guard + 1;
      r.next_on := case r.every
        when 'semanal' then r.next_on + 7
        when 'quincenal' then r.next_on + 15
        else (r.next_on + interval '1 month')::date end;
    end loop;
    update public.fin_recurring set next_on = r.next_on where id = r.id;
  end loop;
  return v_n;
end $$;

-- 6) RACHA y MÉTRICAS: ahora cuentan los 4 pilares ---------------------------
create or replace function public.compute_streak(p_uid uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.app_today(); v_last date; v_n int;
begin
  with days as (
    select performed_at::date d from public.habit_logs where user_id = p_uid
    union select performed_at::date from public.workout_sets where user_id = p_uid
    union select logged_on from public.water_logs where user_id = p_uid
    union select slept_on from public.sleep_logs where user_id = p_uid
    union select logged_on from public.meals where user_id = p_uid
    union select studied_on from public.edu_sessions where user_id = p_uid
    union select occurred_on from public.fin_transactions where user_id = p_uid and from_recurring is null
  ), grp as (
    select d, d - (row_number() over (order by d))::int as g from days
  )
  select (select max(d) from grp),
         (select count(*) from grp where g = (select g from grp order by d desc limit 1))
    into v_last, v_n;
  if v_last is null or v_last < v_today - 1 then return 0; end if;
  return v_n;
end $$;

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
    'sets',     (select count(*) from public.workout_sets where user_id=p_uid),
    'friends',  v_friends,
    'habits_vitalidad', (select count(*) from public.habit_logs where user_id=p_uid and pillar='vitalidad'),
    'habits_intelecto', (select count(*) from public.habit_logs where user_id=p_uid and pillar='intelecto'),
    'habits_finanzas',  (select count(*) from public.habit_logs where user_id=p_uid and pillar='finanzas'),
    -- métricas nuevas
    'workouts',      (select count(distinct performed_at) from public.workout_sets where user_id=p_uid),
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

insert into public.achievements (id, name, description, icon, metric, target, reward_coins, sort) values
 ('gym_10',     'Fiel al hierro',      'Entrena 10 días distintos',               '🏋️', 'workouts',    10,  60, 23),
 ('gym_50',     'Veterano del gym',    'Entrena 50 días distintos',               '🦾', 'workouts',    50,  200, 24),
 ('water_7',    'Bien hidratado',      'Cumple tu meta de agua 7 días',           '💧', 'water_goals', 7,   50, 73),
 ('water_30',   'Río constante',       'Cumple tu meta de agua 30 días',          '🌊', 'water_goals', 30,  200, 74),
 ('sleep_7',    'Descanso reparador',  'Cumple tu meta de sueño 7 días',          '😴', 'sleep_goals', 7,   50, 75),
 ('meals_14',   'Plato consciente',    'Registra comidas 14 días',                '🥗', 'meal_days',   14,  70, 76),
 ('study_10h',  'Estudiante',          'Acumula 10 horas de estudio',             '📖', 'study_hours', 10,  60, 80),
 ('study_50h',  'Erudito',             'Acumula 50 horas de estudio',             '🎓', 'study_hours', 50,  200, 81),
 ('study_100h', 'Maestro del foco',    'Acumula 100 horas de estudio',            '🧙', 'study_hours', 100, 400, 82),
 ('tasks_10',   'Al día con todo',     'Completa 10 tareas académicas',           '✅', 'study_tasks', 10,  50, 83),
 ('fin_14',     'Cuentas claras',      'Registra finanzas 14 días',               '🧾', 'fin_days',    14,  70, 90),
 ('goal_1',     'Meta cumplida',       'Completa tu primera meta de ahorro',      '🏁', 'goals_done',  1,   150, 91)
on conflict (id) do update set name=excluded.name, description=excluded.description, icon=excluded.icon,
  metric=excluded.metric, target=excluded.target, reward_coins=excluded.reward_coins, sort=excluded.sort;

-- 7) PERMISOS ------------------------------------------------------------------
revoke all on function public.compute_streak(uuid), public.user_metrics(uuid) from public, anon, authenticated;

revoke all on function
  public.log_workout_entry(uuid, numeric, int, int, int, int, text),
  public.delete_workout_set(uuid), public.save_workout_session(int),
  public.log_water(int), public.log_sleep(date, time, time, numeric, int),
  public.log_meal(text, text, text, int, numeric, numeric, numeric),
  public.log_study_session(text, text, text, int), public.set_task_done(uuid, boolean),
  public.log_fin(text, numeric, text, text, uuid, date), public.apply_recurring()
  from public, anon;
grant execute on function
  public.log_workout_entry(uuid, numeric, int, int, int, int, text),
  public.delete_workout_set(uuid), public.save_workout_session(int),
  public.log_water(int), public.log_sleep(date, time, time, numeric, int),
  public.log_meal(text, text, text, int, numeric, numeric, numeric),
  public.log_study_session(text, text, text, int), public.set_task_done(uuid, boolean),
  public.log_fin(text, numeric, text, text, uuid, date), public.apply_recurring()
  to authenticated;

commit;

notify pgrst, 'reload schema';
