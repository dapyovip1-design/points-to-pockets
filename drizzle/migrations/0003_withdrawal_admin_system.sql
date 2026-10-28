-- ===== 1. Admin roles (protected table, no self-assignment possible) =====
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
-- No policies: users can never read or write roles directly.
-- Role checks go through the security-definer function below.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

-- ===== 2. Withdrawal lifecycle columns =====
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS refunded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_by uuid;

COMMENT ON COLUMN public.withdrawals.status IS 'Lifecycle: pending (قيد المراجعة) → approved (مقبول) → processing (قيد الدفع) → paid (مدفوع). Any pre-paid state can be rejected (مرفوض) with a one-time points refund.';

ALTER TABLE public.withdrawals
  ADD CONSTRAINT withdrawals_status_chk CHECK (status IN ('pending','approved','processing','paid','rejected'));

COMMENT ON COLUMN public.withdrawals.refunded IS 'One-time refund flag: set true when an admin rejects the request and returns points_spent to the user profile.';

-- ===== 3. Immutable audit log (users have no privileges at all) =====
CREATE TABLE public.withdrawal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  actor uuid,
  action text NOT NULL,
  from_status text,
  to_status text,
  reference_number text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.withdrawal_events TO service_role;
ALTER TABLE public.withdrawal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read withdrawal audit log"
ON public.withdrawal_events
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== 4. Admin read policies (SELECT only; writes stay in the functions below) =====
CREATE POLICY "Admins read all withdrawals"
ON public.withdrawals
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read all profiles"
ON public.profiles
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ===== 5. Harden the user-side request function (wallet regex) =====
CREATE OR REPLACE FUNCTION public.request_withdrawal(p_points integer, p_account_number text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_balance integer;
  v_usd numeric;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'يجب تسجيل الدخول';
  end if;
  if p_account_number is null or trim(p_account_number) !~ '^01[0125][0-9]{8}$' then
    raise exception 'رقم فودافون كاش غير صالح (11 رقمًا يبدأ بـ 010/011/012/015)';
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
end $function$;

-- ===== 6. Admin action functions (role-verified, atomic, audited) =====
CREATE OR REPLACE FUNCTION public.admin_approve_withdrawal(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_status text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;
  select status into v_status from public.withdrawals where id = p_withdrawal_id for update;
  if v_status is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_status <> 'pending' then
    raise exception 'لا يمكن قبول طلب في حالة %', v_status;
  end if;
  update public.withdrawals set status = 'approved' where id = p_withdrawal_id;
  insert into public.withdrawal_events (withdrawal_id, actor, action, from_status, to_status)
  values (p_withdrawal_id, auth.uid(), 'approve', 'pending', 'approved');
end $$;

CREATE OR REPLACE FUNCTION public.admin_start_payment(p_withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_status text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;
  select status into v_status from public.withdrawals where id = p_withdrawal_id for update;
  if v_status is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_status <> 'approved' then
    raise exception 'لا يمكن بدء الدفع لطلب في حالة %', v_status;
  end if;
  update public.withdrawals set status = 'processing' where id = p_withdrawal_id;
  insert into public.withdrawal_events (withdrawal_id, actor, action, from_status, to_status)
  values (p_withdrawal_id, auth.uid(), 'start_payment', 'approved', 'processing');
end $$;

CREATE OR REPLACE FUNCTION public.admin_reject_withdrawal(p_withdrawal_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_status text;
  v_refunded boolean;
  v_points integer;
  v_user uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;
  select status, refunded, points_spent, user_id
    into v_status, v_refunded, v_points, v_user
  from public.withdrawals where id = p_withdrawal_id for update;
  if v_status is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_status not in ('pending','approved','processing') then
    raise exception 'لا يمكن رفض طلب في حالة %', v_status;
  end if;
  if v_refunded then
    raise exception 'تم إرجاع مبلغ هذا الطلب مسبقًا';
  end if;
  update public.withdrawals
    set status = 'rejected', refunded = true, admin_note = nullif(trim(coalesce(p_note, '')), '')
  where id = p_withdrawal_id;
  update public.profiles set points = points + v_points where id = v_user;
  insert into public.withdrawal_events (withdrawal_id, actor, action, from_status, to_status, note)
  values (p_withdrawal_id, auth.uid(), 'reject', v_status, 'rejected', nullif(trim(coalesce(p_note, '')), ''));
end $$;

CREATE OR REPLACE FUNCTION public.admin_confirm_payment(p_withdrawal_id uuid, p_reference text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  v_status text;
  v_reference text := nullif(trim(coalesce(p_reference, '')), '');
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'غير مصرح لك بهذا الإجراء';
  end if;
  if v_reference is null or length(v_reference) < 3 then
    raise exception 'أدخل رقم مرجع التحويل من فودافون كاش';
  end if;
  select status into v_status from public.withdrawals where id = p_withdrawal_id for update;
  if v_status is null then
    raise exception 'الطلب غير موجود';
  end if;
  if v_status = 'paid' then
    raise exception 'تم تسجيل هذا الطلب كمدفوع مسبقًا';
  end if;
  if v_status <> 'processing' then
    raise exception 'لا يمكن تأكيد الدفع لطلب في حالة %', v_status;
  end if;
  update public.withdrawals
    set status = 'paid', processed_at = now(), paid_by = auth.uid(), reference_number = v_reference
  where id = p_withdrawal_id;
  insert into public.withdrawal_events (withdrawal_id, actor, action, from_status, to_status, reference_number)
  values (p_withdrawal_id, auth.uid(), 'confirm_payment', 'processing', 'paid', v_reference);
end $$;

REVOKE EXECUTE ON FUNCTION
  public.admin_approve_withdrawal(uuid),
  public.admin_start_payment(uuid),
  public.admin_reject_withdrawal(uuid, text),
  public.admin_confirm_payment(uuid, text)
FROM anon, public;
GRANT EXECUTE ON FUNCTION
  public.admin_approve_withdrawal(uuid),
  public.admin_start_payment(uuid),
  public.admin_reject_withdrawal(uuid, text),
  public.admin_confirm_payment(uuid, text)
TO authenticated;

REVOKE EXECUTE ON FUNCTION public.request_withdrawal(integer, text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(integer, text) TO authenticated;