-- Manual, después de 06_prueba_premium.sql. No ejecutado por Codex.
begin;
-- Capturar antes de crear objetos: actualizar funciones previas solo al instalar esta fase.
do $install_state$ begin
  perform set_config('liferpg.install07', (to_regprocedure('public.sync_premium_benefits()') is null and to_regprocedure('public.routine_quota()') is null and to_regprocedure('public.settle_leagues()') is null)::text, true);
end $install_state$;
create table if not exists public.feature_rules (
  id boolean primary key default true check(id),
  free_routines integer not null default 3 check(free_routines>=1),
  trend_months integer not null default 12 check(trend_months between 3 and 36),
  league_min_members integer not null default 5 check(league_min_members>=5),
  league_percent integer not null default 20 check(league_percent between 1 and 40),
  tracking_started_at timestamptz not null default now()
);
insert into public.feature_rules(id) values(true) on conflict(id) do nothing;
alter table public.feature_rules enable row level security;
do $policy$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='feature_rules' and policyname='feature_rules_read') then
    create policy feature_rules_read on public.feature_rules for select to authenticated using(true);
  end if;
end $policy$;
revoke all on public.feature_rules from public,anon,authenticated;
grant select on public.feature_rules to authenticated;

insert into public.shop_items(id,category,kind,name,description,rarity,price_coins,is_premium,data,section,sort) values
 ('premium_frame','premium','marco','Marco Premium','Incluido mientras Premium esté vigente.','epic',0,true,'{"slot":"frame","style":"solid","color":"#a855f7","color2":"#f8fafc"}','frames',200),
 ('premium_badge','premium','insignia','Insignia Premium','Incluida mientras Premium esté vigente.','epic',0,true,'{"slot":"badge","icon":"✦"}','avatar',201)
on conflict(id) do nothing;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.sync_premium_benefits()') is null then
    execute $definition$create function public.sync_premium_benefits() returns void
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if public.has_premium(auth.uid()) then
    insert into public.inventory(user_id,item_id) values(auth.uid(),'premium_frame'),(auth.uid(),'premium_badge') on conflict do nothing;
  end if;
end $$;$definition$;
  end if;
end $bootstrap$;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.my_premium_status()') is null or current_setting('liferpg.install07',true)='true' then
    execute $definition$create or replace function public.my_premium_status() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare t public.premium_trials; e public.premium_entitlements; s public.premium_trial_settings;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into t from public.premium_trials where user_id=auth.uid();
  select * into e from public.premium_entitlements where user_id=auth.uid();
  select * into s from public.premium_trial_settings where id;
  return jsonb_build_object('active',public.has_premium(auth.uid()),'ends_at',e.ends_at,
    'trial_used',t.user_id is not null,'trial_ends_at',t.ends_at,
    'trial_available',s.enabled and t.user_id is null and (e.user_id is null or e.ends_at<=now()),
    'duration_days',s.duration_days,'server_now',now(),
    'discount',(select premium_discount from public.economy_rules where id),
    'rename_days',(select premium_rename_days from public.economy_rules where id),
    'free_routines',(select free_routines from public.feature_rules where id),
    'trend_months',(select trend_months from public.feature_rules where id));
end $$;$definition$;
  end if;
end $bootstrap$;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.guard_premium_equipment()') is null then
    execute $definition$create function public.guard_premium_equipment() returns trigger
language plpgsql set search_path=public as $$
begin
  if new.equipped and new.item_id in ('premium_frame','premium_badge') and not public.has_premium(new.user_id) then raise exception 'Este objeto requiere Premium vigente'; end if;
  return new;
end $$;$definition$;
  end if;
end $bootstrap$;
-- Necesita permisos del dueño para consultar has_premium; nunca expone la función interna.
alter function public.guard_premium_equipment() security definer;
do $trigger$ begin
  if not exists(select 1 from pg_trigger where tgname='guard_premium_equipment' and tgrelid='public.inventory'::regclass and not tgisinternal) then
    create trigger guard_premium_equipment before insert or update of equipped on public.inventory for each row execute function public.guard_premium_equipment();
  end if;
end $trigger$;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.my_equipped()') is null or current_setting('liferpg.install07',true)='true' then
    execute $definition$create or replace function public.my_equipped() returns jsonb
language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(s.data),'[]'::jsonb) from public.inventory i join public.shop_items s on s.id=i.item_id
  where i.user_id=auth.uid() and i.equipped and (s.id not in ('premium_frame','premium_badge') or public.has_premium(auth.uid()))
$$;$definition$;
  end if;
end $bootstrap$;

-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.routine_quota()') is null then
    execute $definition$create function public.routine_quota() returns jsonb
language sql stable security definer set search_path=public as $$
  select jsonb_build_object('count',(select count(*) from public.routines where user_id=auth.uid()),
    'limit',case when public.has_premium(auth.uid()) then null else (select free_routines from public.feature_rules where id) end)
$$;$definition$;
  end if;
end $bootstrap$;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.guard_routine_quota()') is null then
    execute $definition$create function public.guard_routine_quota() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform 1 from public.profiles where id=new.user_id for update;
  if not public.has_premium(new.user_id) and (select count(*) from public.routines where user_id=new.user_id)>=(select free_routines from public.feature_rules where id) then raise exception 'Alcanzaste el límite de rutinas Gratis. Premium permite rutinas ilimitadas'; end if;
  return new;
end $$;$definition$;
  end if;
end $bootstrap$;
do $trigger$ begin
  if not exists(select 1 from pg_trigger where tgname='guard_routine_quota' and tgrelid='public.routines'::regclass and not tgisinternal) then
    create trigger guard_routine_quota before insert on public.routines for each row execute function public.guard_routine_quota();
  end if;
end $trigger$;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.guard_exercise_routine()') is null then
    execute $definition$create function public.guard_exercise_routine() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.routine_id is not null and not exists(select 1 from public.routines where id=new.routine_id and user_id=new.user_id) then raise exception 'La rutina no te pertenece'; end if;
  return new;
end $$;$definition$;
  end if;
end $bootstrap$;
do $trigger$ begin
  if not exists(select 1 from pg_trigger where tgname='guard_exercise_routine' and tgrelid='public.exercises'::regclass and not tgisinternal) then
    create trigger guard_exercise_routine before insert or update of routine_id,user_id on public.exercises for each row execute function public.guard_exercise_routine();
  end if;
end $trigger$;

-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.premium_trends()') is null then
    execute $definition$create function public.premium_trends() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare result jsonb;
begin
  if not public.has_premium(auth.uid()) then raise exception 'Las tendencias largas requieren Premium'; end if;
  select jsonb_agg(jsonb_build_object('month',m::date,
    'volume',coalesce((select sum(weight_kg*reps) from public.workout_sets where user_id=auth.uid() and performed_at>=m::date and performed_at<(m+interval '1 month')::date),0),
    'workouts',(select count(distinct performed_at) from public.workout_sets where user_id=auth.uid() and performed_at>=m::date and performed_at<(m+interval '1 month')::date),
    'study_minutes',coalesce((select sum(minutes) from public.edu_sessions where user_id=auth.uid() and studied_on>=m::date and studied_on<(m+interval '1 month')::date),0),
    'sleep_hours',(select round(avg(hours),1) from public.sleep_logs where user_id=auth.uid() and slept_on>=m::date and slept_on<(m+interval '1 month')::date),
    'savings',coalesce((select sum(amount) from public.fin_transactions where user_id=auth.uid() and kind='ahorro' and occurred_on>=m::date and occurred_on<(m+interval '1 month')::date),0)) order by m)
    into result from generate_series(date_trunc('month',public.app_today()::timestamp)-make_interval(months=>(select trend_months-1 from public.feature_rules where id)),date_trunc('month',public.app_today()::timestamp),interval '1 month') m;
  return result;
end $$;$definition$;
  end if;
end $bootstrap$;

create table if not exists public.weekly_xp (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  xp integer not null check(xp>=0),
  primary key(user_id,week_start)
);
create index if not exists weekly_xp_week on public.weekly_xp(week_start,xp desc);
alter table public.weekly_xp enable row level security;
do $policy$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='weekly_xp' and policyname='weekly_xp_own') then
    create policy weekly_xp_own on public.weekly_xp for select to authenticated using(user_id=auth.uid());
  end if;
end $policy$;
revoke all on public.weekly_xp from public,anon,authenticated;
grant select on public.weekly_xp to authenticated;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.track_weekly_xp()') is null then
    execute $definition$create function public.track_weekly_xp() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.xp>old.xp then insert into public.weekly_xp(user_id,week_start,xp)
    values(new.id,date_trunc('week',public.app_today()::timestamp)::date,new.xp-old.xp)
    on conflict(user_id,week_start) do update set xp=public.weekly_xp.xp+excluded.xp; end if;
  return new;
end $$;$definition$;
  end if;
end $bootstrap$;
do $trigger$ begin
  if not exists(select 1 from pg_trigger where tgname='track_weekly_xp' and tgrelid='public.profiles'::regclass and not tgisinternal) then
    create trigger track_weekly_xp after update of xp on public.profiles for each row execute function public.track_weekly_xp();
  end if;
end $trigger$;
create table if not exists public.league_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tier integer not null default 0 check(tier between 0 and 5),
  week_start date not null default date_trunc('week',public.app_today()::timestamp)::date
);
create table if not exists public.league_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  old_tier integer not null,
  new_tier integer not null,
  position integer not null,
  week_xp integer not null,
  primary key(user_id,week_start)
);
alter table public.league_members enable row level security;
alter table public.league_history enable row level security;
do $policy$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_members' and policyname='league_members_own') then
    create policy league_members_own on public.league_members for select to authenticated using(user_id=auth.uid());
  end if;
end $policy$;
do $policy$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='league_history' and policyname='league_history_own') then
    create policy league_history_own on public.league_history for select to authenticated using(user_id=auth.uid());
  end if;
end $policy$;
revoke all on public.league_members,public.league_history from public,anon,authenticated;
grant select on public.league_members,public.league_history to authenticated;
-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.settle_leagues()') is null then
    execute $definition$create function public.settle_leagues() returns void
language plpgsql security definer set search_path=public as $$
declare w date; current_week date:=date_trunc('week',public.app_today()::timestamp)::date; rec record; target int; quota int; rules public.feature_rules; paid int;
begin
  perform pg_advisory_xact_lock(734731);
  select * into rules from public.feature_rules where id;
  loop
    select min(week_start) into w from public.league_members where week_start<current_week;
    exit when w is null;
    for rec in select l.user_id,l.tier,coalesce(x.xp,0) xp,
      rank() over(partition by l.tier order by coalesce(x.xp,0) desc)::int pos,
      count(*) over(partition by l.tier)::int n,
      count(*) over(partition by l.tier,coalesce(x.xp,0))::int tied
      from public.league_members l left join public.weekly_xp x on x.user_id=l.user_id and x.week_start=w where l.week_start=w
    loop
      target:=rec.tier;quota:=greatest(1,floor(rec.n*rules.league_percent/100.0)::int);
      if rec.n>=rules.league_min_members then
        if rec.xp>0 and rec.pos+rec.tied-1<=quota then target:=least(5,rec.tier+1);
        elsif rec.pos>rec.n-quota then target:=greatest(0,rec.tier-1); end if;
      end if;
      insert into public.league_history(user_id,week_start,old_tier,new_tier,position,week_xp) values(rec.user_id,w,rec.tier,target,rec.pos,rec.xp) on conflict do nothing;
      get diagnostics paid=row_count;
      if target>rec.tier and paid>0 then
        perform set_config('liferpg.coin_reason','Ascenso de liga',true);
        perform set_config('liferpg.coin_reference','league:'||w,true);
        update public.profiles set coins=coins+(select league_promotion_coins from public.economy_rules where id) where id=rec.user_id;
      end if;
      update public.league_members set tier=target,week_start=w+7 where user_id=rec.user_id;
    end loop;
  end loop;
end $$;$definition$;
  end if;
end $bootstrap$;

-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.ranking_rows(text)') is null then
    execute $definition$create function public.ranking_rows(p_scope text default 'global') returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; my_tier int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  if p_scope not in ('global','friends','league') then raise exception 'Ranking inválido'; end if;
  perform public.settle_leagues();
  insert into public.league_members(user_id) values(auth.uid()) on conflict do nothing;
  select tier into my_tier from public.league_members where user_id=auth.uid();
  with eligible as (
    select p.id,p.username,p.avatar,p.xp,coalesce(x.xp,0) week_xp,l.tier,
      (p.id=auth.uid() or exists(select 1 from public.app_preferences a where a.user_id=p.id and a.profile_visibility='public')
      or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=p.id) or (f.addressee_id=auth.uid() and f.requester_id=p.id)))) may_view,
      case when p_scope='league' then coalesce(x.xp,0) else p.xp end score
    from public.profiles p left join public.league_members l on l.user_id=p.id
    left join public.weekly_xp x on x.user_id=p.id and x.week_start=date_trunc('week',public.app_today()::timestamp)::date
    where p.onboarding_completed and p.username is not null and
      (p_scope='global' or (p_scope='league' and l.tier=my_tier) or (p_scope='friends' and (p.id=auth.uid() or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=auth.uid() and f.addressee_id=p.id) or (f.addressee_id=auth.uid() and f.requester_id=p.id))))))
  ), ranked as (select *,rank() over(order by score desc)::int position from eligible), displayed as (
    select id,username,avatar,xp,position,case when p_scope='league' and may_view then score else null end week_xp from ranked order by score desc,username limit 100
  ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(d)) from displayed d),'[]'::jsonb),
    'position',(select position from ranked where id=auth.uid()),'total',(select count(*) from ranked),'tier',my_tier,
    'week_start',date_trunc('week',public.app_today()::timestamp)::date,
    'tracking_started_at',(select tracking_started_at from public.feature_rules where id),
    'league_min_members',(select league_min_members from public.feature_rules where id),
    'league_percent',(select league_percent from public.feature_rules where id)) into result;
  return result;
end $$;$definition$;
  end if;
end $bootstrap$;

-- Conservar implementaciones existentes, incluidas las de fases posteriores.
do $bootstrap$ begin
  if to_regprocedure('public.ranking_user_summary(text,text)') is null then
    execute $definition$create function public.ranking_user_summary(p_username text,p_scope text default 'global') returns jsonb
language plpgsql security definer set search_path=public as $$
declare p public.profiles; f public.friendships; allowed boolean; result jsonb; metrics jsonb; league int; position int;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into p from public.profiles where username=lower(trim(p_username)) and onboarding_completed;
  if not found then raise exception 'Usuario no disponible'; end if;
  select * into f from public.friendships where least(requester_id,addressee_id)=least(auth.uid(),p.id) and greatest(requester_id,addressee_id)=greatest(auth.uid(),p.id);
  allowed:=p.id=auth.uid() or f.status='accepted' or exists(select 1 from public.app_preferences where user_id=p.id and profile_visibility='public');
  result:=jsonb_build_object('username',p.username,'avatar',p.avatar,'level',floor(sqrt(p.xp/100.0))::int+1,
    'private',not coalesce(allowed,false),'relationship',case when p.id=auth.uid() then 'self' when f.status='accepted' then 'friend' when f.requester_id=auth.uid() then 'sent' when f.id is not null then 'received' else 'none' end,'friendship_id',f.id);
  if not coalesce(allowed,false) then return result; end if;
  perform public.settle_leagues();
  select tier into league from public.league_members where user_id=p.id;
  if p_scope='league' then
    select count(*)+1 into position from public.league_members l join public.weekly_xp x on x.user_id=l.user_id
      where l.tier=league and x.week_start=date_trunc('week',public.app_today()::timestamp)::date
      and x.xp>coalesce((select xp from public.weekly_xp where user_id=p.id and week_start=date_trunc('week',public.app_today()::timestamp)::date),0);
  else
    select count(*)+1 into position from public.profiles candidate where candidate.onboarding_completed and candidate.xp>p.xp
      and (p_scope='global' or candidate.id=auth.uid() or exists(select 1 from public.friendships r where r.status='accepted' and ((r.requester_id=auth.uid() and r.addressee_id=candidate.id) or (r.addressee_id=auth.uid() and r.requester_id=candidate.id))));
  end if;
  metrics:=public.user_metrics(p.id);
  return result||jsonb_build_object('league',league,'streak',public.compute_streak(p.id),'position',position,
    'week_xp',coalesce((select xp from public.weekly_xp where user_id=p.id and week_start=date_trunc('week',public.app_today()::timestamp)::date),0),
    'strongest_pillar',(select key from jsonb_each_text(p.pillar_xp) order by value::numeric desc,key limit 1),
    'achievements',coalesce((select jsonb_agg(to_jsonb(a)) from (select a.id,a.name,a.description,a.icon,a.target,a.reward_coins,
      least(coalesce((metrics->>a.metric)::int,0),a.target) progress,exists(select 1 from public.user_achievements where user_id=p.id and achievement_id=a.id) unlocked
      from public.achievements a order by unlocked desc,coalesce((metrics->>a.metric)::numeric,0)/a.target desc,a.sort limit 3) a),'[]'::jsonb));
end $$;$definition$;
  end if;
end $bootstrap$;

revoke all on function public.guard_premium_equipment(),public.guard_routine_quota(),public.guard_exercise_routine(),public.track_weekly_xp(),public.settle_leagues() from public,anon,authenticated;
revoke all on function public.sync_premium_benefits(),public.routine_quota(),public.premium_trends(),public.ranking_rows(text),public.ranking_user_summary(text,text) from public,anon;
grant execute on function public.sync_premium_benefits(),public.routine_quota(),public.premium_trends(),public.ranking_rows(text),public.ranking_user_summary(text,text) to authenticated;
notify pgrst,'reload schema';
commit;
