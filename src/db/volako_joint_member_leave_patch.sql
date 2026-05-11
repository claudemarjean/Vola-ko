-- Patch: ajoute la fonction RPC permettant a un membre de quitter un compte conjoint
-- A executer dans Supabase SQL Editor si l appel RPC renvoie PGRST202.

begin;

create or replace function public.volako_member_leave_joint_account()
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_member_id uuid := auth.uid();
begin
  if v_member_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  update public.volako_joint_account_links
  set status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where status = 'active'
    and member_user_id = v_member_id;

  if not found then
    raise exception 'ACTIVE_MEMBER_LINK_NOT_FOUND';
  end if;

  return true;
end;
$$;

grant execute on function public.volako_member_leave_joint_account() to authenticated;

-- Demande a PostgREST de rafraichir le schema cache (si extension disponible).
do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end;
$$;

commit;
