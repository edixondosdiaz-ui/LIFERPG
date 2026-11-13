-- AVISO: al agregar DEFAULT true, TODOS los perfiles existentes quedan públicos,
-- incluidos los que tenían profile_visibility='friends'. No ejecutar sin revisar este efecto.
-- No se actualizan ni borran registros previos. El dueño aplica este archivo manualmente.
begin;
alter table public.profiles add column if not exists is_public boolean not null default true;
alter table public.profiles alter column is_public set default true;
alter table public.profiles alter column is_public set not null;
alter table public.profiles enable row level security;
-- No abrir SELECT de toda la fila: RLS protege filas, no oculta columnas.
-- Esta política restrictiva mantiene privadas las columnas internas incluso si
-- otra política permisiva fuera añadida. El dueño conserva su lectura actual.
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_private_boundary') then
    create policy profiles_private_boundary on public.profiles as restrictive for select to anon,authenticated using(id=auth.uid());
  end if;
end $$;
revoke select on public.profiles from public,anon;
grant select on public.profiles to authenticated;

-- Proyección explícita de lectura: nunca incluye display_name, país, monedas,
-- premium, correos, preferencias, ubicación ni rutas. El propietario de la vista
-- aplica este filtro; no se concede acceso público a la tabla base.
create or replace view public.public_profile_cards with (security_barrier=true) as
  select username,avatar,xp,floor(sqrt(xp/100.0))::int+1 as level
  from public.profiles where is_public and onboarding_completed and username is not null;
revoke all on public.public_profile_cards from public,anon,authenticated;
grant select on public.public_profile_cards to anon,authenticated;

create or replace function public.set_profile_public(p_is_public boolean) returns boolean
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or p_is_public is null then raise exception 'Vuelve a iniciar sesión'; end if;
  update public.profiles set is_public=p_is_public where id=auth.uid();
  if not found then raise exception 'Perfil no disponible'; end if;
  return p_is_public;
end $$;

-- Resumen público seguro; también sirve sin sesión. Privados: identidad mínima.
create or replace function public.public_profile_summary(p_username text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare p public.profiles; m jsonb; result jsonb; pos int;
begin
  select * into p from public.profiles where username=lower(trim(regexp_replace(coalesce(p_username,''),'^@',''))) and onboarding_completed;
  if not found then raise exception 'Perfil no disponible'; end if;
  result:=jsonb_build_object('username',p.username,'avatar',p.avatar,'private',not p.is_public);
  if not p.is_public and p.id is distinct from auth.uid() then return result; end if;
  select count(*)+1 into pos from public.profiles candidate where candidate.onboarding_completed and candidate.username is not null and candidate.xp>p.xp;
  m:=public.user_metrics(p.id);
  return result||jsonb_build_object('private',false,'level',floor(sqrt(p.xp/100.0))::int+1,'xp',p.xp,
    'streak',public.compute_streak(p.id),'position',pos,
    'achievements',coalesce((select jsonb_agg(to_jsonb(a)) from (
      select a.id,a.name,a.description,a.icon,a.target,a.reward_coins,
        least(coalesce((m->>a.metric)::int,0),a.target) progress,(ua.achievement_id is not null) unlocked,ua.unlocked_at
      from public.achievements a left join public.user_achievements ua on ua.achievement_id=a.id and ua.user_id=p.id
      order by (ua.achievement_id is not null) desc,coalesce((m->>a.metric)::numeric,0)/a.target desc,a.sort limit 3
    ) a),'[]'::jsonb));
end $$;

create or replace function public.ranking_rows(p_scope text default 'global') returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; my_tier int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_scope is null or p_scope not in ('global','friends','league') then raise exception 'Ranking inválido'; end if;
  perform public.settle_leagues();
  insert into public.league_members(user_id) values(auth.uid()) on conflict do nothing;
  select tier into my_tier from public.league_members where user_id=auth.uid();
  with eligible as (
    select p.id,p.username,p.avatar,p.xp,coalesce(x.xp,0) week_xp,
      (p.is_public or p.id=auth.uid()) may_view,
      case when p_scope='league' then coalesce(x.xp,0) else p.xp end score
    from public.profiles p left join public.league_members l on l.user_id=p.id
    left join public.weekly_xp x on x.user_id=p.id and x.week_start=date_trunc('week',public.app_today()::timestamp)::date
    where p.onboarding_completed and p.username is not null and
      (p_scope='global' or (p_scope='league' and l.tier=my_tier) or (p_scope='friends' and (p.id=auth.uid() or exists(
        select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=p.id) or (f.addressee_id=auth.uid() and f.requester_id=p.id))))))
  ), ranked as (select *,rank() over(order by score desc)::int position from eligible), safe_rows as (
    select id,username,avatar,position,not may_view as private,
      case when may_view then xp else null end xp,
      case when may_view and p_scope='league' then week_xp else null end week_xp
    from ranked
  ), displayed as (select * from safe_rows order by position,username limit 100)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(d) order by d.position,d.username) from displayed d),'[]'::jsonb),
    'me',(select to_jsonb(s) from safe_rows s where id=auth.uid()),
    'position',(select position from ranked where id=auth.uid()),'total',(select count(*) from ranked),'tier',my_tier,
    'week_start',date_trunc('week',public.app_today()::timestamp)::date,
    'tracking_started_at',(select tracking_started_at from public.feature_rules where id),
    'league_min_members',(select league_min_members from public.feature_rules where id),
    'league_percent',(select league_percent from public.feature_rules where id)) into result;
  return result;
end $$;

create or replace function public.ranking_user_summary(p_username text,p_scope text default 'global') returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.profiles; f public.friendships; result jsonb; tier_value int; pos int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_scope is null or p_scope not in ('global','friends','league') then raise exception 'Ranking inválido'; end if;
  select * into p from public.profiles where username=lower(trim(regexp_replace(coalesce(p_username,''),'^@',''))) and onboarding_completed;
  if not found then raise exception 'Perfil no disponible'; end if;
  result:=public.public_profile_summary(p.username);
  -- Ni los amigos pueden saltarse la elección de perfil privado.
  if (result->>'private')::boolean then return result; end if;
  select * into f from public.friendships where least(requester_id,addressee_id)=least(auth.uid(),p.id) and greatest(requester_id,addressee_id)=greatest(auth.uid(),p.id);
  perform public.settle_leagues();
  select tier into tier_value from public.league_members where user_id=p.id;
  if p_scope='league' then
    select count(*)+1 into pos from public.league_members l join public.profiles candidate on candidate.id=l.user_id
      left join public.weekly_xp x on x.user_id=l.user_id and x.week_start=date_trunc('week',public.app_today()::timestamp)::date
      where l.tier=tier_value and candidate.onboarding_completed and candidate.username is not null
      and coalesce(x.xp,0)>coalesce((select xp from public.weekly_xp where user_id=p.id and week_start=date_trunc('week',public.app_today()::timestamp)::date),0);
  elsif p_scope='friends' then
    select count(*)+1 into pos from public.profiles candidate where candidate.onboarding_completed and candidate.username is not null and candidate.xp>p.xp
      and(candidate.id=auth.uid() or exists(select 1 from public.friendships r where r.status='accepted' and ((r.requester_id=auth.uid() and r.addressee_id=candidate.id) or(r.addressee_id=auth.uid() and r.requester_id=candidate.id))));
  else pos:=(result->>'position')::int; end if;
  return result||jsonb_build_object('relationship',case when p.id=auth.uid() then 'self' when f.status='accepted' then 'friend' when f.requester_id=auth.uid() then 'sent' when f.id is not null then 'received' else 'none' end,
    'friendship_id',f.id,'league',tier_value,'position',pos,
    'week_xp',coalesce((select xp from public.weekly_xp where user_id=p.id and week_start=date_trunc('week',public.app_today()::timestamp)::date),0),
    'strongest_pillar',(select key from jsonb_each_text(p.pillar_xp) order by value::numeric desc,key limit 1));
end $$;

-- Cerrar también las rutas de lectura antiguas: no basta con ocultar el modal.
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
    'sets',(select count(*) from public.workout_sets where user_id=p.id),
    'achievements',(select count(*) from public.user_achievements where user_id=p.id),
    'equipped',coalesce((select jsonb_agg(s.data) from public.inventory i join public.shop_items s on s.id=i.item_id where i.user_id=p.id and i.equipped),'[]'::jsonb));
end $$;
create or replace function public.visible_profile(p_username text) returns jsonb
language sql stable security definer set search_path=public as $$ select public.get_friend_profile(p_username) $$;

create or replace view public.leaderboard with (security_barrier=true) as
  select id,username,case when is_public or id=auth.uid() then coalesce(xp,0)::int else null end as xp,avatar
    from public.profiles where onboarding_completed and username is not null;
revoke all on public.leaderboard from public,anon,authenticated;
grant select on public.leaderboard to authenticated;

create or replace function public.search_users(p_query text)
returns table(id uuid,username text,display_name text,avatar jsonb,xp int,relation text)
language sql stable security definer set search_path=public as $$
  select p.id,p.username,null::text,p.avatar,case when p.is_public then coalesce(p.xp,0)::int else null end,
    case when f.id is null then 'none' when f.status='accepted' then 'friend' when f.requester_id=auth.uid() then 'sent' else 'received' end
  from public.profiles p left join public.friendships f
    on least(f.requester_id,f.addressee_id)=least(p.id,auth.uid()) and greatest(f.requester_id,f.addressee_id)=greatest(p.id,auth.uid())
  where auth.uid() is not null and length(regexp_replace(trim(coalesce(p_query,'')),'^@',''))>=2 and p.onboarding_completed and p.username is not null and p.id<>auth.uid()
    and starts_with(p.username,lower(regexp_replace(trim(coalesce(p_query,'')),'^@','')))
  order by (p.username=lower(regexp_replace(trim(coalesce(p_query,'')),'^@',''))) desc,p.username limit 20
$$;
create or replace function public.list_friendships()
returns table(friendship_id uuid,user_id uuid,username text,display_name text,avatar jsonb,xp int,status text,direction text)
language sql stable security definer set search_path=public as $$
  select f.id,p.id,p.username,null::text,p.avatar,case when p.is_public then coalesce(p.xp,0)::int else null end,f.status,
    case when f.status='accepted' then 'friend' when f.requester_id=auth.uid() then 'outgoing' else 'incoming' end
  from public.friendships f join public.profiles p on p.id=case when f.requester_id=auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in(f.requester_id,f.addressee_id) and p.username is not null order by f.status,p.username
$$;
revoke all on function public.compute_streak(uuid),public.user_metrics(uuid) from public,anon,authenticated;
revoke all on function public.set_profile_public(boolean),public.public_profile_summary(text),public.ranking_rows(text),public.ranking_user_summary(text,text),
  public.get_friend_profile(text),public.visible_profile(text),public.search_users(text),public.list_friendships() from public,anon;
grant execute on function public.public_profile_summary(text) to anon,authenticated;
grant execute on function public.set_profile_public(boolean),public.ranking_rows(text),public.ranking_user_summary(text,text),
  public.get_friend_profile(text),public.visible_profile(text),public.search_users(text),public.list_friendships() to authenticated;
notify pgrst,'reload schema';
commit;
