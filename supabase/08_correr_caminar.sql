-- Manual después de 07_premium_ranking.sql. No ejecutado por Codex.
begin;
create table public.running_rules (
 id boolean primary key default true check(id), accuracy_m numeric not null default 30,
 walk_max_mps numeric not null default 3, run_max_mps numeric not null default 8,
 jump_m numeric not null default 200, gap_seconds integer not null default 120,
 sample_seconds integer not null default 5, heartbeat_seconds integer not null default 30,
 gps_xp_per_km integer not null default 10, manual_xp_per_km integer not null default 2,
 daily_xp_cap integer not null default 100, manual_daily_cap integer not null default 10,
 max_points integer not null default 10000,
 check(accuracy_m>0 and walk_max_mps>0 and run_max_mps>0 and heartbeat_seconds between 10 and 60),
 check(gps_xp_per_km>=0 and manual_xp_per_km>=0 and daily_xp_cap>=0 and manual_daily_cap>=0)
);
insert into public.running_rules(id) values(true);
alter table public.running_rules enable row level security;
create policy running_rules_read on public.running_rules for select to authenticated using(true);
revoke all on public.running_rules from public,anon,authenticated;
grant select on public.running_rules to authenticated;

create table public.running_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 activity text not null check(activity in ('walk','run')), mode text not null check(mode in ('gps','manual')),
 status text not null check(status in ('running','paused','completed')),
 started_at timestamptz not null default now(), heartbeat_at timestamptz not null default now(),
 active_seconds integer not null default 0 check(active_seconds between 0 and 43200),
 meters numeric not null default 0 check(meters between 0 and 200000),
 last_seq integer not null default 0, segment integer not null default 0, writer_token uuid not null default gen_random_uuid(),
 last_lat double precision, last_lng double precision, last_point_at timestamptz,
 accepted integer not null default 0, rejected integer not null default 0,
 xp_awarded integer not null default 0, suspicious boolean not null default false,
 completed_on date, finished_at timestamptz, route_deleted boolean not null default false
);
create unique index running_one_active on public.running_sessions(user_id) where status in ('running','paused');
create index running_history on public.running_sessions(user_id,completed_on desc);
create table public.running_points (
 id bigint generated always as identity primary key,
 session_id uuid not null references public.running_sessions(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 accuracy numeric not null check(accuracy between 0 and 30),
 recorded_at timestamptz not null, segment integer not null
);
create index running_route on public.running_points(session_id,id);
alter table public.running_sessions enable row level security;
alter table public.running_points enable row level security;
create policy running_sessions_own on public.running_sessions for select to authenticated using(user_id=auth.uid());
create policy running_points_own on public.running_points for select to authenticated using(user_id=auth.uid());
revoke all on public.running_sessions,public.running_points from public,anon,authenticated;
grant select on public.running_sessions,public.running_points to authenticated;

create function public.running_distance(a double precision,b double precision,c double precision,d double precision) returns double precision
language sql immutable set search_path=public as $$
 select 6371000*2*asin(sqrt(least(1.0,power(sin(radians(c-a)/2),2)+cos(radians(a))*cos(radians(c))*power(sin(radians(d-b)/2),2))))
$$;
create function public.active_run() returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.running_sessions;
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 select * into s from public.running_sessions where user_id=auth.uid() and status in ('running','paused') for update;
 if not found then return null; end if;
 -- Al recuperar una pantalla, se pausa: no se inventa tiempo durante el cierre.
 if s.status='running' then
  update public.running_sessions set status='paused',heartbeat_at=now(),last_lat=null,last_lng=null,last_point_at=null,segment=segment+1 where id=s.id returning * into s;
 end if;
 update public.running_sessions set writer_token=gen_random_uuid() where id=s.id returning * into s;
 return to_jsonb(s);
end $$;
create function public.start_run(p_activity text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.running_sessions;
begin
 if auth.uid() is null or p_activity not in ('walk','run') then raise exception 'Actividad inválida'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into s from public.running_sessions where user_id=auth.uid() and status in ('running','paused');
 if found then raise exception 'Ya tienes una actividad pendiente. Recupérala o descártala'; end if;
 insert into public.running_sessions(user_id,activity,mode,status) values(auth.uid(),p_activity,'gps','running') returning * into s;
 return to_jsonb(s);
end $$;
create function public.finish_run_internal(p_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.running_sessions; r public.running_rules; earned int; total int; manual_total int;
begin
 select * into s from public.running_sessions where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Actividad no disponible'; end if;
 if s.status='completed' then return to_jsonb(s); end if;
 select * into r from public.running_rules where id;
 perform 1 from public.profiles where id=auth.uid() for update;
 select coalesce(sum(xp_awarded),0),coalesce(sum(xp_awarded) filter(where mode='manual'),0) into total,manual_total
  from public.running_sessions where user_id=auth.uid() and status='completed' and completed_on=public.app_today();
 earned:=floor(s.meters/1000*case when s.mode='gps' then r.gps_xp_per_km else r.manual_xp_per_km end)::int;
 if s.active_seconds<60 or s.meters<100 or s.meters/greatest(1,s.active_seconds)>(case when s.activity='walk' then r.walk_max_mps else r.run_max_mps end)
  or (s.rejected>=5 and s.rejected>greatest(1,s.accepted)/2) then earned:=0;s.suspicious:=true;end if;
 earned:=greatest(0,least(earned,r.daily_xp_cap-total));
 if s.mode='manual' then earned:=greatest(0,least(earned,r.manual_daily_cap-manual_total));end if;
 update public.running_sessions set status='completed',finished_at=now(),completed_on=public.app_today(),xp_awarded=earned,suspicious=s.suspicious,
  last_lat=null,last_lng=null,last_point_at=null where id=s.id returning * into s;
 if earned>0 then perform public.award_xp('vitalidad',earned);end if;
 return to_jsonb(s);
end $$;

create function public.save_run(p_id uuid,p_seq integer,p_points jsonb,p_action text default 'save',p_writer uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.running_sessions; r public.running_rules; point jsonb; lat double precision; lng double precision; acc numeric; at_time timestamptz; delta double precision; dt double precision; seconds int;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 if p_action not in ('save','pause','resume','finish') or p_seq is null or jsonb_typeof(p_points)<>'array' or jsonb_array_length(p_points)>60 then raise exception 'Borrador inválido';end if;
 select * into s from public.running_sessions where id=p_id and user_id=auth.uid() for update;
 if not found then raise exception 'Actividad no disponible';end if;
 if p_writer is distinct from s.writer_token then raise exception 'La actividad se recuperó en otra pestaña. Usa una sola pantalla';end if;
 if p_seq<=s.last_seq or s.status='completed' then return to_jsonb(s);end if;
 if p_seq<>s.last_seq+1 then raise exception 'El borrador cambió en otra pestaña. Vuelve a abrir la actividad';end if;
 select * into r from public.running_rules where id;
 seconds:=case when s.status='running' then least(r.heartbeat_seconds+10,greatest(0,floor(extract(epoch from now()-s.heartbeat_at))::int)) else 0 end;
 s.active_seconds:=least(43200,s.active_seconds+seconds);
 if s.status='running' then
  for point in select value from jsonb_array_elements(p_points) loop
   lat:=(point->>'lat')::double precision;lng:=(point->>'lng')::double precision;acc:=(point->>'accuracy')::numeric;at_time:=to_timestamp((point->>'t')::double precision/1000);
   if lat is null or lng is null or acc is null or at_time is null or lat not between -90 and 90 or lng not between -180 and 180 or acc<0 or acc>least(30,r.accuracy_m) or at_time>now()+interval '5 seconds' or at_time<s.started_at-interval '30 seconds' or (s.last_point_at is not null and at_time<=s.last_point_at) then s.rejected:=s.rejected+1;continue;end if;
   delta:=0;
   if s.last_point_at is not null then
    dt:=extract(epoch from at_time-s.last_point_at);
    if dt<r.sample_seconds then continue;end if;
    if dt>r.gap_seconds then s.segment:=s.segment+1;
    else
     delta:=public.running_distance(s.last_lat,s.last_lng,lat,lng);
     if delta > r.jump_m or delta / dt > (
       case when s.activity='walk' then r.walk_max_mps else r.run_max_mps end
     ) then
       s.rejected:=s.rejected+1;
       continue;
     end if;
     if delta<greatest(3,least(acc,15)/2) then continue;end if;
    end if;
   end if;
   if s.accepted>=r.max_points then continue;end if;
   insert into public.running_points(session_id,user_id,latitude,longitude,accuracy,recorded_at,segment) values(s.id,auth.uid(),lat,lng,acc,at_time,s.segment);
   s.meters:=least(200000,s.meters+delta);s.last_lat:=lat;s.last_lng:=lng;s.last_point_at:=at_time;s.accepted:=s.accepted+1;
  end loop;
 elsif jsonb_array_length(p_points)>0 then raise exception 'La actividad está pausada en el servidor';end if;
 if p_action='pause' then s.status:='paused';s.segment:=s.segment+1;s.last_lat:=null;s.last_lng:=null;s.last_point_at:=null;
 elsif p_action='resume' then s.status:='running';s.segment:=s.segment+1;s.last_lat:=null;s.last_lng:=null;s.last_point_at:=null;end if;
 update public.running_sessions set status=s.status,active_seconds=s.active_seconds,meters=s.meters,heartbeat_at=now(),last_seq=p_seq,segment=s.segment,
  last_lat=s.last_lat,last_lng=s.last_lng,last_point_at=s.last_point_at,accepted=s.accepted,rejected=s.rejected where id=s.id returning * into s;
 if p_action='finish' then return public.finish_run_internal(s.id);end if;
 return to_jsonb(s);
end $$;
create function public.log_manual_run(p_activity text,p_meters numeric,p_seconds integer,p_request_id uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.running_sessions;
begin
 if auth.uid() is null or p_activity not in ('walk','run') or p_request_id is null or p_meters is null or p_meters not between 100 and 200000 or p_seconds is null or p_seconds not between 60 and 43200 then raise exception 'Distancia o duración inválida';end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into s from public.running_sessions where id=p_request_id and user_id=auth.uid();
 if found then return to_jsonb(s);end if;
 if exists(select 1 from public.running_sessions where user_id=auth.uid() and status in ('running','paused')) then raise exception 'Finaliza o descarta primero la actividad GPS pendiente';end if;
 insert into public.running_sessions(id,user_id,activity,mode,status,meters,active_seconds) values(p_request_id,auth.uid(),p_activity,'manual','paused',p_meters,p_seconds) returning * into s;
 return public.finish_run_internal(s.id);
end $$;
create function public.delete_run_route(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from public.running_sessions where id=p_id and user_id=auth.uid() and status='completed' for update;
 if not found then raise exception 'Finaliza primero la actividad';end if;
 delete from public.running_points where session_id=p_id and user_id=auth.uid();
 update public.running_sessions set route_deleted=true,last_lat=null,last_lng=null,last_point_at=null where id=p_id;
end $$;
create function public.discard_run(p_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
 delete from public.running_sessions where id=p_id and user_id=auth.uid() and status<>'completed';
 if not found then raise exception 'No hay borrador para descartar';end if;
end $$;
create function public.running_overview() returns jsonb
language sql stable security definer set search_path=public as $$
 with sessions as (select * from public.running_sessions where user_id=auth.uid() and status='completed'),
 days as (select distinct completed_on d from sessions where completed_on<=public.app_today()),
 numbered as (select d,d-(row_number() over(order by d))::int g from days)
 select jsonb_build_object('week_meters',(select coalesce(sum(meters),0) from sessions where completed_on>=date_trunc('week',public.app_today()::timestamp)::date),
 'month_meters',(select coalesce(sum(meters),0) from sessions where completed_on>=date_trunc('month',public.app_today()::timestamp)::date),
 'longest_meters',(select coalesce(max(meters),0) from sessions),
 'best_pace',(select min(active_seconds/(meters/1000)) from sessions where meters>=100 and active_seconds>=60 and not suspicious),
 'streak',(select case when max(d)>=public.app_today()-1 then (select count(*) from numbered where g=(select g from numbered order by d desc limit 1)) else 0 end from numbered))
$$;

create or replace function public.activity_days_with_protection(p_uid uuid) returns table("day" date)
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
 union select completed_on from public.running_sessions where user_id=p_uid and status='completed'
$$;
create or replace function public.my_activity() returns table("day" date,pillar text,entries bigint)
language sql stable security definer set search_path=public as $$
 with activity as (
 select performed_at::date AS "day",pillar from public.habit_logs where user_id=auth.uid()
 union all select performed_at::date,'fuerza' from public.workout_sets where user_id=auth.uid()
 union all select performed_at,'fuerza' from public.workout_sessions where user_id=auth.uid()
 union all select logged_on,'vitalidad' from public.water_logs where user_id=auth.uid()
 union all select slept_on,'vitalidad' from public.sleep_logs where user_id=auth.uid()
 union all select logged_on,'vitalidad' from public.meals where user_id=auth.uid()
 union all select studied_on,'intelecto' from public.edu_sessions where user_id=auth.uid()
 union all select occurred_on,'finanzas' from public.fin_transactions where user_id=auth.uid() and from_recurring is null
 union all select logged_on,'vitalidad' from public.wellbeing_logs where user_id=auth.uid()
 union all select (done_at at time zone 'America/Bogota')::date,'intelecto' from public.edu_tasks where user_id=auth.uid() and done
 union all select completed_on,'vitalidad' from public.running_sessions where user_id=auth.uid() and status='completed')
 select "day",pillar,count(*) from activity where "day" between public.app_today()-89 and public.app_today() group by "day",pillar order by "day" desc
$$;
revoke all on function public.running_distance(double precision,double precision,double precision,double precision),public.finish_run_internal(uuid) from public,anon,authenticated;
revoke all on function public.active_run(),public.start_run(text),public.save_run(uuid,integer,jsonb,text,uuid),public.log_manual_run(text,numeric,integer,uuid),public.delete_run_route(uuid),public.discard_run(uuid),public.running_overview() from public,anon;
grant execute on function public.active_run(),public.start_run(text),public.save_run(uuid,integer,jsonb,text,uuid),public.log_manual_run(text,numeric,integer,uuid),public.delete_run_route(uuid),public.discard_run(uuid),public.running_overview() to authenticated;
notify pgrst,'reload schema';
commit;
