import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Admin server functions for the manual withdrawal pipeline.
 *
 * Every function:
 *  1. authenticates the caller via requireSupabaseAuth,
 *  2. re-verifies the admin role server-side through the security-definer
 *     has_role() function (RLS alone never authorizes these actions),
 *  3. performs state changes only through the audited SQL functions
 *     (admin_approve_withdrawal / admin_start_payment /
 *     admin_reject_withdrawal / admin_confirm_payment), which enforce the
 *     role check and status transitions atomically inside the database.
 */

const ACTIONS = ["approve", "start", "reject", "pay"] as const;
type Action = (typeof ACTIONS)[number];

async function assertAdmin(supabase: SupabaseClient<Database>, userId: string) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || data !== true) {
    throw new Error("غير مصرح لك بهذا الإجراء");
  }
}

export const adminListWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("withdrawals")
      .select("*, profiles(display_name, email)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const adminWithdrawalAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { id: string; action: Action; reference?: string; note?: string }) => {
      if (!input || typeof input.id !== "string" || input.id.length !== 36) {
        throw new Error("معرّف الطلب غير صالح");
      }
      if (!ACTIONS.includes(input.action)) {
        throw new Error("إجراء غير معروف");
      }
      return {
        id: input.id,
        action: input.action,
        reference: typeof input.reference === "string" ? input.reference.trim() : undefined,
        note: typeof input.note === "string" ? input.note.trim() : undefined,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);

    if (data.action === "approve") {
      const { error } = await context.supabase.rpc("admin_approve_withdrawal", {
        p_withdrawal_id: data.id,
      });
      if (error) throw new Error(error.message);
    } else if (data.action === "start") {
      const { error } = await context.supabase.rpc("admin_start_payment", {
        p_withdrawal_id: data.id,
      });
      if (error) throw new Error(error.message);
    } else if (data.action === "reject") {
      const { error } = await context.supabase.rpc("admin_reject_withdrawal", {
        p_withdrawal_id: data.id,
        p_note: data.note ?? null,
      });
      if (error) throw new Error(error.message);
    } else {
      if (!data.reference || data.reference.length < 3 || data.reference.length > 100) {
        throw new Error("أدخل رقم مرجع التحويل من فودافون كاش");
      }
      const { error } = await context.supabase.rpc("admin_confirm_payment", {
        p_withdrawal_id: data.id,
        p_reference: data.reference,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const adminWithdrawalEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input || typeof input.id !== "string" || input.id.length !== 36) {
      throw new Error("معرّف الطلب غير صالح");
    }
    return { id: input.id };
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: rows, error } = await context.supabase
      .from("withdrawal_events")
      .select("id, action, from_status, to_status, reference_number, note, created_at")
      .eq("withdrawal_id", data.id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows;
  });
