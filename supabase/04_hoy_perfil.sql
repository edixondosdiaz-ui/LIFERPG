-- Ejecutar manualmente DESPUÉS de las migraciones existentes, incluida 03_pilares.sql.
-- Solo agrega estructura y funciones. No migra, borra ni actualiza datos existentes.
begin;
create index if not exists workout_sets_user_created on public.workout_sets(user_id, created_at);

create table if not exists public.app_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  units text not null default 'km' check (units in ('km','mi')),
  profile_visibility text not null default 'friends' check (profile_visibility in ('public','friends')),
  notifications boolean not null default false
);
alter table public.app_preferences enable row level security;
create policy app_preferences_own on public.app_preferences for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.app_preferences to authenticated;

create table if not exists public.app_product_settings (
  id boolean primary key default true check (id),
  free_name_changes integer not null default 1 check (free_name_changes >= 0)
);
-- Ajustar este valor aquí antes de ejecutar, o desde SQL Editor como dueño.
insert into public.app_product_settings(id, free_name_changes) values (true, 1) on conflict do nothing;
alter table public.app_product_settings enable row level security;
revoke all on public.app_product_settings from anon, authenticated;

create table if not exists public.username_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now()
);
create index if not exists username_changes_user on public.username_changes(user_id);
alter table public.username_changes enable row level security;
create policy username_changes_own on public.username_changes for select to authenticated using (user_id = auth.uid());
revoke all on public.username_changes from anon, authenticated;
grant select on public.username_changes to authenticated;

create function public.my_name_changes() returns integer
language sql stable security definer set search_path = public as $$
  select greatest(0, (select free_name_changes from public.app_product_settings where id)
    - (select count(*)::int from public.username_changes where user_id = auth.uid()))
$$;

-- Protege también los caminos anteriores de actualización de username.
create function public.guard_username_change() returns trigger
language plpgsql set search_path = public as $$
begin
  if old.onboarding_completed and new.username is distinct from old.username
    and coalesce(current_setting('liferpg.rename_user', true), '') <> old.id::text then
    raise exception 'Usa la función de cambio de usuario';
  end if;
  return new;
end $$;
create trigger guard_username_change before update on public.profiles
for each row execute function public.guard_username_change();

create function public.change_my_username(p_username text) returns void
language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(p_username)); old_name text;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  select username into old_name from public.profiles where id = auth.uid() for update;
  if u = old_name then return; end if;
  if u is null or u !~ '^[a-z0-9_]{3,20}$' or u in ('admin','administrador','soporte','support','liferpg','moderador','root') then
    raise exception 'Usa 3 a 20 letras minúsculas, números o guion bajo; sin nombres reservados';
  end if;
  if public.my_name_changes() < 1 then raise exception 'No tienes cambios disponibles'; end if;
  perform set_config('liferpg.rename_user', auth.uid()::text, true);
  update public.profiles set username = u where id = auth.uid();
  insert into public.username_changes(user_id) values (auth.uid());
exception when unique_violation then raise exception 'Ese usuario ya está en uso';
end $$;

create table if not exists public.wellbeing_logs (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  logged_on date not null default public.app_today(),
  energy smallint not null check (energy between 1 and 10),
  stress smallint not null check (stress between 1 and 10),
  fatigue smallint not null check (fatigue between 1 and 10),
  primary key(user_id, logged_on)
);
alter table public.wellbeing_logs enable row level security;
create policy wellbeing_own on public.wellbeing_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on public.wellbeing_logs to authenticated;

-- Estado de temporizadores: el cliente solo puede leer; el reloj y las transiciones son del servidor.
create table if not exists public.active_timers (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('workout','study','break')),
  running_since timestamptz,
  elapsed_seconds integer not null default 0 check (elapsed_seconds >= 0),
  config jsonb not null default '{}'::jsonb,
  primary key(user_id, kind)
);
alter table public.active_timers enable row level security;
create policy active_timers_own on public.active_timers for select to authenticated using (user_id = auth.uid());
revoke all on public.active_timers from anon, authenticated;
grant select on public.active_timers to authenticated;

create function public.timer_action(p_kind text, p_action text, p_config jsonb default '{}'::jsonb) returns jsonb
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
        'volume', (select coalesce(sum(weight_kg*reps),0) from public.workout_sets where user_id=auth.uid() and created_at >= (t.config->>'started_at')::timestamptz),
        'personal_records', (select count(distinct s.exercise_id) from public.workout_sets s
          where s.user_id=auth.uid() and s.created_at >= (t.config->>'started_at')::timestamptz
          and s.weight_kg > (select max(old.weight_kg) from public.workout_sets old where old.user_id=auth.uid() and old.exercise_id=s.exercise_id and old.created_at < (t.config->>'started_at')::timestamptz)));
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

-- Datos agregados propios, sin exponer información de otros usuarios.
create function public.my_activity() returns table("day" date, pillar text, entries bigint)
language sql stable security definer set search_path = public as $$
  with activity as (
    select performed_at::date AS "day", pillar from public.habit_logs where user_id = auth.uid()
    union all select performed_at::date, 'fuerza' from public.workout_sets where user_id = auth.uid()
    union all select logged_on, 'vitalidad' from public.water_logs where user_id = auth.uid()
    union all select slept_on, 'vitalidad' from public.sleep_logs where user_id = auth.uid()
    union all select logged_on, 'vitalidad' from public.meals where user_id = auth.uid()
    union all select studied_on, 'intelecto' from public.edu_sessions where user_id = auth.uid()
    union all select occurred_on, 'finanzas' from public.fin_transactions where user_id = auth.uid() and from_recurring is null
    union all select logged_on, 'vitalidad' from public.wellbeing_logs where user_id = auth.uid()
    union all select performed_at, 'fuerza' from public.workout_sessions where user_id = auth.uid()
    union all select (done_at at time zone 'America/Bogota')::date, 'intelecto' from public.edu_tasks where user_id = auth.uid() and done
  ) select "day", pillar, count(*) from activity where "day" between public.app_today()-89 and public.app_today()
    group by "day",pillar order by "day" desc
$$;

create function public.my_current_streak() returns integer
language sql stable security definer set search_path = public as $$
  with days as (
    select performed_at::date d from public.habit_logs where user_id=auth.uid()
    union select performed_at::date from public.workout_sets where user_id=auth.uid()
    union select performed_at from public.workout_sessions where user_id=auth.uid()
    union select logged_on from public.water_logs where user_id=auth.uid()
    union select slept_on from public.sleep_logs where user_id=auth.uid()
    union select logged_on from public.meals where user_id=auth.uid()
    union select studied_on from public.edu_sessions where user_id=auth.uid()
    union select occurred_on from public.fin_transactions where user_id=auth.uid() and from_recurring is null
    union select logged_on from public.wellbeing_logs where user_id=auth.uid()
    union select (done_at at time zone 'America/Bogota')::date from public.edu_tasks where user_id=auth.uid() and done
  ), numbered as (
    select d, d-(row_number() over(order by d))::int g from days where d<=public.app_today()
  ) select case when max(d)>=public.app_today()-1 then
    (select count(*)::int from numbered where g=(select g from numbered order by d desc limit 1)) else 0 end from numbered
$$;

create function public.my_profile_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; g int; f int;
begin
  select * into me from public.profiles where id = auth.uid();
  if not found then raise exception 'Sesión no válida'; end if;
  select count(*)+1 into g from public.profiles where onboarding_completed and xp > me.xp;
  select count(*)+1 into f from public.profiles p where p.xp > me.xp and exists (
    select 1 from public.friendships r where r.status='accepted' and
      ((r.requester_id=me.id and r.addressee_id=p.id) or (r.addressee_id=me.id and r.requester_id=p.id)));
  return public.user_metrics(me.id) || jsonb_build_object('global_rank',g,'friends_rank',f,'name_changes',public.my_name_changes());
end $$;

-- El perfil de amigos existente sigue siendo privado. Esta nueva función permite
-- únicamente la misma respuesta segura para perfiles que opten por ser públicos.
create function public.visible_profile(p_username text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  select * into p from public.profiles where username=lower(trim(regexp_replace(p_username,'^@',''))) and onboarding_completed;
  if not found then raise exception 'Perfil no disponible'; end if;
  if exists(select 1 from public.app_preferences where user_id=p.id and profile_visibility='public') then
    return jsonb_build_object('username',p.username,'avatar',p.avatar,'display_name',p.display_name,
      'xp',p.xp,'pillar_xp',p.pillar_xp,'member_since',p.created_at,
      'streak',public.compute_streak(p.id),
      'habits',(select count(*) from public.habit_logs where user_id=p.id),
      'sets',(select count(*) from public.workout_sets where user_id=p.id),
      'achievements',(select count(*) from public.user_achievements where user_id=p.id),
      'equipped',coalesce((select jsonb_agg(s.data) from public.inventory i join public.shop_items s on s.id=i.item_id where i.user_id=p.id and i.equipped),'[]'::jsonb));
  end if;
  return public.get_friend_profile(p_username);
end $$;

-- Crea la meta inicial solo para quien todavía no tiene ajustes. Conserva las existentes.
create function public.log_water_quick(p_ml integer) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  insert into public.pillar_settings(user_id, water_goal_ml) values(auth.uid(),2000) on conflict do nothing;
  return public.log_water(p_ml);
end $$;

-- Esta función NO se ejecuta al aplicar el archivo. Solo al confirmar desde Configuración.
create function public.delete_my_account(p_confirmation text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_confirmation is distinct from 'ELIMINAR' then raise exception 'Confirmación inválida'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.my_name_changes(), public.change_my_username(text), public.timer_action(text,text,jsonb),
  public.my_activity(), public.my_current_streak(), public.my_profile_summary(), public.visible_profile(text), public.delete_my_account(text), public.log_water_quick(integer) from public, anon;
grant execute on function public.my_name_changes(), public.change_my_username(text), public.timer_action(text,text,jsonb),
  public.my_activity(), public.my_current_streak(), public.my_profile_summary(), public.visible_profile(text), public.delete_my_account(text), public.log_water_quick(integer) to authenticated;
notify pgrst, 'reload schema';
commit;
