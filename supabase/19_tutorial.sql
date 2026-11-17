begin;
-- Usuarios existentes no reciben un tutorial forzado ni una finalización inventada.
alter table public.profiles add column if not exists tutorial_seen boolean not null default true;
alter table public.profiles alter column tutorial_seen set default false;
alter table public.profiles add column if not exists tutorial_completed_at timestamptz;
alter table public.profiles add column if not exists tutorial_skipped_at timestamptz;
alter table public.profiles add column if not exists tutorial_version text;
create or replace function public.finish_tutorial(p_skipped boolean default false) returns void
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or p_skipped is null then raise exception 'Inicia sesión'; end if;
 update public.profiles set tutorial_seen=true,tutorial_version='2026-11-v1',
 tutorial_completed_at=case when not p_skipped then coalesce(tutorial_completed_at,now()) else tutorial_completed_at end,
 tutorial_skipped_at=case when p_skipped then coalesce(tutorial_skipped_at,now()) else tutorial_skipped_at end
 where id=auth.uid() and onboarding_completed;
 if not found then raise exception 'Completa primero tu perfil'; end if;
end $$;
create or replace function public.guard_tutorial_evidence() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in ('anon','authenticated') and (new.tutorial_seen,new.tutorial_completed_at,new.tutorial_skipped_at,new.tutorial_version) is distinct from (old.tutorial_seen,old.tutorial_completed_at,old.tutorial_skipped_at,old.tutorial_version) then raise exception 'Usa el tutorial para actualizar este estado';end if;
 return new;
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='guard_tutorial_evidence' and tgrelid='public.profiles'::regclass and not tgisinternal) then create trigger guard_tutorial_evidence before update on public.profiles for each row execute function public.guard_tutorial_evidence();end if;
end $$;
revoke update(tutorial_seen,tutorial_completed_at,tutorial_skipped_at,tutorial_version) on public.profiles from public,anon,authenticated;
revoke all on function public.guard_tutorial_evidence() from public,anon,authenticated;
revoke all on function public.finish_tutorial(boolean) from public,anon;
grant execute on function public.finish_tutorial(boolean) to authenticated;
notify pgrst,'reload schema';
commit;
