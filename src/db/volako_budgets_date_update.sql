-- ============================================================
-- MAJ BUDGETS: ajout periode start_date / end_date
-- Compatible avec une base existante.
-- ============================================================

begin;

create extension if not exists btree_gist;

alter table public.volako_budgets
  add column if not exists start_date date,
  add column if not exists end_date date;

-- Backfill: si dates absentes, utiliser le mois de created_at
update public.volako_budgets
set start_date = coalesce(start_date, date_trunc('month', created_at)::date),
    end_date = coalesce(end_date, (date_trunc('month', created_at) + interval '1 month - 1 day')::date)
where start_date is null
   or end_date is null;

alter table public.volako_budgets
  alter column start_date set not null,
  alter column end_date set not null,
  alter column start_date set default date_trunc('month', now())::date,
  alter column end_date set default (date_trunc('month', now()) + interval '1 month - 1 day')::date;

alter table public.volako_budgets
  drop constraint if exists volako_budgets_period_check;

alter table public.volako_budgets
  add constraint volako_budgets_period_check
  check (start_date <= end_date);

-- Empêche les chevauchements de période sur une meme categorie par utilisateur.
alter table public.volako_budgets
  drop constraint if exists volako_budgets_no_overlap_excl;

alter table public.volako_budgets
  add constraint volako_budgets_no_overlap_excl
  exclude using gist (
    user_id with =,
    category with =,
    daterange(start_date, end_date, '[]') with &&
  );

create index if not exists volako_budgets_user_category_dates_idx
  on public.volako_budgets(user_id, category, start_date, end_date);

commit;
