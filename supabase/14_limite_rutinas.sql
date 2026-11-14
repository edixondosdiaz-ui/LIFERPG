-- Aplicar manualmente después de 07. Solo cambia configuración del plan;
-- no borra rutinas ni modifica datos de usuarios. Premium continúa sin límite.
begin;
-- Único valor del límite: tanto el RPC como el trigger leen feature_rules.
alter table public.feature_rules alter column free_routines set default 7;
insert into public.feature_rules(id) values(true)
  on conflict(id) do update set free_routines=excluded.free_routines;

create or replace function public.guard_routine_quota() returns trigger
language plpgsql security definer set search_path=public as $$
declare plan_limit integer;
begin
  -- Serializa creaciones concurrentes de una misma cuenta.
  perform 1 from public.profiles where id=new.user_id for update;
  if public.has_premium(new.user_id) then return new; end if;
  select free_routines into strict plan_limit from public.feature_rules where id;
  if (select count(*) from public.routines where user_id=new.user_id)>=plan_limit then
    raise exception 'Ya tienes el máximo de % rutinas de tu plan Gratis. Premium permite rutinas ilimitadas.', plan_limit;
  end if;
  return new;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgname='guard_routine_quota'
    and tgrelid='public.routines'::regclass and not tgisinternal) then
    create trigger guard_routine_quota before insert on public.routines
      for each row execute function public.guard_routine_quota();
  end if;
end $$;
-- Conserva RLS y permisos existentes: la configuración no es editable por cliente.
revoke all on function public.guard_routine_quota() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
