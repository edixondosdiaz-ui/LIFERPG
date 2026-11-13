-- Aplicar manualmente. No cambia registros, XP ni preferencias anteriores.
begin;
create table if not exists public.health_layout_preferences (
  user_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  section_order text[] not null default array['running','water','sleep','food'],
  constraint health_layout_valid_order check (
    array_ndims(section_order)=1 and cardinality(section_order)=4 and array_position(section_order,null) is null
    and section_order @> array['running','water','sleep','food']
    and section_order <@ array['running','water','sleep','food']
  )
);
alter table public.health_layout_preferences enable row level security;
do $$ begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='health_layout_preferences' and policyname='health_layout_own') then
    create policy health_layout_own on public.health_layout_preferences for all to authenticated
      using(user_id=auth.uid()) with check(user_id=auth.uid());
  end if;
end $$;
revoke all on public.health_layout_preferences from anon;
grant select,insert,update on public.health_layout_preferences to authenticated;
notify pgrst,'reload schema';
commit;
