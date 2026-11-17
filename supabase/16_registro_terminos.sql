-- Manual, después de 12 y las migraciones anteriores. Aplicar completo.
-- No modifica perfiles existentes ni inventa aceptaciones retroactivas.
begin;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
alter table public.profiles add column if not exists terms_version text;
alter table public.profiles add column if not exists privacy_accepted_at timestamptz;
alter table public.profiles add column if not exists privacy_version text;
alter table public.profiles add column if not exists guardian_authorized_at timestamptz;
alter table public.profiles add column if not exists guardian_authorization_version text;
alter table public.profiles enable row level security;
-- RLS limita filas, no columnas: la tabla sigue siendo privada.
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='registration_profile_private') then
  create policy registration_profile_private on public.profiles as restrictive for select to anon,authenticated using(id=auth.uid());
 end if;
end $$;
revoke select on public.profiles from public,anon;
revoke insert,delete on public.profiles from public,anon,authenticated;
revoke update(birth_date,terms_accepted_at,terms_version,privacy_accepted_at,privacy_version,guardian_authorized_at,guardian_authorization_version) on public.profiles from public,anon,authenticated;
-- Defensa adicional si una instalación anterior concedió UPDATE sobre toda la tabla.
create or replace function public.protect_registration_evidence() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in ('anon','authenticated') and
  (new.birth_date,new.terms_accepted_at,new.terms_version,new.privacy_accepted_at,new.privacy_version,new.guardian_authorized_at,new.guardian_authorization_version)
  is distinct from
  (old.birth_date,old.terms_accepted_at,old.terms_version,old.privacy_accepted_at,old.privacy_version,old.guardian_authorized_at,old.guardian_authorization_version) then
  raise exception 'Estos datos se actualizan mediante una solicitud de rectificación';
 end if;
 return new;
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='public.profiles'::regclass and tgname='protect_registration_evidence' and not tgisinternal) then
  create trigger protect_registration_evidence before update on public.profiles for each row execute function public.protect_registration_evidence();
 end if;
end $$;

-- Las mismas reglas de nombres para registro y cambios posteriores.
create or replace function public.registration_username_check(p_username text,p_exclude uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare u text:=lower(trim(p_username)); cleaned text;
begin
  if u is null or u !~ '^[a-z0-9_]{3,20}$' then return jsonb_build_object('available',false,'message','Usa 3 a 20 letras, números o guion bajo'); end if;
  cleaned:=regexp_replace(translate(u,'013457','oieast'),'[^a-z]','','g');
  if exists(select 1 from public.blocked_username_terms where term=cleaned
    or (term in ('admin','administrador','soporte','support','liferpg','moderador','root') and u~('^'||term||'[0-9_]*$'))
    or term=any(regexp_split_to_array(translate(u,'013457','oieast'),'[^a-z]+'))) then
    return jsonb_build_object('available',false,'message','Ese nombre no está permitido');
  end if;
  if exists(select 1 from public.profiles where lower(username)=u and id is distinct from p_exclude) then
    return jsonb_build_object('available',false,'message','Ese usuario ya está en uso');
  end if;
  if exists(select 1 from public.username_reservations where username=u and user_id is distinct from p_exclude and reserved_until>now()) then
    return jsonb_build_object('available',false,'message','Ese usuario está reservado temporalmente');
  end if;
  return jsonb_build_object('available',true,'message','Disponible');
end $$;
create or replace function public.validate_username_write() returns trigger
language plpgsql security definer set search_path=public as $$
declare status jsonb;
begin
  if new.username is null then return new; end if;
  if tg_op='UPDATE' and new.username is not distinct from old.username then return new; end if;
  new.username:=lower(trim(new.username));
  perform pg_advisory_xact_lock(hashtextextended(new.username,73));
  status:=public.registration_username_check(new.username,new.id);
  if not (status->>'available')::boolean then raise exception '%',status->>'message'; end if;
  return new;
end $$;
-- Disponible sin sesión; devuelve solo disponibilidad y un mensaje, nunca perfiles.
create or replace function public.registration_username_status(p_username text) returns jsonb
language sql stable security definer set search_path=public as $$
 select public.registration_username_check(p_username,null::uuid)
$$;
create or replace function public.username_status(p_username text) returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 return public.registration_username_check(p_username,auth.uid());
end $$;
-- La aceptación se captura una vez desde la solicitud de alta, no desde cambios
-- posteriores de user_metadata. Funciona con y sin confirmación de correo.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
declare m jsonb:=coalesce(new.raw_user_meta_data,'{}'::jsonb);
 u text:=lower(trim(m->>'username')); display_value text:=btrim(m->>'display_name');
 born date; d date:=(now() at time zone 'America/Bogota')::date; age_years int;
 version_value constant text:='2026-11-16.1'; status jsonb; guardian_ok boolean;
begin
 if coalesce(m->>'terms_accepted','')<>'true' or m->>'terms_version' is distinct from version_value
 or m->>'privacy_version' is distinct from version_value or m->>'registration_version' is distinct from version_value then
  raise exception 'Debes aceptar la versión vigente de los términos y la política de privacidad';
 end if;
 if coalesce(m->>'birth_date','') !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Fecha de nacimiento inválida'; end if;
 begin born:=(m->>'birth_date')::date; exception when others then raise exception 'Fecha de nacimiento inválida'; end;
 if born>d then raise exception 'Fecha de nacimiento inválida'; end if;
 age_years:=extract(year from age(d,born))::int;
 if age_years<15 then raise exception 'Puedes registrarte desde los 15 años'; end if;
 guardian_ok:=coalesce(m->>'guardian_authorized','')='true';
 if age_years<18 and not guardian_ok then raise exception 'Falta la autorización declarada del representante legal'; end if;
 if display_value is null or length(display_value) not between 1 and 40 then raise exception 'Escribe tu nombre para mostrar (máximo 40 caracteres)'; end if;
 if u is null or u !~ '^[a-z0-9_]{3,20}$' then raise exception 'Revisa tu nombre de usuario'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u,73));
 status:=public.registration_username_check(u,new.id);
 if not (status->>'available')::boolean then raise exception '%',status->>'message'; end if;
 -- is_public conserva su DEFAULT true; no cambia por la edad.
 insert into public.profiles(id,username,display_name,birth_date,terms_accepted_at,terms_version,
 privacy_accepted_at,privacy_version,guardian_authorized_at,guardian_authorization_version)
 values(new.id,u,display_value,born,now(),version_value,now(),version_value,
 case when age_years<18 then now() else null end,case when age_years<18 then version_value else null end);
 return new;
end $$;
do $$ begin
 if not exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_auth_user_created' and not tgisinternal) then
  create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
 end if;
end $$;
revoke all on function public.registration_username_check(text,uuid),public.validate_username_write(),public.handle_new_user(),public.protect_registration_evidence() from public,anon,authenticated;
revoke all on function public.registration_username_status(text) from public,anon,authenticated;
grant execute on function public.registration_username_status(text) to anon,authenticated;
revoke all on function public.username_status(text) from public,anon;
grant execute on function public.username_status(text) to authenticated;
notify pgrst,'reload schema';
commit;
