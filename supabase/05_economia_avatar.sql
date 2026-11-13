-- Aplicación manual DESPUÉS de 04_hoy_perfil.sql. No ejecutado por Codex.
-- Aditivo: conserva saldos, compras, inventario y avatares existentes.
begin;

create table public.economy_rules (
  id boolean primary key default true check(id),
  level_coins integer not null default 15 check(level_coins>=0),
  weekly_streak_coins integer not null default 25 check(weekly_streak_coins>=0),
  complete_day_coins integer not null default 10 check(complete_day_coins>=0),
  league_promotion_coins integer not null default 50 check(league_promotion_coins>=0),
  premium_discount integer not null default 15 check(premium_discount between 0 and 50),
  premium_rename_days integer not null default 90 check(premium_rename_days>=30),
  name_reservation_days integer not null default 30 check(name_reservation_days>=1),
  max_streak_guards integer not null default 2 check(max_streak_guards between 1 and 2)
);
insert into public.economy_rules(id) values(true);
alter table public.economy_rules enable row level security;
create policy economy_rules_read on public.economy_rules for select to authenticated using(true);
revoke all on public.economy_rules from anon, authenticated;
grant select on public.economy_rules to authenticated;

-- Solo el servidor/una futura integración de pagos puede otorgar Premium.
create table public.premium_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  check(ends_at>starts_at)
);
alter table public.premium_entitlements enable row level security;
create policy premium_own on public.premium_entitlements for select to authenticated using(user_id=auth.uid());
revoke all on public.premium_entitlements from anon, authenticated;
grant select on public.premium_entitlements to authenticated;
create function public.has_premium(p_uid uuid) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.premium_entitlements where user_id=p_uid and starts_at<=now() and ends_at>now())
$$;

create table public.coin_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  balance integer not null check(balance>=0),
  reason text not null,
  reference text,
  created_at timestamptz not null default now()
);
create index coin_ledger_user_date on public.coin_ledger(user_id,id desc);
alter table public.coin_ledger enable row level security;
create policy coin_ledger_own on public.coin_ledger for select to authenticated using(user_id=auth.uid());
revoke all on public.coin_ledger from anon, authenticated;
grant select on public.coin_ledger to authenticated;

-- Captura TAMBIÉN las recompensas de logros y bienvenida de RPC anteriores.
-- Los saldos previos se reconocen como apertura, sin recalcular ni cambiarlos.
create function public.record_coin_movement() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.coin_ledger(user_id,amount,balance,reason) values(new.id,new.coins,new.coins,'Saldo inicial');
  elsif new.coins is distinct from old.coins then
    if not exists(select 1 from public.coin_ledger where user_id=new.id) then
      insert into public.coin_ledger(user_id,amount,balance,reason) values(new.id,old.coins,old.coins,'Saldo anterior a esta etapa');
    end if;
    insert into public.coin_ledger(user_id,amount,balance,reason,reference)
      values(new.id,new.coins-old.coins,new.coins,
        coalesce(nullif(current_setting('liferpg.coin_reason',true),''),'Recompensa del servidor'),
        nullif(current_setting('liferpg.coin_reference',true),''));
  end if;
  return new;
end $$;
create trigger coin_ledger_insert after insert on public.profiles for each row execute function public.record_coin_movement();
create trigger coin_ledger_update after update of coins on public.profiles for each row execute function public.record_coin_movement();

create table public.coin_reward_claims (
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_key text not null,
  created_at timestamptz not null default now(),
  primary key(user_id,reward_key)
);
alter table public.coin_reward_claims enable row level security;
create policy coin_claims_own on public.coin_reward_claims for select to authenticated using(user_id=auth.uid());
revoke all on public.coin_reward_claims from anon, authenticated;
grant select on public.coin_reward_claims to authenticated;

create table public.utility_inventory (
  user_id uuid not null references auth.users(id) on delete cascade,
  utility text not null check(utility in ('rename_card','streak_guard')),
  quantity integer not null default 0 check(quantity>=0 and (utility<>'streak_guard' or quantity<=2)),
  primary key(user_id,utility)
);
alter table public.utility_inventory enable row level security;
create policy utilities_own on public.utility_inventory for select to authenticated using(user_id=auth.uid());
revoke all on public.utility_inventory from anon, authenticated;
grant select on public.utility_inventory to authenticated;

alter table public.username_changes add column if not exists credit_source text not null default 'free';
create table public.username_reservations (
  username text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  reserved_until timestamptz not null
);
create index username_reservations_user on public.username_reservations(user_id,reserved_until);
alter table public.username_reservations enable row level security;
create policy reservations_own on public.username_reservations for select to authenticated using(user_id=auth.uid());
revoke all on public.username_reservations from anon, authenticated;
grant select on public.username_reservations to authenticated;
create table public.username_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  previous_username text not null,
  new_username text not null,
  changed_at timestamptz not null default now()
);
create index username_history_user on public.username_history(user_id,changed_at desc);
alter table public.username_history enable row level security;
create policy username_history_own on public.username_history for select to authenticated using(user_id=auth.uid());
revoke all on public.username_history from anon, authenticated;
grant select on public.username_history to authenticated;

-- Lista editable por el dueño. Se compara sin _, números equivalentes ni mayúsculas.
create table public.blocked_username_terms(term text primary key);
insert into public.blocked_username_terms(term) values
 ('admin'),('administrador'),('soporte'),('support'),('liferpg'),('moderador'),('root'),
 ('mierda'),('puta'),('puto'),('marica'),('gonorrea'),('hijueputa'),('hijueput'),('nazi'),('hitler');
alter table public.blocked_username_terms enable row level security;
revoke all on public.blocked_username_terms from anon, authenticated;

create function public.username_status(p_username text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u text:=lower(trim(p_username)); cleaned text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if u is null or u !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('available',false,'message','Usa 3 a 20 letras, números o guion bajo'); end if;
  cleaned:=regexp_replace(translate(u,'013457','oieast'),'[^a-z]','','g');
  if exists(select 1 from public.blocked_username_terms where term=cleaned
    or (term in ('admin','administrador','soporte','support','liferpg','moderador','root') and u~('^'||term||'[0-9_]*$'))
    or term=any(regexp_split_to_array(translate(u,'013457','oieast'),'[^a-z]+'))) then
    return jsonb_build_object('available',false,'message','Ese nombre no está permitido');
  end if;
  if exists(select 1 from public.profiles where lower(username)=u and id<>auth.uid()) then
    return jsonb_build_object('available',false,'message','Ese usuario ya está en uso');
  end if;
  if exists(select 1 from public.username_reservations where username=u and user_id<>auth.uid() and reserved_until>now()) then
    return jsonb_build_object('available',false,'message','Ese usuario está reservado temporalmente');
  end if;
  return jsonb_build_object('available',true,'message','Disponible');
end $$;
create or replace function public.username_available(p_username text) returns boolean
language sql security definer set search_path=public as $$
  select (public.username_status(p_username)->>'available')::boolean
$$;

create or replace function public.my_name_changes() returns integer
language sql stable security definer set search_path=public as $$
  select greatest(0,(select free_name_changes from public.app_product_settings where id)
    -(select count(*)::int from public.username_changes where user_id=auth.uid() and credit_source='free'))
  +coalesce((select quantity from public.utility_inventory where user_id=auth.uid() and utility='rename_card'),0)
  +case when public.has_premium(auth.uid()) and not exists(select 1 from public.username_changes
    where user_id=auth.uid() and credit_source='premium'
    and changed_at>now()-make_interval(days=>(select premium_rename_days from public.economy_rules where id))) then 1 else 0 end
$$;

create or replace function public.change_my_username(p_username text) returns void
language plpgsql security definer set search_path=public as $$
declare u text:=lower(trim(p_username)); old_name text; source text; status jsonb;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select username into old_name from public.profiles where id=auth.uid() and onboarding_completed for update;
  if not found then raise exception 'Completa primero el registro'; end if;
  if u=old_name then raise exception 'Elige un nombre diferente'; end if;
  -- Serializa también la reserva contra registros y cambios concurrentes.
  perform pg_advisory_xact_lock(hashtextextended(u,73));
  status:=public.username_status(u);
  if not (status->>'available')::boolean then raise exception '%',status->>'message'; end if;
  if (select count(*) from public.username_changes where user_id=auth.uid() and credit_source='free')
    <(select free_name_changes from public.app_product_settings where id) then source:='free';
  elsif public.has_premium(auth.uid()) and not exists(select 1 from public.username_changes where user_id=auth.uid() and credit_source='premium'
    and changed_at>now()-make_interval(days=>(select premium_rename_days from public.economy_rules where id))) then source:='premium';
  else
    update public.utility_inventory set quantity=quantity-1 where user_id=auth.uid() and utility='rename_card' and quantity>0;
    if not found then raise exception 'No tienes cambios disponibles. Consigue una tarjeta en la tienda'; end if;
    source:='card';
  end if;
  insert into public.username_reservations(username,user_id,reserved_until)
    values(old_name,auth.uid(),now()+make_interval(days=>(select name_reservation_days from public.economy_rules where id)))
    on conflict(username) do update set user_id=excluded.user_id,reserved_until=excluded.reserved_until;
  perform set_config('liferpg.rename_user',auth.uid()::text,true);
  update public.profiles set username=u where id=auth.uid();
  insert into public.username_changes(user_id,credit_source) values(auth.uid(),source);
  insert into public.username_history(user_id,previous_username,new_username) values(auth.uid(),old_name,u);
exception when unique_violation then raise exception 'Ese usuario ya no está disponible';
end $$;

-- Aplica las mismas reglas al onboarding y a cualquier RPC anterior.
create function public.validate_username_write() returns trigger
language plpgsql security definer set search_path=public as $$
declare status jsonb;
begin
  if new.username is null then return new; end if;
  if tg_op='UPDATE' and new.username is not distinct from old.username then return new; end if;
  new.username:=lower(trim(new.username));
  perform pg_advisory_xact_lock(hashtextextended(new.username,73));
  status:=public.username_status(new.username);
  if not (status->>'available')::boolean then raise exception '%',status->>'message'; end if;
  return new;
end $$;
create trigger validate_username_write before insert or update of username on public.profiles
  for each row execute function public.validate_username_write();

alter table public.shop_items add column if not exists section text
  check(section in ('avatar','backgrounds','frames','titles','utilities'));
create table public.shop_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  item_id text not null references public.shop_items(id),
  result jsonb not null,
  primary key(user_id,request_id)
);
alter table public.shop_requests enable row level security;
revoke all on public.shop_requests from anon, authenticated;

-- Precios editables en el catálogo. Los objetos anteriores quedan intactos.
insert into public.shop_items(id,category,kind,name,description,rarity,price_coins,is_premium,data,sort,section) values
 ('rename_card','accesorio','utilidad','Tarjeta de cambio de nombre','Suma un cambio de usuario. Se consume al confirmar el cambio.','rare',150,false,'{"utility":"rename_card"}',100,'utilities'),
 ('streak_guard','accesorio','utilidad','Protector de racha','Cubre el día de ayer sin actividad. Máximo dos en inventario. No da XP.','rare',200,false,'{"utility":"streak_guard"}',101,'utilities'),
 ('hair_fade','accesorio','peinado','Degradado','Un peinado adicional para tu avatar.','rare',100,false,'{"slot":"hair","style":"degradado"}',110,'avatar'),
 ('expression_smile','accesorio','expresion','Sonrisa','Una expresión para celebrar tu progreso.','common',80,false,'{"slot":"expression","style":"smile"}',111,'avatar'),
 ('accessory_headband','accesorio','accesorio','Cinta deportiva','Una cinta para tu avatar.','common',70,false,'{"slot":"accessory","style":"cinta"}',112,'avatar'),
 ('accessory_earring','accesorio','accesorio','Aro dorado','Un accesorio discreto para tu avatar.','common',60,false,'{"slot":"accessory","style":"aro"}',113,'avatar'),
 ('accessory_headphones','accesorio','accesorio','Audífonos','Audífonos para tu versión futura.','rare',120,false,'{"slot":"accessory","style":"audifonos"}',114,'avatar'),
 ('background_violet','accesorio','fondo','Horizonte violeta','Fondo violeta para tu avatar.','rare',150,false,'{"slot":"background","colors":["#6d28d9","#171025"]}',120,'backgrounds'),
 ('background_emerald','accesorio','fondo','Bosque nocturno','Un fondo verde profundo.','rare',150,false,'{"slot":"background","colors":["#065f46","#071b18"]}',121,'backgrounds'),
 ('frame_silver','accesorio','marco','Marco Plata','Un marco plateado para tu perfil.','rare',180,false,'{"slot":"frame","style":"solid","color":"#cbd5e1"}',130,'frames'),
 ('title_consistent','accesorio','titulo','Constante','Título cosmético. No cambia tu XP ni ranking.','common',90,false,'{"slot":"title","text":"Constante"}',140,'titles')
on conflict(id) do nothing;

create function public.shop_wallet() returns jsonb
language plpgsql security definer set search_path=public as $$
declare balance int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select coins into balance from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Perfil no disponible'; end if;
  if not exists(select 1 from public.coin_ledger where user_id=auth.uid()) then
    insert into public.coin_ledger(user_id,amount,balance,reason) values(auth.uid(),balance,balance,'Saldo anterior a esta etapa');
  end if;
  return jsonb_build_object('coins',balance,'premium',public.has_premium(auth.uid()),
    'discount',(select premium_discount from public.economy_rules where id),
    'name_changes',public.my_name_changes(),'reservation_days',(select name_reservation_days from public.economy_rules where id),
    'utilities',coalesce((select jsonb_object_agg(utility,quantity) from public.utility_inventory where user_id=auth.uid()),'{}'::jsonb));
end $$;

create function public.my_cosmetics() returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'data',s.data,'equipped',i.equipped) order by s.sort),'[]'::jsonb)
  from public.inventory i join public.shop_items s on s.id=i.item_id
  where i.user_id=auth.uid() and s.data->>'slot' is not null
$$;

create function public.purchase_shop_item(p_item_id text,p_request_id uuid,p_expected_price integer default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare item public.shop_items; balance int; price int; premium boolean; v_utility text; result jsonb; purchase_id uuid;
begin
  if auth.uid() is null or p_request_id is null then raise exception 'Solicitud inválida'; end if;
  select coins into balance from public.profiles where id=auth.uid() for update;
  if not found then raise exception 'Perfil no disponible'; end if;
  select r.result into result from public.shop_requests r where r.user_id=auth.uid() and r.request_id=p_request_id and r.item_id=p_item_id;
  if found then return result; end if;
  if exists(select 1 from public.shop_requests where user_id=auth.uid() and request_id=p_request_id) then raise exception 'Identificador ya usado'; end if;
  select * into item from public.shop_items where id=p_item_id and available for share;
  if not found then raise exception 'Objeto no disponible'; end if;
  premium:=public.has_premium(auth.uid());
  if item.is_premium and not premium then raise exception 'Solo premium. Disponible pronto'; end if;
  price:=greatest(0,floor(item.price_coins::numeric*(100-case when premium then (select premium_discount from public.economy_rules where id) else 0 end)/100.0)::int);
  if p_expected_price is not null and p_expected_price<>price then raise exception 'El precio cambió. Actualiza la tienda y confirma de nuevo'; end if;
  v_utility:=item.data->>'utility';
  if v_utility is not null and v_utility not in ('rename_card','streak_guard') then raise exception 'Utilidad no disponible'; end if;
  if v_utility is null and exists(select 1 from public.inventory where user_id=auth.uid() and item_id=p_item_id) then raise exception 'Ya tienes este objeto'; end if;
  if v_utility='streak_guard' and coalesce((select i.quantity from public.utility_inventory i where user_id=auth.uid() and i.utility='streak_guard'),0)>=(select max_streak_guards from public.economy_rules where id) then raise exception 'Ya tienes el máximo de protectores'; end if;
  if balance<price then raise exception 'No tienes suficientes monedas'; end if;
  perform set_config('liferpg.coin_reason','Compra: '||item.name,true);
  perform set_config('liferpg.coin_reference',p_request_id::text,true);
  update public.profiles set coins=coins-price where id=auth.uid();
  if v_utility is null then insert into public.inventory(user_id,item_id) values(auth.uid(),p_item_id);
  else insert into public.utility_inventory(user_id,utility,quantity) values(auth.uid(),v_utility,1)
    on conflict(user_id,utility) do update set quantity=public.utility_inventory.quantity+1;
  end if;
  insert into public.purchases(user_id,item_id,price_coins) values(auth.uid(),p_item_id,price) returning id into purchase_id;
  result:=jsonb_build_object('coins',balance-price,'price',price,'purchase_id',purchase_id);
  insert into public.shop_requests(user_id,request_id,item_id,result) values(auth.uid(),p_request_id,p_item_id,result);
  return result;
end $$;
-- Conserva el endpoint anterior y cierra la posibilidad de saltarse las reglas nuevas.
create or replace function public.buy_item(p_item_id text) returns jsonb
language sql security definer set search_path=public as $$
  select public.purchase_shop_item(p_item_id,gen_random_uuid())
$$;
create or replace function public.equip_item(p_item_id text,p_equip boolean) returns void
language plpgsql security definer set search_path=public as $$
declare slot text;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  select s.data->>'slot' into slot from public.inventory i join public.shop_items s on s.id=i.item_id where i.user_id=auth.uid() and i.item_id=p_item_id;
  if not found or slot is null then raise exception 'No tienes un cosmético equipable con ese identificador'; end if;
  if p_equip then update public.inventory i set equipped=false from public.shop_items s where i.item_id=s.id and i.user_id=auth.uid() and s.data->>'slot'=slot; end if;
  update public.inventory set equipped=p_equip where user_id=auth.uid() and item_id=p_item_id;
end $$;

create function public.claim_economy_rewards() returns integer
language plpgsql security definer set search_path=public as $$
declare p public.profiles; r public.economy_rules; k text; amount int; total int:=0; level int; inserted int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.profiles where id=auth.uid() for update;
  if not found or not p.onboarding_completed then return 0; end if;
  select * into r from public.economy_rules where id;
  level:=floor(sqrt(p.xp/100.0))::int+1;
  for k,amount in
    -- Primera visita: solo el nivel actual. Después paga cada nivel nuevo,
    -- incluso si una sola actividad sube varios niveles; nunca paga retroactivo.
    select 'level:'||n,r.level_coins from generate_series(
      coalesce((select max(split_part(reward_key,':',2)::int) from public.coin_reward_claims
        where user_id=auth.uid() and reward_key like 'level:%'),greatest(1,level-1))+1,level) n where n>=2
    union all select 'day:'||public.app_today(),r.complete_day_coins
      where (select count(distinct pillar) from public.my_activity() where "day"=public.app_today())=4
    union all select 'streak:'||public.app_today(),r.weekly_streak_coins
      where public.my_current_streak()>=7 and not exists(select 1 from public.coin_reward_claims
        where user_id=auth.uid() and reward_key like 'streak:%' and created_at>now()-interval '7 days')
  loop
    insert into public.coin_reward_claims(user_id,reward_key) values(auth.uid(),k) on conflict do nothing;
    get diagnostics inserted=row_count;
    if inserted>0 and amount>0 then
      perform set_config('liferpg.coin_reason',case when k like 'level:%' then 'Nivel alcanzado' when k like 'day:%' then 'Cuatro pilares del día' else 'Hito de racha' end,true);
      perform set_config('liferpg.coin_reference',k,true);
      update public.profiles set coins=coins+amount where id=auth.uid();
      total:=total+amount;
    end if;
  end loop;
  return total;
end $$;

create table public.streak_protections (
  user_id uuid not null references auth.users(id) on delete cascade,
  protected_on date not null,
  created_at timestamptz not null default now(),
  primary key(user_id,protected_on)
);
alter table public.streak_protections enable row level security;
create policy protections_own on public.streak_protections for select to authenticated using(user_id=auth.uid());
revoke all on public.streak_protections from anon, authenticated;
grant select on public.streak_protections to authenticated;
create function public.activity_days_with_protection(p_uid uuid) returns table("day" date)
language sql stable security definer set search_path=public as $$
  select performed_at::date from public.habit_logs where user_id=p_uid
  union select performed_at::date from public.workout_sets where user_id=p_uid
  union select performed_at from public.workout_sessions where user_id=p_uid
  union select logged_on from public.water_logs where user_id=p_uid
  union select slept_on from public.sleep_logs where user_id=p_uid
  union select logged_on from public.meals where user_id=p_uid
  union select studied_on from public.edu_sessions where user_id=p_uid
  union select occurred_on from public.fin_transactions where user_id=p_uid and from_recurring is null
  union select logged_on from public.wellbeing_logs where user_id=p_uid
  union select (done_at at time zone 'America/Bogota')::date from public.edu_tasks where user_id=p_uid and done
  union select protected_on from public.streak_protections where user_id=p_uid
$$;
-- Agrega el protector a la racha existente; no otorga XP ni altera registros de hábitos.
create or replace function public.compute_streak(p_uid uuid) returns int
language sql stable security definer set search_path=public as $$
  with numbered as (
    select "day","day"-(row_number() over(order by "day"))::int g from public.activity_days_with_protection(p_uid) where "day"<=public.app_today()
  ) select case when max("day")>=public.app_today()-1 then
    (select count(*)::int from numbered where g=(select g from numbered order by "day" desc limit 1)) else 0 end from numbered
$$;
create or replace function public.my_current_streak() returns integer
language sql stable security definer set search_path=public as $$ select public.compute_streak(auth.uid()) $$;
create function public.use_streak_guard() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform 1 from public.profiles where id=auth.uid() for update;
  if exists(select 1 from public.activity_days_with_protection(auth.uid()) where "day"=public.app_today()-1)
    or not exists(select 1 from public.activity_days_with_protection(auth.uid()) where "day"=public.app_today()-2) then
    raise exception 'Solo puedes cubrir ayer si faltó actividad y tenías racha anteayer';
  end if;
  update public.utility_inventory set quantity=quantity-1 where user_id=auth.uid() and utility='streak_guard' and quantity>0;
  if not found then raise exception 'No tienes protectores de racha'; end if;
  insert into public.streak_protections(user_id,protected_on) values(auth.uid(),public.app_today()-1);
end $$;

-- Solo los rasgos base gratuitos viven en avatar JSON; los cosméticos pagados se
-- obtienen del inventario. Un valor antiguo se conserva si el usuario no lo cambia.
create function public.validate_avatar_base() returns trigger
language plpgsql set search_path=public as $$
declare k text; v text; allowed text[];
begin
  if jsonb_typeof(new.avatar)<>'object' then raise exception 'Avatar inválido'; end if;
  for k,v in select key,value from jsonb_each_text(new.avatar) loop
    if tg_op='UPDATE' and new.avatar->k is not distinct from old.avatar->k then continue; end if;
    allowed:=case k
      when 'skin' then array['#f6d7bd','#ecbf98','#d29a6c','#b27849','#8a5733','#5d3a22','#fbe6d4','#40291f']
      when 'hair' then array['rapado','corto','texturizado','largo','rizado','monio','calvo','trenzas']
      when 'hairColor' then array['#14100d','#3a2515','#6b4423','#a5773f','#d9b66a','#cfcfd2','#7c3aed','#be3b45']
      when 'eyes' then array['#2b1d12','#5b3a1c','#2f6f4f','#3b6ea8','#6b7280','#9a683b']
      when 'beard' then array['ninguna','sombra','corta','completa']
      when 'face' then array['ovalado','redondo','cuadrado']
      when 'shirtColor' then array['#2d2a45','#8b91a5','#111827','#7c4a1d']
      when 'accessory' then array['ninguno']
      when 'aesthetic' then array['atleta','minimal','noche','solar']
      else array[]::text[] end;
    if v is null or not v=any(allowed) then raise exception 'Rasgo base no válido: %',k; end if;
  end loop;
  return new;
end $$;
create trigger validate_avatar_base before insert or update of avatar on public.profiles
  for each row execute function public.validate_avatar_base();

revoke all on function public.has_premium(uuid),public.record_coin_movement(),public.activity_days_with_protection(uuid),
  public.validate_avatar_base(),public.validate_username_write(),public.compute_streak(uuid) from public,anon,authenticated;
revoke all on function public.username_status(text),public.shop_wallet(),public.my_cosmetics(),public.purchase_shop_item(text,uuid,integer),
  public.claim_economy_rewards(),public.use_streak_guard() from public,anon;
grant execute on function public.username_status(text),public.shop_wallet(),public.my_cosmetics(),public.purchase_shop_item(text,uuid,integer),
  public.claim_economy_rewards(),public.use_streak_guard() to authenticated;
notify pgrst,'reload schema';
commit;
