-- Ejecutar manualmente después de 05_economia_avatar.sql. No activa cuentas al aplicarlo.
begin;
create table public.premium_trial_settings (
  id boolean primary key default true check(id),
  enabled boolean not null default true,
  duration_days integer not null default 7 check(duration_days between 1 and 30)
);
insert into public.premium_trial_settings(id) values(true);
alter table public.premium_trial_settings enable row level security;
revoke all on public.premium_trial_settings from public,anon,authenticated;

create table public.premium_trials (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ends_at timestamptz not null,
  check(ends_at>started_at)
);
alter table public.premium_trials enable row level security;
create policy premium_trials_own on public.premium_trials for select to authenticated using(user_id=auth.uid());
revoke all on public.premium_trials from public,anon,authenticated;
grant select on public.premium_trials to authenticated;

create function public.my_premium_status() returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare t public.premium_trials; e public.premium_entitlements; s public.premium_trial_settings;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  select * into t from public.premium_trials where user_id=auth.uid();
  select * into e from public.premium_entitlements where user_id=auth.uid();
  select * into s from public.premium_trial_settings where id;
  return jsonb_build_object('active',public.has_premium(auth.uid()),
    'ends_at',e.ends_at,'trial_used',t.user_id is not null,'trial_ends_at',t.ends_at,
    'trial_available',s.enabled and t.user_id is null and (e.user_id is null or e.ends_at<=now()),
    'duration_days',s.duration_days,'server_now',now(),
    'discount',(select premium_discount from public.economy_rules where id),
    'rename_days',(select premium_rename_days from public.economy_rules where id));
end $$;

create function public.activate_premium_trial() returns jsonb
language plpgsql security definer set search_path=public as $$
declare s public.premium_trial_settings; e public.premium_entitlements; finish timestamptz;
begin
  if auth.uid() is null then raise exception 'Inicia sesión'; end if;
  perform 1 from public.profiles where id=auth.uid() and onboarding_completed for update;
  if not found then raise exception 'Completa primero tu perfil'; end if;
  -- Un reintento, incluso desde otra pestaña, nunca amplía la prueba.
  if exists(select 1 from public.premium_trials where user_id=auth.uid()) then return public.my_premium_status(); end if;
  select * into s from public.premium_trial_settings where id for share;
  if not s.enabled then raise exception 'La prueba gratuita no está disponible'; end if;
  select * into e from public.premium_entitlements where user_id=auth.uid() for update;
  if e.user_id is not null and e.ends_at>now() then raise exception 'Ya tienes Premium activo o programado'; end if;
  finish:=now()+make_interval(days=>s.duration_days);
  insert into public.premium_trials(user_id,started_at,ends_at) values(auth.uid(),now(),finish);
  insert into public.premium_entitlements(user_id,starts_at,ends_at) values(auth.uid(),now(),finish)
    on conflict(user_id) do update set starts_at=excluded.starts_at,ends_at=excluded.ends_at;
  return public.my_premium_status();
end $$;
revoke all on function public.my_premium_status(),public.activate_premium_trial() from public,anon;
grant execute on function public.my_premium_status(),public.activate_premium_trial() to authenticated;
notify pgrst,'reload schema';
commit;
