import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  adminListWithdrawals,
  adminWithdrawalAction,
  adminWithdrawalEvents,
} from "@/lib/admin.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    // Server-side role is re-verified in every admin server function;
    // this guard only keeps non-admins off the page itself.
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: ok } = await supabase.rpc("has_role", {
      _user_id: data.user.id,
      _role: "admin",
    });
    if (!ok) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

type AdminWithdrawal = {
  id: string;
  user_id: string;
  method: string;
  account_number: string;
  amount_usd: string;
  points_spent: number;
  status: string;
  created_at: string;
  processed_at: string | null;
  reference_number: string | null;
  admin_note: string | null;
  refunded: boolean;
  profiles: { display_name: string | null; email: string | null } | null;
};

type AuditEvent = {
  id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  reference_number: string | null;
  note: string | null;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  approve: "قبول الطلب",
  start_payment: "بدء الدفع",
  reject: "رفض + إرجاع النقاط",
  confirm_payment: "تأكيد الدفع",
};

const STATUS_META: Record<string, { text: string; className: string }> = {
  pending: { text: "قيد المراجعة", className: "bg-warning/15 text-warning border border-warning/30" },
  approved: { text: "مقبول", className: "bg-primary/15 text-primary border border-primary/30" },
  processing: { text: "قيد الدفع", className: "bg-gold/15 text-gold border border-gold/30" },
  paid: { text: "مدفوع", className: "bg-success/15 text-success border border-success/30" },
  rejected: { text: "مرفوض", className: "bg-destructive/15 text-destructive border border-destructive/30" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

function AdminPage() {
  const listFn = useServerFn(adminListWithdrawals);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<AdminWithdrawal[]>({
    queryKey: ["admin-withdrawals"],
    queryFn: () => listFn(),
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">لوحة الإدارة — طلبات السحب</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          راجع الطلبات، وثبّت الدفع فقط بعد تحويل الفلوس فعليًا من فودافون كاش.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <div className="card-glow rounded-3xl p-8 text-center text-sm font-bold text-destructive">
          {(error as Error).message}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card-glow rounded-3xl p-10 text-center">
          <span className="text-4xl">🗂️</span>
          <p className="mt-4 font-bold">لا توجد طلبات سحب بعد</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {data.map((w) => (
            <AdminCard key={w.id} w={w} onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] })} />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdminCard({ w, onChanged }: { w: AdminWithdrawal; onChanged: () => void }) {
  const actionFn = useServerFn(adminWithdrawalAction);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [showLog, setShowLog] = useState(false);

  const s = STATUS_META[w.status] ?? {
    text: w.status,
    className: "bg-muted text-muted-foreground border border-border",
  };

  async function run(action: "approve" | "start" | "reject" | "pay") {
    setBusy(true);
    try {
      await actionFn({ data: { id: w.id, action, reference, note } });
      toast.success("تم تنفيذ الإجراء");
      setReference("");
      setNote("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل تنفيذ الإجراء");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="card-glow space-y-4 rounded-3xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-2xl font-black text-primary" dir="ltr">
            ${Number(w.amount_usd).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground" dir="ltr">
            {w.points_spent.toLocaleString("en-US")} pts → فودافون كاش{" "}
            <span className="font-bold text-foreground">{w.account_number}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            المستخدم: <span className="font-bold text-foreground">{w.profiles?.display_name ?? "—"}</span>
            {w.profiles?.email ? ` (${w.profiles.email})` : ""}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground" dir="ltr">
            {w.user_id}
          </p>
          <p className="text-[11px] text-muted-foreground">{formatDate(w.created_at)}</p>
        </div>
        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${s.className}`}>
          {s.text}
        </span>
      </div>

      {w.status === "paid" && w.reference_number && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-xs font-bold text-success" dir="ltr">
          رقم العملية: {w.reference_number}
        </p>
      )}
      {w.status === "rejected" && w.admin_note && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          سبب الرفض: {w.admin_note}
        </p>
      )}

      {w.status !== "paid" && w.status !== "rejected" && (
        <div className="space-y-3 border-t border-border pt-4">
          {(w.status === "processing" || w.status === "pending" || w.status === "approved") && (
            <div className="space-y-2">
              <label className="text-xs font-bold" htmlFor={`ref-${w.id}`}>
                {w.status === "processing" ? "رقم مرجع التحويل (إلزامي للتأكيد)" : "ملاحظة الرفض (اختياري)"}
              </label>
              {w.status === "processing" ? (
                <Input
                  id={`ref-${w.id}`}
                  dir="ltr"
                  placeholder="مثال: 9988776"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  maxLength={100}
                />
              ) : (
                <Input
                  id={`note-${w.id}`}
                  placeholder="سبب الرفض إن وجد"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={300}
                />
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {w.status === "pending" && (
              <Button size="sm" disabled={busy} onClick={() => run("approve")}>
                {busy ? "..." : "✔️ قبول الطلب"}
              </Button>
            )}
            {w.status === "approved" && (
              <Button size="sm" disabled={busy} onClick={() => run("start")}>
                {busy ? "..." : "💳 بدء الدفع"}
              </Button>
            )}
            {w.status === "processing" && (
              <Button size="sm" disabled={busy || reference.trim().length < 3} onClick={() => run("pay")}>
                {busy ? "..." : "✅ تأكيد الدفع"}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => run("reject")}
              className="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              رفض + إرجاع النقاط
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            الرفض يرجع النقاط مرة واحدة فقط، ويُسجَّل كل إجراء في سجل تدقيق محمي لا يمكن للمستخدم
            تعديله. لا تغيّر الحالة إلى «مدفوع» إلا بعد تحويل المبلغ فعليًا.
          </p>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => setShowLog((v) => !v)}
          className="text-xs font-bold text-primary hover:underline"
        >
          {showLog ? "إخفاء سجل الإجراءات" : "سجل الإجراءات"}
        </button>
        {showLog && <AuditLog id={w.id} />}
      </div>
    </li>
  );
}

function AuditLog({ id }: { id: string }) {
  const eventsFn = useServerFn(adminWithdrawalEvents);
  const { data, isLoading } = useQuery<AuditEvent[]>({
    queryKey: ["admin-events", id],
    queryFn: () => eventsFn({ data: { id } }),
  });

  if (isLoading) return <Skeleton className="mt-3 h-16 w-full rounded-xl" />;
  if (!data || data.length === 0)
    return <p className="mt-3 text-xs text-muted-foreground">لا توجد إجراءات مسجلة بعد.</p>;

  return (
    <ul className="mt-3 space-y-2">
      {data.map((ev) => (
        <li key={ev.id} className="rounded-xl bg-panel px-3 py-2 text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">{ACTION_LABELS[ev.action] ?? ev.action}</span>
          {ev.reference_number ? ` — رقم العملية: ${ev.reference_number}` : ""}
          {ev.note ? ` — ${ev.note}` : ""}
          <span className="mx-1">·</span>
          {formatDate(ev.created_at)}
        </li>
      ))}
    </ul>
  );
}
