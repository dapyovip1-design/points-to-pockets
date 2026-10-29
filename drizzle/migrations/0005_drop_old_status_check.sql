-- The original 3-state check contradicts the new lifecycle
-- (pending → approved → processing → paid). The new constraint
-- withdrawals_status_chk already enforces the full status set.
ALTER TABLE public.withdrawals DROP CONSTRAINT withdrawals_status_check;
COMMENT ON CONSTRAINT withdrawals_status_chk ON public.withdrawals IS 'Replaces withdrawals_status_check (pending/paid/rejected only)';