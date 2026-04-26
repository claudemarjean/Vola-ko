-- Vola-ko SQL refactor
-- Objectif: DB unique source of truth, calculs finances centralises.

create or replace function public.volako_available_balance(p_user_id uuid)
returns numeric
language sql
stable
as $$
  with inc as (
    select coalesce(sum(amount), 0) total from volako_incomes where user_id = p_user_id
  ), exp as (
    select coalesce(sum(amount), 0) total from volako_expenses where user_id = p_user_id
  ), sav as (
    select
      coalesce(sum(case when type = 'add' then amount else 0 end), 0) added,
      coalesce(sum(case when type = 'withdraw' then amount else 0 end), 0) withdrawn
    from volako_savings_transactions where user_id = p_user_id
  )
  select (inc.total - exp.total - sav.added + sav.withdrawn) from inc, exp, sav;
$$;

create or replace function public.volako_total_saved(p_user_id uuid)
returns numeric
language sql
stable
as $$
  select coalesce(sum(balance), 0) from volako_savings where user_id = p_user_id;
$$;

create or replace function public.volako_get_dashboard_snapshot(p_user_id uuid)
returns table (
  available_balance numeric,
  total_income_month numeric,
  total_expenses_month numeric,
  total_saved numeric,
  savings_count integer,
  budget_remaining numeric
)
language sql
stable
as $$
  with period as (
    select date_trunc('month', now())::date as d1, (date_trunc('month', now()) + interval '1 month - 1 day')::date as d2
  ), month_inc as (
    select coalesce(sum(amount), 0) total
    from volako_incomes, period
    where user_id = p_user_id and date between period.d1 and period.d2
  ), month_exp as (
    select coalesce(sum(amount), 0) total
    from volako_expenses, period
    where user_id = p_user_id and date between period.d1 and period.d2
  ), bud as (
    select coalesce(sum(amount), 0) total from volako_budgets where user_id = p_user_id
  )
  select
    public.volako_available_balance(p_user_id),
    month_inc.total,
    month_exp.total,
    public.volako_total_saved(p_user_id),
    (select count(*)::int from volako_savings where user_id = p_user_id),
    (bud.total - month_exp.total)
  from month_inc, month_exp, bud;
$$;

create or replace function public.volako_get_income_stats()
returns table (month_total numeric, year_total numeric)
language sql
stable
as $$
  with uid as (
    select auth.uid() as user_id
  )
  select
    coalesce((
      select sum(i.amount)
      from volako_incomes i, uid
      where i.user_id = uid.user_id
        and i.date >= date_trunc('month', now())::date
        and i.date <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
    ), 0) as month_total,
    coalesce((
      select sum(i.amount)
      from volako_incomes i, uid
      where i.user_id = uid.user_id
        and i.date >= (date_trunc('month', now()) - interval '11 month')::date
    ), 0) as year_total;
$$;

create or replace function public.volako_get_dashboard_recent_transactions(p_user_id uuid, p_limit integer default 5)
returns table (id uuid, date date, label text, category text, amount numeric, tx_type text)
language sql
stable
as $$
  select * from (
    select i.id, i.date, i.source as label, 'income'::text as category, i.amount, 'income'::text as tx_type
    from volako_incomes i where i.user_id = p_user_id
    union all
    select e.id, e.date, e.description as label, e.category, e.amount, 'expense'::text as tx_type
    from volako_expenses e where e.user_id = p_user_id
  ) t
  order by t.date desc
  limit p_limit;
$$;

create or replace function public.volako_get_dashboard_category_breakdown(p_user_id uuid)
returns table (category text, total numeric)
language sql
stable
as $$
  select category, coalesce(sum(amount),0) total
  from volako_expenses
  where user_id = p_user_id
    and date >= date_trunc('month', now())::date
    and date <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
  group by category;
$$;

create or replace function public.volako_get_dashboard_trend7(p_user_id uuid)
returns table (day_label text, income numeric, expense numeric)
language sql
stable
as $$
  with days as (
    select generate_series(current_date - interval '6 day', current_date, interval '1 day')::date d
  )
  select
    to_char(days.d, 'DD/MM') as day_label,
    coalesce((select sum(amount) from volako_incomes where user_id = p_user_id and date = days.d), 0) as income,
    coalesce((select sum(amount) from volako_expenses where user_id = p_user_id and date = days.d), 0) as expense
  from days
  order by days.d;
$$;

create or replace function public.volako_get_dashboard_budget_usage(p_user_id uuid)
returns table (category text, budget numeric, spent numeric, remaining numeric)
language sql
stable
as $$
  with month_exp as (
    select category, coalesce(sum(amount),0) total
    from volako_expenses
    where user_id = p_user_id
      and date >= date_trunc('month', now())::date
      and date <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
    group by category
  )
  select
    b.category,
    b.amount as budget,
    coalesce(me.total, 0) as spent,
    greatest(b.amount - coalesce(me.total, 0), 0) as remaining
  from volako_budgets b
  left join month_exp me on me.category = b.category
  where b.user_id = p_user_id;
$$;

create or replace function public.volako_get_dashboard_balance_12m(p_user_id uuid)
returns table (month_label text, balance numeric)
language sql
stable
as $$
  with months as (
    select generate_series(date_trunc('month', current_date) - interval '11 month', date_trunc('month', current_date), interval '1 month')::date m
  )
  select
    to_char(m, 'Mon YY') as month_label,
    coalesce((select sum(amount) from volako_incomes where user_id = p_user_id and date >= m and date < (m + interval '1 month')), 0)
    - coalesce((select sum(amount) from volako_expenses where user_id = p_user_id and date >= m and date < (m + interval '1 month')), 0)
    as balance
  from months
  order by m;
$$;

create or replace function public.volako_get_report_summary(p_user_id uuid, p_period text)
returns table (total_income numeric, total_expenses numeric, balance numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  ), totals as (
    select
      coalesce((select sum(amount) from volako_incomes i, d where i.user_id = p_user_id and i.date >= d.d1),0) as inc,
      coalesce((select sum(amount) from volako_expenses e, d where e.user_id = p_user_id and e.date >= d.d1),0) as exp
  )
  select inc, exp, (inc-exp) from totals;
$$;

create or replace function public.volako_get_report_category_breakdown(p_user_id uuid, p_period text)
returns table (category text, total numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  )
  select e.category, coalesce(sum(e.amount), 0) total
  from volako_expenses e, d
  where e.user_id = p_user_id and e.date >= d.d1
  group by e.category;
$$;

create or replace function public.volako_get_report_monthly_comparison(p_user_id uuid, p_period text)
returns table (month_label text, income numeric, expense numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  ), months as (
    select generate_series((select d1 from d), date_trunc('month', current_date), interval '1 month')::date m
  )
  select
    to_char(m, 'Mon YY') as month_label,
    coalesce((select sum(amount) from volako_incomes where user_id = p_user_id and date >= m and date < (m + interval '1 month')),0) as income,
    coalesce((select sum(amount) from volako_expenses where user_id = p_user_id and date >= m and date < (m + interval '1 month')),0) as expense
  from months
  order by m;
$$;

create or replace function public.volako_get_report_expense_trend(p_user_id uuid, p_period text)
returns table (day_label text, amount numeric, cumulative numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  ), grouped as (
    select e.date, coalesce(sum(e.amount), 0) amount
    from volako_expenses e, d
    where e.user_id = p_user_id and e.date >= d.d1
    group by e.date
  )
  select
    to_char(g.date, 'DD Mon') as day_label,
    g.amount,
    sum(g.amount) over(order by g.date asc) as cumulative
  from grouped g
  order by g.date;
$$;

create or replace function public.volako_get_report_top_expenses(p_user_id uuid, p_period text)
returns table (description text, category text, amount numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  )
  select description, category, amount
  from volako_expenses, d
  where user_id = p_user_id and date >= d.d1
  order by amount desc
  limit 5;
$$;

create or replace function public.volako_get_report_weekly(p_user_id uuid, p_period text)
returns table (weekday integer, total numeric)
language sql
stable
as $$
  with d as (
    select case
      when p_period = 'month' then date_trunc('month', now())::date
      when p_period = 'quarter' then (date_trunc('month', now()) - interval '2 month')::date
      else (date_trunc('month', now()) - interval '11 month')::date
    end as d1
  )
  select extract(dow from date)::int as weekday, coalesce(sum(amount), 0) total
  from volako_expenses, d
  where user_id = p_user_id and date >= d.d1
  group by extract(dow from date)
  order by weekday;
$$;

create or replace function public.volako_get_budget_progress(p_user_id uuid)
returns table (id uuid, category text, amount numeric, spent numeric, remaining numeric, other_reference text, notes text)
language sql
stable
as $$
  with month_exp as (
    select category, coalesce(sum(amount),0) total
    from volako_expenses
    where user_id = p_user_id
      and date >= date_trunc('month', now())::date
      and date <= (date_trunc('month', now()) + interval '1 month - 1 day')::date
    group by category
  )
  select
    b.id,
    b.category,
    b.amount,
    coalesce(me.total, 0) as spent,
    greatest(b.amount - coalesce(me.total, 0), 0) as remaining,
    b.other_reference,
    b.notes
  from volako_budgets b
  left join month_exp me on me.category = b.category
  where b.user_id = p_user_id;
$$;

create or replace function public.volako_get_savings_stats(p_user_id uuid)
returns table (total_saved numeric, active_goals integer, avg_progress numeric)
language sql
stable
as $$
  with base as (
    select * from volako_savings where user_id = p_user_id
  ), goals as (
    select * from base where type = 'goal' and coalesce(target_amount,0) > 0
  )
  select
    coalesce((select sum(balance) from base), 0) as total_saved,
    (select count(*)::int from base where type = 'goal') as active_goals,
    coalesce((select avg(least((balance / nullif(target_amount, 0)) * 100, 100)) from goals), 0) as avg_progress;
$$;

create or replace function public.volako_apply_savings_transaction(
  p_user_id uuid,
  p_savings_id uuid,
  p_type text,
  p_amount numeric,
  p_description text,
  p_date date
)
returns jsonb
language plpgsql
as $$
declare
  v_saving_balance numeric;
  v_available_balance numeric;
begin
  if p_amount <= 0 then
    raise exception 'Montant invalide';
  end if;

  select balance into v_saving_balance
  from volako_savings
  where id = p_savings_id and user_id = p_user_id
  for update;

  if v_saving_balance is null then
    raise exception 'Epargne introuvable';
  end if;

  v_available_balance := public.volako_available_balance(p_user_id);

  if p_type = 'add' then
    if v_available_balance < p_amount then
      raise exception 'SOLDE_INSUFFISANT';
    end if;

    update volako_savings
    set balance = balance + p_amount,
        updated_at = now()
    where id = p_savings_id and user_id = p_user_id;

  elsif p_type = 'withdraw' then
    if v_saving_balance < p_amount then
      raise exception 'EPARGNE_INSUFFISANTE';
    end if;

    update volako_savings
    set balance = balance - p_amount,
        updated_at = now()
    where id = p_savings_id and user_id = p_user_id;
  else
    raise exception 'Type de transaction invalide';
  end if;

  insert into volako_savings_transactions (id, user_id, savings_id, type, amount, description, date, created_at)
  values (gen_random_uuid(), p_user_id, p_savings_id, p_type, p_amount, p_description, p_date, now());

  return jsonb_build_object('success', true);
end;
$$;

create or replace function public.volako_validate_expense_before_write()
returns trigger
language plpgsql
as $$
declare
  v_available_balance numeric;
begin
  v_available_balance := public.volako_available_balance(new.user_id);

  if v_available_balance < new.amount then
    raise exception 'SOLDE_INSUFFISANT';
  end if;

  return new;
end;
$$;

drop trigger if exists volako_expense_balance_guard on volako_expenses;
create trigger volako_expense_balance_guard
before insert on volako_expenses
for each row execute function public.volako_validate_expense_before_write();
