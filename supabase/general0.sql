-- 1. TABLAS -----------------------------------------------------------
 
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  xp           integer not null default 0 check (xp >= 0),
  pillar_xp    jsonb   not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
 
create table if not exists public.exercises (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  weekday    smallint not null check (weekday between 1 and 7),   -- 1 = lunes ... 7 = domingo
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);
create index if not exists exercises_user_weekday_idx on public.exercises (user_id, weekday);
 
create table if not exists public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id) on delete cascade,
  weight_kg    numeric(6,2) not null check (weight_kg >= 0 and weight_kg <= 1000),
  reps         integer not null check (reps between 1 and 200),
  overload     boolean not null default false,
  performed_at date not null default ((now() at time zone 'America/Bogota')::date),
  created_at   timestamptz not null default now()
);
create index if not exists workout_sets_exercise_day_idx on public.workout_sets (exercise_id, performed_at);
 
create table if not exists public.habit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  pillar       text not null check (pillar in ('vitalidad', 'intelecto', 'finanzas')),
  habit        text not null check (char_length(btrim(habit)) between 1 and 60),
  xp_awarded   integer not null,
  performed_at date not null default ((now() at time zone 'America/Bogota')::date),
  created_at   timestamptz not null default now()
);
create index if not exists habit_logs_user_day_idx on public.habit_logs (user_id, performed_at);
 
-- 2. SEGURIDAD (RLS): cada usuario solo ve lo suyo ----------------------
-- profiles, workout_sets y habit_logs: solo lectura desde la app.
-- Se escriben únicamente a través de las funciones de la sección 4,
-- así nadie puede ponerse XP a mano desde el navegador.
 
alter table public.profiles     enable row level security;
alter table public.exercises    enable row level security;
alter table public.workout_sets enable row level security;
alter table public.habit_logs   enable row level security;
 
drop policy if exists "profiles: leer el propio"   on public.profiles;
drop policy if exists "exercises: todo lo propio"  on public.exercises;
drop policy if exists "sets: leer los propios"     on public.workout_sets;
drop policy if exists "habits: leer los propios"   on public.habit_logs;
 
create policy "profiles: leer el propio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
 
create policy "exercises: todo lo propio" on public.exercises
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
 
create policy "sets: leer los propios" on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid()));
 
create policy "habits: leer los propios" on public.habit_logs
  for select to authenticated using (user_id = (select auth.uid()));
 
-- 3. PERFIL AUTOMÁTICO AL REGISTRARSE ------------------------------------
 
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(coalesce(new.email, ''), '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;
 
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
 
-- Perfiles para usuarios que ya existían antes de este script
insert into public.profiles (id, display_name)
select id, split_part(coalesce(email, ''), '@', 1) from auth.users
on conflict (id) do nothing;
 
-- 4. FUNCIONES (aquí vive la lógica del XP) --------------------------------
 
-- Interna: suma XP al total y al pilar. La app NO puede llamarla directamente.
create or replace function public.add_xp(p_user uuid, p_pillar text, p_xp integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.profiles (id, xp, pillar_xp)
  values (p_user, p_xp, jsonb_build_object(p_pillar, p_xp))
  on conflict (id) do update set
    xp = public.profiles.xp + excluded.xp,
    pillar_xp = jsonb_set(
      public.profiles.pillar_xp,
      array[p_pillar],
      to_jsonb(coalesce((public.profiles.pillar_xp ->> p_pillar)::integer, 0) + excluded.xp),
      true
    );
$$;
revoke all on function public.add_xp(uuid, text, integer) from public, anon, authenticated;
 
-- Registrar un hábito: +20 XP
create or replace function public.log_habit(p_pillar text, p_habit text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_xp  integer := 20;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if p_pillar is null or p_pillar not in ('vitalidad', 'intelecto', 'finanzas') then
    raise exception 'Pilar inválido';
  end if;
  if p_habit is null or char_length(btrim(p_habit)) not between 1 and 60 then
    raise exception 'Hábito inválido';
  end if;
 
  insert into public.habit_logs (user_id, pillar, habit, xp_awarded)
  values (v_uid, p_pillar, btrim(p_habit), v_xp);
 
  perform public.add_xp(v_uid, p_pillar, v_xp);
 
  return jsonb_build_object('xp_awarded', v_xp);
end;
$$;
revoke all on function public.log_habit(text, text) from public, anon;
grant execute on function public.log_habit(text, text) to authenticated;
 
-- Registrar una serie: +5 XP, y +10 más si supera tu mejor serie de sesiones
-- anteriores (más peso, o el mismo peso con más repeticiones).
-- El bonus se da una sola vez por ejercicio y por día.
create or replace function public.log_set(p_exercise_id uuid, p_weight_kg numeric, p_reps integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_today    date := (now() at time zone 'America/Bogota')::date;
  v_w        numeric := round(p_weight_kg, 2);
  v_prev_w   numeric;
  v_prev_r   integer;
  v_overload boolean := false;
  v_xp       integer := 5;
  v_id       uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;
  if v_w is null or v_w < 0 or v_w > 1000 then
    raise exception 'Peso inválido';
  end if;
  if p_reps is null or p_reps < 1 or p_reps > 200 then
    raise exception 'Repeticiones inválidas';
  end if;
  if not exists (
    select 1 from public.exercises where id = p_exercise_id and user_id = v_uid
  ) then
    raise exception 'Ejercicio no encontrado';
  end if;
 
  select max(s.weight_kg) into v_prev_w
    from public.workout_sets s
   where s.exercise_id = p_exercise_id and s.user_id = v_uid and s.performed_at < v_today;
 
  if v_prev_w is not null then
    select max(s.reps) into v_prev_r
      from public.workout_sets s
     where s.exercise_id = p_exercise_id and s.user_id = v_uid
       and s.performed_at < v_today and s.weight_kg = v_prev_w;
 
    v_overload := v_w > v_prev_w or (v_w = v_prev_w and p_reps > v_prev_r);
  end if;
 
  if v_overload and exists (
    select 1 from public.workout_sets s
     where s.exercise_id = p_exercise_id and s.user_id = v_uid
       and s.performed_at = v_today and s.overload
  ) then
    v_overload := false;
  end if;
 
  if v_overload then
    v_xp := v_xp + 10;
  end if;
 
  insert into public.workout_sets (user_id, exercise_id, weight_kg, reps, overload)
  values (v_uid, p_exercise_id, v_w, p_reps, v_overload)
  returning id into v_id;
 
  perform public.add_xp(v_uid, 'fuerza', v_xp);
 
  return jsonb_build_object('id', v_id, 'overload', v_overload, 'xp_awarded', v_xp);
end;
$$;
revoke all on function public.log_set(uuid, numeric, integer) from public, anon;
grant execute on function public.log_set(uuid, numeric, integer) to authenticated;