-- ============================================================
-- MAJ SAVINGS_TRANSACTIONS: description facultative + dates auto
-- Compatible avec une base existante.
-- ============================================================

begin;

alter table public.volako_savings_transactions
  add column if not exists description text,
  add column if not exists date date,
  add column if not exists created_at timestamptz,
  add column if not exists updated_at timestamptz;

-- Backfill pour les anciennes lignes
update public.volako_savings_transactions
set date = coalesce(date, created_at::date, current_date),
    created_at = coalesce(created_at, now()),
    updated_at = coalesce(updated_at, now())
where date is null
   or created_at is null
   or updated_at is null;

alter table public.volako_savings_transactions
  alter column date set default current_date,
  alter column date set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

create or replace function public.volako_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.volako_set_savings_transaction_date()
returns trigger
language plpgsql
as $$
begin
  if new.date is null then
    new.date = timezone('Indian/Antananarivo', now())::date;
  end if;
  return new;
end;
$$;

drop trigger if exists volako_savings_transactions_set_date_before_insert
  on public.volako_savings_transactions;

create trigger volako_savings_transactions_set_date_before_insert
before insert on public.volako_savings_transactions
for each row
execute function public.volako_set_savings_transaction_date();

drop trigger if exists volako_savings_transactions_set_updated_at
  on public.volako_savings_transactions;

create trigger volako_savings_transactions_set_updated_at
before update on public.volako_savings_transactions
for each row
execute function public.volako_set_updated_at();

create index if not exists volako_savings_transactions_user_date_idx
  on public.volako_savings_transactions(user_id, date desc);

commit;
