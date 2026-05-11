-- ============================================================
-- JOINT ACCOUNTS: exact email invite + request workflow + shared scope
-- ============================================================

begin;

create extension if not exists pgcrypto;

create table if not exists public.volako_joint_account_links (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (admin_user_id, member_user_id)
);

create table if not exists public.volako_joint_account_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index if not exists volako_joint_links_one_active_admin_idx
  on public.volako_joint_account_links(admin_user_id)
  where status = 'active';

create unique index if not exists volako_joint_links_one_active_member_idx
  on public.volako_joint_account_links(member_user_id)
  where status = 'active';

create unique index if not exists volako_joint_requests_one_pending_pair_idx
  on public.volako_joint_account_requests(requester_user_id, target_user_id)
  where status = 'pending';

create index if not exists volako_joint_requests_target_status_idx
  on public.volako_joint_account_requests(target_user_id, status, created_at desc);

create index if not exists volako_joint_requests_requester_status_idx
  on public.volako_joint_account_requests(requester_user_id, status, created_at desc);

alter table public.volako_joint_account_links enable row level security;
alter table public.volako_joint_account_requests enable row level security;

drop policy if exists "Joint links participants read" on public.volako_joint_account_links;
create policy "Joint links participants read"
  on public.volako_joint_account_links
  for select
  using (admin_user_id = auth.uid() or member_user_id = auth.uid());

drop policy if exists "Joint requests participants read" on public.volako_joint_account_requests;
create policy "Joint requests participants read"
  on public.volako_joint_account_requests
  for select
  using (requester_user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists "Joint requests requester insert" on public.volako_joint_account_requests;
create policy "Joint requests requester insert"
  on public.volako_joint_account_requests
  for insert
  with check (requester_user_id = auth.uid() and status = 'pending');

create or replace function public.volako_set_joint_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists volako_joint_links_set_updated_at on public.volako_joint_account_links;
create trigger volako_joint_links_set_updated_at
before update on public.volako_joint_account_links
for each row
execute function public.volako_set_joint_updated_at();

drop trigger if exists volako_joint_requests_set_updated_at on public.volako_joint_account_requests;
create trigger volako_joint_requests_set_updated_at
before update on public.volako_joint_account_requests
for each row
execute function public.volako_set_joint_updated_at();

create or replace function public.volako_can_access_user_data(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    p_owner_user_id = auth.uid()
    or exists (
      select 1
      from public.volako_joint_account_links l
      where l.status = 'active'
        and l.admin_user_id = p_owner_user_id
        and l.member_user_id = auth.uid()
    );
$$;

create or replace function public.volako_get_data_scope_user()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (
      select l.admin_user_id
      from public.volako_joint_account_links l
      where l.status = 'active'
        and l.member_user_id = auth.uid()
      limit 1
    ),
    auth.uid()
  );
$$;

create or replace function public.volako_find_user_by_exact_email(p_email text)
returns table (
  user_id uuid,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    u.id as user_id,
    u.email::text,
    coalesce(u.raw_user_meta_data ->> 'name', split_part(u.email::text, '@', 1))::text as display_name
  from auth.users u
  where lower(trim(u.email::text)) = lower(trim(p_email))
  limit 1;
$$;

create or replace function public.volako_send_joint_account_request(p_target_email text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_requester_id uuid := auth.uid();
  v_requester_email text;
  v_target_id uuid;
  v_target_email text;
  v_existing_request_id uuid;
begin
  if v_requester_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select lower(trim(u.email::text))
  into v_requester_email
  from auth.users u
  where u.id = v_requester_id;

  select u.id, lower(trim(u.email::text))
  into v_target_id, v_target_email
  from auth.users u
  where lower(trim(u.email::text)) = lower(trim(p_target_email))
  limit 1;

  if v_target_id is null then
    raise exception 'EMAIL_NOT_FOUND';
  end if;

  if v_target_id = v_requester_id then
    raise exception 'SELF_INVITE_NOT_ALLOWED';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.admin_user_id = v_requester_id
  ) then
    raise exception 'REQUESTER_IS_ADMIN_WITH_ACTIVE_MEMBER';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.member_user_id = v_requester_id
  ) then
    raise exception 'REQUESTER_IS_ALREADY_MEMBER';
  end if;

  select r.id
  into v_existing_request_id
  from public.volako_joint_account_requests r
  where r.requester_user_id = v_requester_id
    and r.target_user_id = v_target_id
    and r.status = 'pending'
  limit 1;

  if v_existing_request_id is not null then
    return v_existing_request_id;
  end if;

  insert into public.volako_joint_account_requests (
    requester_user_id,
    requester_email,
    target_user_id,
    target_email,
    status
  ) values (
    v_requester_id,
    coalesce(v_requester_email, ''),
    v_target_id,
    coalesce(v_target_email, lower(trim(p_target_email))),
    'pending'
  )
  returning id into v_existing_request_id;

  return v_existing_request_id;
end;
$$;

create or replace function public.volako_accept_joint_account_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_id uuid := auth.uid();
  v_requester_id uuid;
  v_request_status text;
  v_has_own_data boolean := false;
begin
  if v_target_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select r.requester_user_id, r.status
  into v_requester_id, v_request_status
  from public.volako_joint_account_requests r
  where r.id = p_request_id
    and r.target_user_id = v_target_id
  limit 1;

  if v_requester_id is null then
    raise exception 'REQUEST_NOT_FOUND';
  end if;

  if v_request_status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.admin_user_id = v_requester_id
  ) then
    raise exception 'REQUESTER_IS_ADMIN_WITH_ACTIVE_MEMBER';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.member_user_id = v_requester_id
  ) then
    raise exception 'REQUESTER_IS_ALREADY_MEMBER';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.admin_user_id = v_target_id
  ) then
    raise exception 'TARGET_IS_ADMIN_WITH_ACTIVE_MEMBER';
  end if;

  if exists (
    select 1 from public.volako_joint_account_links l
    where l.status = 'active'
      and l.member_user_id = v_target_id
  ) then
    raise exception 'TARGET_IS_ALREADY_MEMBER';
  end if;

  select (
    exists(select 1 from public.volako_incomes i where i.user_id = v_target_id) or
    exists(select 1 from public.volako_expenses e where e.user_id = v_target_id) or
    exists(select 1 from public.volako_budgets b where b.user_id = v_target_id) or
    exists(select 1 from public.volako_savings s where s.user_id = v_target_id) or
    exists(select 1 from public.volako_savings_transactions st where st.user_id = v_target_id) or
    exists(select 1 from public.volako_categories c where c.user_id = v_target_id)
  )
  into v_has_own_data;

  if v_has_own_data then
    raise exception 'TARGET_DATA_NOT_EMPTY';
  end if;

  insert into public.volako_joint_account_links (admin_user_id, member_user_id, status)
  values (v_requester_id, v_target_id, 'active')
  on conflict (admin_user_id, member_user_id)
  do update set
    status = 'active',
    revoked_at = null,
    updated_at = now();

  update public.volako_joint_account_requests
  set status = 'accepted',
      responded_at = now(),
      updated_at = now()
  where id = p_request_id;

  update public.volako_joint_account_requests
  set status = 'rejected',
      responded_at = now(),
      updated_at = now()
  where status = 'pending'
    and id <> p_request_id
    and (requester_user_id = v_requester_id or target_user_id = v_target_id);

  return v_requester_id;
end;
$$;

create or replace function public.volako_reject_joint_account_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_target_id uuid := auth.uid();
begin
  if v_target_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update public.volako_joint_account_requests
  set status = 'rejected',
      responded_at = now(),
      updated_at = now()
  where id = p_request_id
    and target_user_id = v_target_id
    and status = 'pending';

  if not found then
    raise exception 'REQUEST_NOT_FOUND_OR_ALREADY_HANDLED';
  end if;

  return true;
end;
$$;

create or replace function public.volako_get_joint_account_state()
returns table (
  role text,
  admin_user_id uuid,
  admin_email text,
  member_user_id uuid,
  member_email text,
  status text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return;
  end if;

  return query
  select
    'admin'::text as role,
    l.admin_user_id,
    a.email::text as admin_email,
    l.member_user_id,
    m.email::text as member_email,
    l.status
  from public.volako_joint_account_links l
  join auth.users a on a.id = l.admin_user_id
  join auth.users m on m.id = l.member_user_id
  where l.status = 'active'
    and l.admin_user_id = v_uid
  limit 1;

  if found then
    return;
  end if;

  return query
  select
    'member'::text as role,
    l.admin_user_id,
    a.email::text as admin_email,
    l.member_user_id,
    m.email::text as member_email,
    l.status
  from public.volako_joint_account_links l
  join auth.users a on a.id = l.admin_user_id
  join auth.users m on m.id = l.member_user_id
  where l.status = 'active'
    and l.member_user_id = v_uid
  limit 1;
end;
$$;

create or replace function public.volako_admin_remove_joint_member(p_member_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_admin_id uuid := auth.uid();
begin
  if v_admin_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update public.volako_joint_account_links
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where status = 'active'
    and admin_user_id = v_admin_id
    and member_user_id = p_member_user_id;

  if not found then
    raise exception 'ACTIVE_LINK_NOT_FOUND';
  end if;

  return true;
end;
$$;

grant execute on function public.volako_can_access_user_data(uuid) to authenticated;
grant execute on function public.volako_get_data_scope_user() to authenticated;
grant execute on function public.volako_find_user_by_exact_email(text) to authenticated;
grant execute on function public.volako_send_joint_account_request(text) to authenticated;
grant execute on function public.volako_accept_joint_account_request(uuid) to authenticated;
grant execute on function public.volako_reject_joint_account_request(uuid) to authenticated;
grant execute on function public.volako_get_joint_account_state() to authenticated;
grant execute on function public.volako_admin_remove_joint_member(uuid) to authenticated;

do $$
declare
  table_name text;
  table_names text[] := array[
    'volako_incomes',
    'volako_expenses',
    'volako_budgets',
    'volako_savings',
    'volako_savings_transactions',
    'volako_categories'
  ];
begin
  foreach table_name in array table_names loop
    execute format('drop policy if exists %I on public.%I', 'Joint select access', table_name);
    execute format('drop policy if exists %I on public.%I', 'Joint insert access', table_name);
    execute format('drop policy if exists %I on public.%I', 'Joint update access', table_name);
    execute format('drop policy if exists %I on public.%I', 'Joint delete access', table_name);

    execute format(
      'create policy %I on public.%I for select using (public.volako_can_access_user_data(user_id))',
      'Joint select access',
      table_name
    );

    execute format(
      'create policy %I on public.%I for insert with check (public.volako_can_access_user_data(user_id))',
      'Joint insert access',
      table_name
    );

    execute format(
      'create policy %I on public.%I for update using (public.volako_can_access_user_data(user_id)) with check (public.volako_can_access_user_data(user_id))',
      'Joint update access',
      table_name
    );

    execute format(
      'create policy %I on public.%I for delete using (public.volako_can_access_user_data(user_id))',
      'Joint delete access',
      table_name
    );
  end loop;
end;
$$;

commit;
