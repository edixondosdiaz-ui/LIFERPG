-- =====================================================================
-- LifeRPG · Migración v2  (ejecutar completa en Supabase → SQL Editor)
-- Es idempotente: se puede correr varias veces sin perder datos.
-- Requiere que ya exista 01_modulos.sql (profiles, habit_logs,
-- exercises, workout_sets y las funciones log_habit / log_workout_set).
-- =====================================================================

-- 0) Verificación previa: falla con un mensaje claro si falta algo ------
do $$
declare t text;
begin
  foreach t in array array['habit_logs','exercises','workout_sets'] loop
    if not exists (select 1 from information_schema.columns
                   where table_schema='public' and table_name=t and column_name='user_id') then
      raise exception 'La tabla % no tiene columna user_id. Revisa 01_modulos.sql antes de continuar.', t;
    end if;
  end loop;
  if not exists (select 1 from information_schema.tables where table_schema='public' and table_name='profiles') then
    raise exception 'No existe public.profiles. Ejecuta primero 01_modulos.sql.';
  end if;
end $$;

-- 1) PERFILES: usuario único, avatar, monedas, onboarding ---------------
alter table public.profiles
  add column if not exists username text,
  add column if not exists avatar jsonb not null default '{}'::jsonb,
  add column if not exists coins integer not null default 0,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

alter table public.profiles add column if not exists display_name text;
alter table public.profiles alter column display_name drop not null;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');
create unique index if not exists profiles_username_key on public.profiles (lower(username));
create index if not exists profiles_username_search on public.profiles (username text_pattern_ops);

alter table public.profiles enable row level security;
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using (auth.uid() = id);

-- Zona horaria de la app (mismo valor que src/services/api.js)
create or replace function public.app_today() returns date
language sql stable as $$ select (now() at time zone 'America/Bogota')::date $$;

-- 2) RACHA y MÉTRICAS ---------------------------------------------------
create or replace function public.compute_streak(p_uid uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare v_today date := public.app_today(); v_last date; v_n int;
begin
  -- Una sola consulta: los CTE solo viven dentro de la sentencia que los define
  with days as (
    select performed_at::date d from public.habit_logs where user_id = p_uid
    union
    select performed_at::date d from public.workout_sets where user_id = p_uid
  ), grp as (
    select d, d - (row_number() over (order by d))::int as g from days
  )
  select (select max(d) from grp),
         (select count(*) from grp where g = (select g from grp order by d desc limit 1))
    into v_last, v_n;

  -- La racha sigue viva si la última actividad fue hoy o ayer
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
    'habits_finanzas',  (select count(*) from public.habit_logs where user_id=p_uid and pillar='finanzas')
  ) into v_res;
  return v_res;
end $$;

create or replace function public.get_streak() returns int
language sql stable security definer set search_path = public as $$
  select public.compute_streak(auth.uid())
$$;

-- 3) AMISTADES ----------------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_addressee on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
drop policy if exists friendships_select_own on public.friendships;
create policy friendships_select_own on public.friendships for select
  using (auth.uid() in (requester_id, addressee_id));
-- Sin políticas de insert/update/delete: todo pasa por las funciones de abajo.

create or replace function public.search_users(p_query text)
returns table (id uuid, username text, display_name text, avatar jsonb, xp int, relation text)
language plpgsql stable security definer set search_path = public as $$
declare q text := lower(trim(coalesce(p_query,'')));
begin
  q := regexp_replace(q, '^@', '');
  if length(q) < 2 then return; end if;
  return query
  select p.id, p.username, p.display_name, p.avatar, coalesce(p.xp,0)::int,
    case
      when f.id is null then 'none'
      when f.status = 'accepted' then 'friend'
      when f.requester_id = auth.uid() then 'sent'
      else 'received'
    end
  from public.profiles p
  left join public.friendships f
    on least(f.requester_id, f.addressee_id) = least(p.id, auth.uid())
   and greatest(f.requester_id, f.addressee_id) = greatest(p.id, auth.uid())
  where p.onboarding_completed and p.username is not null
    and p.id <> auth.uid()
    and p.username like replace(replace(q,'_','\_'),'%','\%') || '%'
  order by (p.username = q) desc, p.username
  limit 20;
end $$;

create or replace function public.send_friend_request(p_username text) returns text
language plpgsql security definer set search_path = public as $$
declare v_target uuid; v_f public.friendships;
begin
  select id into v_target from public.profiles
   where username = lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))) and onboarding_completed;
  if v_target is null then raise exception 'No existe ese usuario'; end if;
  if v_target = auth.uid() then raise exception 'No puedes agregarte a ti mismo'; end if;

  select * into v_f from public.friendships
   where least(requester_id, addressee_id) = least(auth.uid(), v_target)
     and greatest(requester_id, addressee_id) = greatest(auth.uid(), v_target);

  if found then
    if v_f.status = 'accepted' then return 'friend'; end if;
    if v_f.requester_id = auth.uid() then return 'sent'; end if;
    -- Ya te había enviado solicitud: se acepta automáticamente
    update public.friendships set status='accepted', responded_at=now() where id = v_f.id;
    return 'friend';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (auth.uid(), v_target);
  return 'sent';
end $$;

create or replace function public.respond_friend_request(p_friendship_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_accept then
    update public.friendships set status='accepted', responded_at=now()
     where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending';
  else
    delete from public.friendships
     where id = p_friendship_id and addressee_id = auth.uid() and status = 'pending';
  end if;
  if not found then raise exception 'Solicitud no encontrada'; end if;
end $$;

-- Sirve para eliminar amistad y para cancelar una solicitud enviada
create or replace function public.remove_friendship(p_friendship_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.friendships
   where id = p_friendship_id and auth.uid() in (requester_id, addressee_id);
  if not found then raise exception 'Amistad no encontrada'; end if;
end $$;

create or replace function public.list_friendships()
returns table (friendship_id uuid, user_id uuid, username text, display_name text, avatar jsonb, xp int, status text, direction text)
language sql stable security definer set search_path = public as $$
  select f.id, p.id, p.username, p.display_name, p.avatar, coalesce(p.xp,0)::int,
         f.status,
         case when f.status='accepted' then 'friend'
              when f.requester_id = auth.uid() then 'outgoing' else 'incoming' end
  from public.friendships f
  join public.profiles p on p.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id) and p.username is not null
  order by f.status, p.username
$$;

-- 4) TIENDA E INVENTARIO ------------------------------------------------
create table if not exists public.shop_items (
  id text primary key,
  category text not null check (category in ('ropa','accesorio','premium')),
  kind text not null,                       -- camiseta, sudadera, armadura, uniforme, gafas, mochila, reloj, marco, insignia, efecto
  name text not null,
  description text not null default '',
  rarity text not null default 'common' check (rarity in ('common','rare','epic','legendary')),
  price_coins integer not null default 0 check (price_coins >= 0),
  price_cents integer,                      -- reservado para pagos reales (Stripe / in-app)
  is_premium boolean not null default false,
  available boolean not null default true,
  data jsonb not null default '{}'::jsonb,  -- cómo se dibuja: {slot, style, color, ...}
  sort integer not null default 0
);

create table if not exists public.inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.shop_items(id) on delete cascade,
  equipped boolean not null default false,
  acquired_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- Libro de compras: hoy solo monedas; mañana aquí se guardan los pagos reales
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null references public.shop_items(id),
  price_coins integer not null default 0,
  price_cents integer,
  provider text not null default 'coins',   -- 'coins' | 'stripe' | 'apple' | 'google'
  provider_ref text,
  status text not null default 'completed',
  created_at timestamptz not null default now()
);

alter table public.shop_items enable row level security;
alter table public.inventory  enable row level security;
alter table public.purchases  enable row level security;
drop policy if exists shop_items_read on public.shop_items;
create policy shop_items_read on public.shop_items for select to authenticated using (available);
drop policy if exists inventory_select_own on public.inventory;
create policy inventory_select_own on public.inventory for select using (auth.uid() = user_id);
drop policy if exists purchases_select_own on public.purchases;
create policy purchases_select_own on public.purchases for select using (auth.uid() = user_id);

create or replace function public.buy_item(p_item_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_item public.shop_items; v_coins int;
begin
  select * into v_item from public.shop_items where id = p_item_id and available;
  if not found then raise exception 'Objeto no disponible'; end if;
  if exists (select 1 from public.inventory where user_id = auth.uid() and item_id = p_item_id) then
    raise exception 'Ya tienes este objeto';
  end if;
  if v_item.is_premium then
    raise exception 'Este objeto premium estará disponible próximamente';
  end if;
  select coins into v_coins from public.profiles where id = auth.uid() for update;
  if coalesce(v_coins,0) < v_item.price_coins then raise exception 'No tienes suficientes monedas'; end if;

  update public.profiles set coins = coins - v_item.price_coins where id = auth.uid();
  insert into public.inventory (user_id, item_id) values (auth.uid(), p_item_id);
  insert into public.purchases (user_id, item_id, price_coins) values (auth.uid(), p_item_id, v_item.price_coins);
  return jsonb_build_object('coins', v_coins - v_item.price_coins);
end $$;

create or replace function public.equip_item(p_item_id text, p_equip boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_slot text;
begin
  select s.data->>'slot' into v_slot
    from public.inventory i join public.shop_items s on s.id = i.item_id
   where i.user_id = auth.uid() and i.item_id = p_item_id;
  if not found then raise exception 'No tienes este objeto'; end if;
  if p_equip then
    update public.inventory i set equipped = false
      from public.shop_items s
     where i.item_id = s.id and i.user_id = auth.uid() and s.data->>'slot' = v_slot;
  end if;
  update public.inventory set equipped = p_equip where user_id = auth.uid() and item_id = p_item_id;
end $$;

-- 5) LOGROS -------------------------------------------------------------
create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null default '🏅',
  metric text not null,                     -- clave de user_metrics()
  target integer not null check (target > 0),
  reward_coins integer not null default 0,
  sort integer not null default 0
);
create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements for select to authenticated using (true);
drop policy if exists user_achievements_own on public.user_achievements;
create policy user_achievements_own on public.user_achievements for select using (auth.uid() = user_id);

-- Calcula el progreso, desbloquea lo que corresponda (y paga monedas una sola vez)
create or replace function public.my_achievements()
returns table (id text, name text, description text, icon text, target int, reward_coins int,
               progress int, unlocked boolean, unlocked_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare m jsonb := public.user_metrics(auth.uid()); rec record; v_prog int; v_rows int;
begin
  for rec in select * from public.achievements loop
    v_prog := coalesce((m ->> rec.metric)::int, 0);
    if v_prog >= rec.target then
      insert into public.user_achievements (user_id, achievement_id)
      values (auth.uid(), rec.id) on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows > 0 and rec.reward_coins > 0 then
        update public.profiles set coins = coins + rec.reward_coins where profiles.id = auth.uid();
      end if;
    end if;
  end loop;

  return query
  select a.id, a.name, a.description, a.icon, a.target, a.reward_coins,
         least(coalesce((m ->> a.metric)::int, 0), a.target),
         (ua.achievement_id is not null), ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua on ua.achievement_id = a.id and ua.user_id = auth.uid()
  order by (ua.achievement_id is not null) desc, a.sort;
end $$;

-- 6) ONBOARDING / IDENTIDAD --------------------------------------------
create or replace function public.username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from public.profiles
     where lower(username) = lower(trim(p_username)) and id <> auth.uid()
  )
$$;

create or replace function public.complete_onboarding(p_username text, p_display text, p_avatar jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare u text := lower(trim(coalesce(p_username,''))); v_was boolean;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if u !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'El usuario debe tener 3-20 caracteres: letras, números o guion bajo';
  end if;
  if u in ('admin','administrador','soporte','support','liferpg','moderador','root') then
    raise exception 'Ese nombre de usuario está reservado';
  end if;
  if not public.username_available(u) then raise exception 'Ese nombre de usuario ya está en uso'; end if;

  select coalesce(onboarding_completed,false) into v_was from public.profiles where id = auth.uid();

  insert into public.profiles (id, username, display_name, avatar, onboarding_completed, coins)
  values (auth.uid(), u, nullif(left(trim(coalesce(p_display,'')), 40), ''), coalesce(p_avatar,'{}'::jsonb), true, 150)
  on conflict (id) do update set
    username = excluded.username,
    display_name = excluded.display_name,
    avatar = excluded.avatar,
    onboarding_completed = true,
    coins = public.profiles.coins + case when coalesce(v_was,false) then 0 else 150 end;
exception when unique_violation then
  raise exception 'Ese nombre de usuario ya está en uso';
end $$;

create or replace function public.update_avatar(p_avatar jsonb) returns void
language sql security definer set search_path = public as $$
  update public.profiles set avatar = coalesce(p_avatar,'{}'::jsonb) where id = auth.uid()
$$;

create or replace function public.update_display_name(p_display text) returns void
language sql security definer set search_path = public as $$
  update public.profiles set display_name = nullif(left(trim(coalesce(p_display,'')), 40), '') where id = auth.uid()
$$;

-- 7) PERFIL DE AMIGO (solo si sois amigos o es el tuyo) ----------------
create or replace function public.get_friend_profile(p_username text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.profiles; v_is_friend boolean; m jsonb;
begin
  select * into p from public.profiles
   where username = lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))) and onboarding_completed;
  if not found then raise exception 'No existe ese usuario'; end if;

  select exists (select 1 from public.friendships f
     where f.status='accepted'
       and least(f.requester_id,f.addressee_id) = least(p.id, auth.uid())
       and greatest(f.requester_id,f.addressee_id) = greatest(p.id, auth.uid())) into v_is_friend;
  if p.id <> auth.uid() and not v_is_friend then
    raise exception 'Solo puedes ver el perfil de tus amigos';
  end if;

  m := public.user_metrics(p.id);
  return jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar', p.avatar,
    'xp', coalesce(p.xp,0), 'pillar_xp', coalesce(p.pillar_xp,'{}'::jsonb),
    'streak', m->'streak', 'habits', m->'habits', 'sets', m->'sets',
    'achievements', (select count(*) from public.user_achievements where user_id = p.id),
    'member_since', p.created_at,
    'equipped', coalesce((select jsonb_agg(s.data)
        from public.inventory i join public.shop_items s on s.id = i.item_id
       where i.user_id = p.id and i.equipped), '[]'::jsonb)
  );
end $$;

-- Objetos equipados propios (para dibujar tu avatar)
create or replace function public.my_equipped() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(s.data), '[]'::jsonb)
    from public.inventory i join public.shop_items s on s.id = i.item_id
   where i.user_id = auth.uid() and i.equipped
$$;

-- 8) RANKING: solo nombre de usuario real ------------------------------
drop view if exists public.leaderboard cascade;
create view public.leaderboard as
  select id, username, coalesce(xp,0)::int as xp, avatar
    from public.profiles
   where onboarding_completed and username is not null;
grant select on public.leaderboard to authenticated;

-- 9) FINANZAS · EDUCACIÓN · SALUD (tablas listas para sus módulos) -----
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ingreso','gasto','ahorro')),
  amount numeric(14,2) not null check (amount >= 0),
  category text not null default 'general',
  note text,
  performed_at date not null default public.app_today(),
  created_at timestamptz not null default now()
);
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(14,2) not null check (target_amount > 0),
  saved_amount numeric(14,2) not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);
create table if not exists public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subject text not null,
  minutes integer not null check (minutes > 0),
  kind text not null default 'estudio' check (kind in ('estudio','lectura','idioma','pomodoro')),
  performed_at date not null default public.app_today(),
  created_at timestamptz not null default now()
);
create table if not exists public.health_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  performed_at date not null default public.app_today(),
  water_ml integer check (water_ml >= 0),
  sleep_hours numeric(3,1) check (sleep_hours between 0 and 24),
  weight_kg numeric(5,2),
  energy smallint check (energy between 1 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, performed_at)
);
do $$
declare t text;
begin
  foreach t in array array['finance_entries','savings_goals','study_sessions','health_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_own', t);
  end loop;
end $$;

-- 10) PERMISOS de las funciones -----------------------------------------
revoke all on function
  public.compute_streak(uuid), public.user_metrics(uuid)
  from public, anon, authenticated;       -- internas: solo las usan otras funciones
grant execute on function
  public.get_streak(), public.search_users(text), public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean), public.remove_friendship(uuid),
  public.list_friendships(), public.buy_item(text), public.equip_item(text, boolean),
  public.my_achievements(), public.username_available(text),
  public.complete_onboarding(text, text, jsonb), public.update_avatar(jsonb),
  public.update_display_name(text), public.get_friend_profile(text), public.my_equipped()
  to authenticated;
revoke execute on function
  public.get_streak(), public.search_users(text), public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean), public.remove_friendship(uuid),
  public.list_friendships(), public.buy_item(text), public.equip_item(text, boolean),
  public.my_achievements(), public.username_available(text),
  public.complete_onboarding(text, text, jsonb), public.update_avatar(jsonb),
  public.update_display_name(text), public.get_friend_profile(text), public.my_equipped()
  from anon;

-- 11) DATOS INICIALES (logros y tienda) --------------------------------
insert into public.achievements (id, name, description, icon, metric, target, reward_coins, sort) values
 ('first_step',   'Primer paso',        'Registra tu primer hábito',            '🌱', 'habits',  1,   20, 10),
 ('habits_10',    'Constancia',         'Registra 10 hábitos',                  '✅', 'habits',  10,  30, 11),
 ('habits_50',    'Disciplinado',       'Registra 50 hábitos',                  '🎯', 'habits',  50,  80, 12),
 ('habits_200',   'Inquebrantable',     'Registra 200 hábitos',                 '🛡️', 'habits',  200, 250, 13),
 ('sets_10',      'Hierro inicial',     'Registra 10 series de fuerza',         '🏋️', 'sets',    10,  30, 20),
 ('sets_100',     'Rata de gimnasio',   'Registra 100 series de fuerza',        '💪', 'sets',    100, 100, 21),
 ('sets_500',     'Titán',              'Registra 500 series de fuerza',        '⚔️', 'sets',    500, 300, 22),
 ('streak_3',     'En marcha',          'Racha de 3 días',                      '🔥', 'streak',  3,   25, 30),
 ('streak_7',     'Semana perfecta',    'Racha de 7 días',                      '🔥', 'streak',  7,   60, 31),
 ('streak_30',    'Mes de hierro',      'Racha de 30 días',                     '⚡', 'streak',  30,  250, 32),
 ('streak_100',   'Leyenda',            'Racha de 100 días',                    '👑', 'streak',  100, 1000, 33),
 ('level_5',      'Nivel 5',            'Alcanza el nivel 5',                   '⭐', 'level',   5,   50, 40),
 ('level_10',     'Nivel 10',           'Alcanza el nivel 10',                  '🌟', 'level',   10,  150, 41),
 ('level_20',     'Nivel 20',           'Alcanza el nivel 20',                  '💎', 'level',   20,  400, 42),
 ('xp_1000',      'Mil de experiencia', 'Acumula 1.000 XP',                     '📈', 'xp',      1000, 50, 50),
 ('xp_10000',     'Diez mil de XP',     'Acumula 10.000 XP',                    '🚀', 'xp',      10000, 300, 51),
 ('friend_1',     'Aliado',             'Ten tu primer amigo',                  '🤝', 'friends', 1,   30, 60),
 ('friend_5',     'Círculo cercano',    'Ten 5 amigos',                         '👥', 'friends', 5,   100, 61),
 ('vital_25',     'Cuerpo en equilibrio','25 hábitos de Salud',                 '💚', 'habits_vitalidad', 25, 80, 70),
 ('mind_25',      'Mente afilada',      '25 hábitos de Educación',              '🧠', 'habits_intelecto', 25, 80, 71),
 ('money_25',     'Mano firme',         '25 hábitos de Finanzas',               '💰', 'habits_finanzas',  25, 80, 72)
on conflict (id) do update set name=excluded.name, description=excluded.description, icon=excluded.icon,
  metric=excluded.metric, target=excluded.target, reward_coins=excluded.reward_coins, sort=excluded.sort;

insert into public.shop_items (id, category, kind, name, description, rarity, price_coins, is_premium, data, sort) values
 ('top_tee_violet',  'ropa','camiseta','Camiseta Violeta',     'Algodón técnico, corte atlético.',        'common',    60, false, '{"slot":"top","style":"tee","color":"#7c3aed"}', 10),
 ('top_tee_ember',   'ropa','camiseta','Camiseta Brasa',       'Para los días de pierna.',                'common',    60, false, '{"slot":"top","style":"tee","color":"#e5484d"}', 11),
 ('top_hoodie_slate','ropa','sudadera','Sudadera Pizarra',     'Calentamiento y vuelta a casa.',          'rare',      140,false, '{"slot":"top","style":"hoodie","color":"#475569"}', 12),
 ('top_hoodie_sage', 'ropa','sudadera','Sudadera Salvia',      'Suave, ligera, siempre lista.',           'rare',      140,false, '{"slot":"top","style":"hoodie","color":"#4d7c6a"}', 13),
 ('top_armor_carbon','ropa','armadura','Chaleco Carbono',      'Armadura moderna de entrenamiento.',      'epic',      320,false, '{"slot":"top","style":"armor","color":"#1f2937","accent":"#a855f7"}', 14),
 ('top_uniform_club','ropa','uniforme','Uniforme de Club',     'Uniforme deportivo con bandas.',          'rare',      180,false, '{"slot":"top","style":"uniform","color":"#0ea5e9","accent":"#f8fafc"}', 15),
 ('face_glasses_round','accesorio','gafas','Gafas Redondas',   'Lectura y enfoque.',                      'common',    80, false, '{"slot":"face","style":"round","color":"#e5e7eb"}', 20),
 ('face_glasses_sport','accesorio','gafas','Gafas Deportivas', 'Visera oscura de alto rendimiento.',      'rare',      160,false, '{"slot":"face","style":"sport","color":"#111827","accent":"#22d3ee"}', 21),
 ('back_pack_urban', 'accesorio','mochila','Mochila Urbana',   'Del gimnasio a la oficina.',              'common',    90, false, '{"slot":"back","style":"urban","color":"#334155"}', 22),
 ('back_pack_trail', 'accesorio','mochila','Mochila Trail',    'Para rutas largas.',                      'rare',      170,false, '{"slot":"back","style":"trail","color":"#b45309"}', 23),
 ('wrist_watch_steel','accesorio','reloj','Reloj Acero',       'Mide cada serie.',                        'rare',      150,false, '{"slot":"wrist","style":"steel","color":"#cbd5e1"}', 24),
 ('wrist_watch_pulse','accesorio','reloj','Reloj Pulse',       'Banda neón, pantalla viva.',              'epic',      280,false, '{"slot":"wrist","style":"pulse","color":"#22d3ee"}', 25),
 ('frame_gold',      'premium','marco','Marco Oro',            'Borde dorado para tu avatar.',            'epic',      400,false, '{"slot":"frame","style":"solid","color":"#e6b43c"}', 30),
 ('frame_aurora',    'premium','marco','Marco Aurora',         'Degradado vivo.',                         'legendary', 900,true,  '{"slot":"frame","style":"aurora","color":"#a855f7","color2":"#22d3ee"}', 31),
 ('badge_flame',     'premium','insignia','Insignia Llama',    'Se muestra junto a tu nombre.',           'rare',      120,false, '{"slot":"badge","icon":"🔥"}', 32),
 ('badge_crown',     'premium','insignia','Insignia Corona',   'Solo para quien no se rinde.',            'legendary', 700,true,  '{"slot":"badge","icon":"👑"}', 33),
 ('fx_aura_violet',  'premium','efecto','Aura Violeta',        'Un halo suave detrás de ti.',             'epic',      500,false, '{"slot":"fx","style":"aura","color":"#a855f7"}', 34),
 ('fx_sparks',       'premium','efecto','Chispas',             'Partículas que suben a tu alrededor.',    'legendary', 1200,true, '{"slot":"fx","style":"sparks","color":"#e6b43c"}', 35)
on conflict (id) do update set category=excluded.category, kind=excluded.kind, name=excluded.name,
  description=excluded.description, rarity=excluded.rarity, price_coins=excluded.price_coins,
  is_premium=excluded.is_premium, data=excluded.data, sort=excluded.sort;

-- 12) Refrescar la caché de esquema de la API (evita "function not found" justo después de migrar)
notify pgrst, 'reload schema';