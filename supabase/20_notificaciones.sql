begin;
create table if not exists public.notification_settings(
 user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
 purchases boolean not null default true,friends boolean not null default true,study boolean not null default true,
 habits boolean not null default false,streak boolean not null default false,habit_time time not null default '19:00',streak_time time not null default '21:00'
);
create table if not exists public.app_notifications(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 event_key text not null,kind text not null check(kind in ('purchase','friend_request','friend_accepted','study_complete','habit_reminder','streak_risk')),
 title text not null,body text not null,link text not null check(link in('/tienda','/amigos','/pilares/educacion/estudiar','/pilares/habitos')),
 created_at timestamptz not null default now(),read_at timestamptz,unique(user_id,event_key)
);
create index if not exists notifications_own_date on public.app_notifications(user_id,created_at desc);
alter table public.notification_settings enable row level security;
alter table public.app_notifications enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='notification_settings' and policyname='notifications_settings_own') then create policy notifications_settings_own on public.notification_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='app_notifications' and policyname='notifications_read_own') then create policy notifications_read_own on public.app_notifications for select to authenticated using(user_id=auth.uid());end if;
end $$;
revoke all on public.notification_settings,public.app_notifications from public,anon,authenticated;
grant select,insert,update on public.notification_settings to authenticated;
grant select on public.app_notifications to authenticated;
create or replace function public.emit_app_notification(p_user uuid,p_key text,p_kind text,p_title text,p_body text,p_link text) returns void
language plpgsql security definer set search_path=public as $$
declare settings public.notification_settings; enabled boolean;
begin
 select * into settings from public.notification_settings where user_id=p_user;
 enabled:=case when p_kind='purchase' then coalesce(settings.purchases,true) when p_kind in('friend_request','friend_accepted') then coalesce(settings.friends,true) when p_kind='study_complete' then coalesce(settings.study,true) when p_kind='habit_reminder' then coalesce(settings.habits,false) when p_kind='streak_risk' then coalesce(settings.streak,false) else false end;
 if not enabled then return;end if;
 insert into public.app_notifications(user_id,event_key,kind,title,body,link) values(p_user,p_key,p_kind,p_title,p_body,p_link) on conflict(user_id,event_key) do nothing;
end $$;
create or replace function public.notify_purchase_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare item_name text;
begin
 select name into item_name from public.shop_items where id=new.item_id;
 perform public.emit_app_notification(new.user_id,'purchase:'||new.id,'purchase','Compra confirmada',coalesce(item_name,'Objeto')||' · '||new.price_coins||' monedas.','/tienda');return new;
end $$;
create or replace function public.notify_friend_event() returns trigger
language plpgsql security definer set search_path=public as $$
declare requester text; addressee text;
begin
 select username into requester from public.profiles where id=new.requester_id;
 select username into addressee from public.profiles where id=new.addressee_id;
 if tg_op='INSERT' and new.status='pending' then
  perform public.emit_app_notification(new.addressee_id,'friend-request:'||new.id,'friend_request','Solicitud de amistad',coalesce('@'||requester,'Un usuario')||' quiere agregarte.','/amigos');
 elsif tg_op='UPDATE' and new.status='accepted' and old.status is distinct from new.status then
  perform public.emit_app_notification(new.requester_id,'friend-accepted:'||new.id,'friend_accepted','Amistad confirmada',coalesce('@'||addressee,'Tu contacto')||' aceptó tu solicitud.','/amigos');
  perform public.emit_app_notification(new.addressee_id,'friend-accepted:'||new.id,'friend_accepted','Amistad confirmada','Ahora eres amigo de '||coalesce('@'||requester,'tu contacto')||'.','/amigos');
 end if;return new;
end $$;
create or replace function public.notify_study_event() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if new.timer_session_id is not null then perform public.emit_app_notification(new.user_id,'study:'||new.id,'study_complete','Pomodoro completado',new.minutes||' minutos · +'||coalesce(new.xp_awarded,0)||' XP.','/pilares/educacion/estudiar');end if;return new;
end $$;
create or replace function public.sync_my_reminders() returns void
language plpgsql security definer set search_path=public as $$
declare settings public.notification_settings; d date:=(now() at time zone 'America/Bogota')::date; local_time time:=(now() at time zone 'America/Bogota')::time;
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 select * into settings from public.notification_settings where user_id=auth.uid();
 if exists(select 1 from public.habit_logs where user_id=auth.uid() and performed_at=d) then return;end if;
 if coalesce(settings.habits,false) and local_time>=settings.habit_time then perform public.emit_app_notification(auth.uid(),'habit:'||d,'habit_reminder','Un hábito para hoy','Todavía puedes registrar un hábito hoy.','/pilares/habitos');end if;
 if coalesce(settings.streak,false) and local_time>=settings.streak_time and exists(select 1 from public.habit_logs where user_id=auth.uid() and performed_at=d-1) then perform public.emit_app_notification(auth.uid(),'streak:'||d,'streak_risk','Cuida tu racha','Ayer registraste un hábito. Completa uno hoy para mantener tu constancia.','/pilares/habitos');end if;
end $$;
create or replace function public.read_my_notifications(p_id uuid default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión';end if;
 update public.app_notifications set read_at=coalesce(read_at,now()) where user_id=auth.uid() and (p_id is null or id=p_id);
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='notify_purchase_event' and tgrelid='public.purchases'::regclass and not tgisinternal) then create trigger notify_purchase_event after insert on public.purchases for each row execute function public.notify_purchase_event();end if;
 if not exists(select 1 from pg_trigger where tgname='notify_friend_event' and tgrelid='public.friendships'::regclass and not tgisinternal) then create trigger notify_friend_event after insert or update of status on public.friendships for each row execute function public.notify_friend_event();end if;
 if not exists(select 1 from pg_trigger where tgname='notify_study_event' and tgrelid='public.edu_sessions'::regclass and not tgisinternal) then create trigger notify_study_event after insert on public.edu_sessions for each row execute function public.notify_study_event();end if;
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='app_notifications') then alter publication supabase_realtime add table public.app_notifications;end if;
end $$;
revoke all on function public.emit_app_notification(uuid,text,text,text,text,text),public.notify_purchase_event(),public.notify_friend_event(),public.notify_study_event() from public,anon,authenticated;
revoke all on function public.sync_my_reminders(),public.read_my_notifications(uuid) from public,anon;
grant execute on function public.sync_my_reminders(),public.read_my_notifications(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
