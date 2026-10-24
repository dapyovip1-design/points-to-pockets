create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  points integer not null default 0,
  total_earned_points integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  method text not null default 'vodafone_cash',
  account_number text not null,
  amount_usd numeric(10,2) not null,
  points_spent integer not null,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create table public.offerwall_transactions (
  tx_id text primary key,
  user_id uuid not null,
  points integer not null,
  created_at timestamptz not null default now()
);

grant select on public.profiles to authenticated;
grant all on public.withdrawals to service_role;
grant select on public.withdrawals to authenticated;
grant all on public.offerwall_transactions to service_role;

alter table public.profiles enable row level security;
alter table public.withdrawals enable row level security;
alter table public.offerwall_transactions enable row level security;

create policy "Users read own profile" on public.profiles for select to authenticated using (id = auth.uid());
create policy "Users read own withdrawals" on public.withdrawals for select to authenticated using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.request_withdrawal(p_points integer, p_account_number text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_balance integer;
  v_usd numeric;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_account_number is null or length(trim(p_account_number)) < 10 then
    raise exception 'رقم فودافون كاش غير صالح';
  end if;
  if p_points is null or p_points < 1000 then
    raise exception 'الحد الأدنى للسحب 1000 نقطة (1 دولار)';
  end if;
  select points into v_balance from public.profiles where id = v_user for update;
  if v_balance is null then
    raise exception 'الملف الشخصي غير موجود';
  end if;
  if v_balance < p_points then
    raise exception 'رصيد النقاط غير كافٍ';
  end if;
  v_usd := round(p_points / 1000.0, 2);
  update public.profiles set points = points - p_points where id = v_user;
  insert into public.withdrawals (user_id, method, account_number, amount_usd, points_spent)
  values (v_user, 'vodafone_cash', trim(p_account_number), v_usd, p_points)
  returning id into v_id;
  return v_id;
end $$;

revoke execute on function public.request_withdrawal(integer, text) from public, anon;
grant execute on function public.request_withdrawal(integer, text) to authenticated;