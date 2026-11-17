begin;
-- Control de deudas independiente de los movimientos: no duplica gastos ni da XP.
create table if not exists public.fin_debts(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 request_id uuid not null,name text not null check(length(btrim(name)) between 1 and 80),
 principal numeric(14,2) not null check(principal>0),deadline date,created_at timestamptz not null default now(),unique(user_id,request_id)
);
create table if not exists public.fin_debt_payments(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 debt_id uuid not null references public.fin_debts(id),request_id uuid not null,amount numeric(14,2) not null check(amount>0),
 paid_on date not null,description text not null default '' check(length(description)<=200),created_at timestamptz not null default now(),unique(user_id,request_id)
);
create index if not exists debt_payments_debt on public.fin_debt_payments(debt_id,paid_on);
alter table public.fin_debts enable row level security;
alter table public.fin_debt_payments enable row level security;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fin_debts' and policyname='debts_own') then create policy debts_own on public.fin_debts for select to authenticated using(user_id=auth.uid()); end if;
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='fin_debt_payments' and policyname='payments_own') then create policy payments_own on public.fin_debt_payments for select to authenticated using(user_id=auth.uid()); end if;
end $$;
revoke all on public.fin_debts,public.fin_debt_payments from public,anon,authenticated;
grant select on public.fin_debts,public.fin_debt_payments to authenticated;
create or replace function public.create_debt(p_name text,p_principal numeric,p_deadline date,p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare existing public.fin_debts; result uuid;
begin
 if auth.uid() is null or p_request is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into existing from public.fin_debts where user_id=auth.uid() and request_id=p_request;
 if found then
  if existing.name is distinct from btrim(p_name) or existing.principal is distinct from p_principal or existing.deadline is distinct from p_deadline then raise exception 'La solicitud cambió'; end if;
  return existing.id;
 end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 80 or p_principal is null or p_principal<=0 or p_principal>999999999999.99 or p_principal<>round(p_principal,2) then raise exception 'Revisa el nombre y el monto'; end if;
 insert into public.fin_debts(user_id,request_id,name,principal,deadline) values(auth.uid(),p_request,btrim(p_name),p_principal,p_deadline) returning id into result;
 return result;
end $$;
create or replace function public.pay_debt(p_debt uuid,p_amount numeric,p_date date,p_description text,p_request uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare debt public.fin_debts; existing public.fin_debt_payments; result uuid; paid numeric; d date:=(now() at time zone 'America/Bogota')::date;
begin
 if auth.uid() is null or p_request is null then raise exception 'Inicia sesión'; end if;
 perform 1 from public.profiles where id=auth.uid() for update;
 select * into debt from public.fin_debts where id=p_debt and user_id=auth.uid() for update;
 if not found then raise exception 'Deuda no disponible'; end if;
 select * into existing from public.fin_debt_payments where user_id=auth.uid() and request_id=p_request;
 if found then
  if existing.debt_id is distinct from p_debt or existing.amount is distinct from p_amount or existing.paid_on is distinct from p_date or existing.description is distinct from coalesce(btrim(p_description),'') then raise exception 'La solicitud cambió'; end if;
  return existing.id;
 end if;
 if p_amount is null or p_amount<=0 or p_amount>debt.principal or p_amount<>round(p_amount,2) or p_date is null or p_date>d or length(coalesce(p_description,''))>200 then raise exception 'Revisa el abono y la fecha'; end if;
 select coalesce(sum(amount),0) into paid from public.fin_debt_payments where debt_id=p_debt and user_id=auth.uid();
 if p_amount>debt.principal-paid then raise exception 'El abono supera el saldo pendiente'; end if;
 insert into public.fin_debt_payments(user_id,debt_id,request_id,amount,paid_on,description) values(auth.uid(),p_debt,p_request,p_amount,p_date,coalesce(btrim(p_description),'')) returning id into result;
 return result;
end $$;
revoke all on function public.create_debt(text,numeric,date,uuid),public.pay_debt(uuid,numeric,date,text,uuid) from public,anon;
grant execute on function public.create_debt(text,numeric,date,uuid),public.pay_debt(uuid,numeric,date,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
