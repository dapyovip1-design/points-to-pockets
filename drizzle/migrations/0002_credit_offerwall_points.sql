create or replace function public.credit_offerwall_points(p_user_id uuid, p_points integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set points = points + p_points,
      total_earned_points = total_earned_points + p_points
  where id = p_user_id
$$;

revoke execute on function public.credit_offerwall_points(uuid, integer) from public, anon, authenticated;
grant execute on function public.credit_offerwall_points(uuid, integer) to service_role;