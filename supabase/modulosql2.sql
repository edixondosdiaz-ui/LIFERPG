begin;
 
-- 1. PRIVACIDAD ---------------------------------------------------------------
-- Antes, el nombre por defecto era el inicio del correo (juan.perez@... → "juan.perez")
-- y el ranking global se lo mostraría a todos. Ahora el perfil nuevo nace sin nombre.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
 
-- Borra los nombres que se habían generado a partir del correo
update public.profiles p
   set display_name = null
  from auth.users u
 where u.id = p.id
   and p.display_name = split_part(coalesce(u.email, ''), '@', 1);
 
-- Ranking: usa el username si lo eligieron; si no, "Jugador-xxxx" (nunca el correo)
create or replace view public.leaderboard as
  select id,
         coalesce(nullif(username, ''), nullif(display_name, ''), 'Jugador-' || left(id::text, 4)) as name,
         coalesce(xp, 0) as xp
  from public.profiles;
 
-- 2. EDITAR EL PROPIO PERFIL -------------------------------------------------
-- Sin esto, guardar username o país desde la app no hace nada (RLS lo bloquea en silencio).
-- Solo se permiten esas columnas: nunca xp ni pillar_xp.
drop policy if exists "profiles: editar el propio" on public.profiles;
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
 
revoke update on public.profiles from authenticated;
grant update (username, country, display_name) on public.profiles to authenticated;
 
-- 3. AMIGOS: quien acepta solo puede cambiar el estado, no el resto de la fila ---
revoke update on public.friendships from authenticated;
grant update (status) on public.friendships to authenticated;
 
-- 4. FUNCIONES: solo para usuarios con sesión iniciada -------------------------
revoke all on function public.log_workout_set(uuid, numeric, integer, smallint, integer, text) from public, anon;
grant execute on function public.log_workout_set(uuid, numeric, integer, smallint, integer, text) to authenticated;
 
revoke all on function public.log_health(text, numeric, time, time, text) from public, anon;
grant execute on function public.log_health(text, numeric, time, time, text) to authenticated;
 
revoke all on function public.log_study(text, integer, text) from public, anon;
grant execute on function public.log_study(text, integer, text) to authenticated;
 
revoke all on function public.log_finance(text, numeric, text, text, uuid) from public, anon;
grant execute on function public.log_finance(text, numeric, text, text, uuid) to authenticated;
 
commit;
 
-- Pide a Supabase que recargue su caché de tablas (por si el error del ranking persiste)
notify pgrst, 'reload schema';