begin;

-- Tablas existentes: columnas nuevas
alter table profiles add column if not exists username text;
alter table profiles add column if not exists country text;
create unique index if not exists profiles_username_key on profiles (lower(username));
alter table workout_sets add column if not exists rpe smallint check (rpe between 1 and 10);
alter table workout_sets add column if not exists rest_seconds int check (rest_seconds >= 0);
alter table workout_sets add column if not exists notes text;

-- Fuerza: rutinas
create table if not exists routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
alter table exercises add column if not exists routine_id uuid references routines(id) on delete set null;

-- Salud: agua (ml), sueño (horas), energía / bienestar / recuperación / fatiga (1-10)
create table if not exists health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('water','sleep','energy','wellbeing','recovery','fatigue')),
  value numeric not null check (value >= 0),
  bed_time time, wake_time time, note text,
  logged_on date not null default ((now() at time zone 'America/Bogota')::date),
  created_at timestamptz not null default now()
);
create index if not exists health_logs_user_kind_day on health_logs (user_id, kind, logged_on desc);

-- Educación
create table if not exists study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  minutes int not null check (minutes between 1 and 600),
  note text,
  studied_on date not null default ((now() at time zone 'America/Bogota')::date),
  created_at timestamptz not null default now()
);
create index if not exists study_sessions_user_day on study_sessions (user_id, studied_on desc);

-- Finanzas
create table if not exists finance_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  created_at timestamptz not null default now()
);
create table if not exists finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense','saving')),
  amount numeric(14,2) not null check (amount > 0),
  category text, note text,
  goal_id uuid references finance_goals(id) on delete set null,
  occurred_on date not null default ((now() at time zone 'America/Bogota')::date),
  created_at timestamptz not null default now()
);
create index if not exists finance_entries_user_day on finance_entries (user_id, occurred_on desc);

-- Amigos (rechazar = borrar la fila)
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- Seguridad: cada quien ve y edita solo lo suyo
do $$ declare t text; begin
  foreach t in array array['routines','health_logs','study_sessions','finance_goals','finance_entries'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
alter table friendships enable row level security;
drop policy if exists "friends read" on friendships;
drop policy if exists "friends request" on friendships;
drop policy if exists "friends accept" on friendships;
drop policy if exists "friends delete" on friendships;
create policy "friends read" on friendships for select to authenticated using (auth.uid() in (requester_id, addressee_id));
create policy "friends request" on friendships for insert to authenticated with check (requester_id = auth.uid() and status = 'pending');
create policy "friends accept" on friendships for update to authenticated using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy "friends delete" on friendships for delete to authenticated using (auth.uid() in (requester_id, addressee_id));

-- XP: solo se otorga desde las funciones de abajo (el cliente no puede llamarla directo)
create or replace function award_xp(p_pillar text, p_xp int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_xp <= 0 then return; end if;
  update profiles set
    xp = coalesce(xp, 0) + p_xp,
    pillar_xp = jsonb_set(coalesce(pillar_xp, '{}'::jsonb), array[p_pillar],
                to_jsonb(coalesce((pillar_xp->>p_pillar)::int, 0) + p_xp), true)
  where id = auth.uid();
end $$;
revoke all on function award_xp(text, int) from public, anon, authenticated;

-- Fuerza: XP según volumen movido (+10 si superas tu mejor serie anterior)
create or replace function log_workout_set(p_exercise_id uuid, p_weight_kg numeric, p_reps int,
  p_rpe smallint default null, p_rest_seconds int default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'America/Bogota')::date;
  v_vol numeric := p_weight_kg * p_reps;
  v_best numeric; v_over boolean; v_xp int;
begin
  if not exists (select 1 from exercises where id = p_exercise_id and user_id = auth.uid()) then
    raise exception 'Ejercicio no encontrado';
  end if;
  if p_weight_kg < 0 or p_reps < 1 then raise exception 'Peso o repeticiones inválidos'; end if;
  select max(weight_kg * reps) into v_best from workout_sets
    where exercise_id = p_exercise_id and user_id = auth.uid() and performed_at < v_day;
  v_over := v_best is not null and v_vol > v_best;
  v_xp := 5 + least(40, floor(v_vol / 100)::int) + case when v_over then 10 else 0 end;
  insert into workout_sets (user_id, exercise_id, weight_kg, reps, rpe, rest_seconds, notes, performed_at)
    values (auth.uid(), p_exercise_id, p_weight_kg, p_reps, p_rpe, p_rest_seconds, p_notes, v_day);
  perform award_xp('fuerza', v_xp);
  return jsonb_build_object('xp_awarded', v_xp, 'overload', v_over, 'volume', v_vol);
end $$;

-- Salud: 10 XP por tipo de registro y día (consistencia, no cantidad)
create or replace function log_health(p_kind text, p_value numeric default null,
  p_bed time default null, p_wake time default null, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'America/Bogota')::date;
  v_val numeric := p_value; v_first boolean; v_xp int;
begin
  if p_kind = 'sleep' and p_bed is not null and p_wake is not null then
    v_val := round((extract(epoch from (p_wake - p_bed + case when p_wake <= p_bed then interval '24 hours' else interval '0' end)) / 3600)::numeric, 2);
  end if;
  if v_val is null then raise exception 'Falta el valor'; end if;
  if p_kind in ('energy','wellbeing','recovery','fatigue') and v_val not between 1 and 10 then
    raise exception 'La escala va de 1 a 10';
  end if;
  v_first := not exists (select 1 from health_logs where user_id = auth.uid() and kind = p_kind and logged_on = v_day);
  insert into health_logs (user_id, kind, value, bed_time, wake_time, note, logged_on)
    values (auth.uid(), p_kind, v_val, p_bed, p_wake, p_note, v_day);
  v_xp := case when v_first then 10 else 0 end;
  perform award_xp('vitalidad', v_xp);
  return jsonb_build_object('xp_awarded', v_xp, 'value', v_val);
end $$;

-- Educación: 1 XP cada 2 minutos (máx. 120 por sesión)
create or replace function log_study(p_category text, p_minutes int, p_note text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_xp int := least(120, greatest(1, p_minutes / 2));
begin
  insert into study_sessions (user_id, category, minutes, note) values (auth.uid(), p_category, p_minutes, p_note);
  perform award_xp('intelecto', v_xp);
  return jsonb_build_object('xp_awarded', v_xp);
end $$;

-- Finanzas: 5 XP por el primer movimiento del día, 15 XP por cada ahorro
create or replace function log_finance(p_kind text, p_amount numeric, p_category text default null,
  p_note text default null, p_goal_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_day date := (now() at time zone 'America/Bogota')::date; v_xp int;
begin
  v_xp := case when p_kind = 'saving' then 15
               when not exists (select 1 from finance_entries where user_id = auth.uid() and occurred_on = v_day) then 5
               else 0 end;
  insert into finance_entries (user_id, kind, amount, category, note, goal_id)
    values (auth.uid(), p_kind, p_amount, p_category, p_note, p_goal_id);
  perform award_xp('finanzas', v_xp);
  return jsonb_build_object('xp_awarded', v_xp);
end $$;

-- Ranking global (solo nombre y XP; no expone correos)
create or replace view leaderboard as
  select id, coalesce(nullif(username, ''), nullif(display_name, ''), 'Jugador') as name, coalesce(xp, 0) as xp
  from profiles;
revoke all on leaderboard from anon;
grant select on leaderboard to authenticated;

commit;