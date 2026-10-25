import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/withdrawals")({
  component: WithdrawalsPage,
});

type Withdrawal = Database["public"]["Tables"]["withdrawals"]["Row"];

const statusMeta: Record<Withdrawal["status"], { text: string; className: string; icon: string }> = {
  pending: { text: "قيد الانتظار", className: "bg-warning/15 text-warning border border-warning/30", icon: "⏳" },
  paid: { text: "تم الصرف", className: "bg-success/15 text-success border border-success/30", icon: "✅" },
  rejected: { text: "مرفوض", className: "bg-destructive/15 text-destructive border border-destructive/30", icon: "❌" },
};

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function WithdrawalsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Withdrawal[]>({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return [];
      const { data: rows, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return rows;
    },
    refetchInterval: 30_000,
  });

  // Live updates when an admin marks a request as paid.
  useEffect(() => {
    const channel = supabase
      .channel("withdrawals-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "withdrawals" },
        () => queryClient.invalidateQueries({ queryKey: ["withdrawals"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">سجل السحوبات</h1>
          <p className="mt-1 text-sm text-muted-foreground">تابع حالة كل طلب سحب قدمته.</p>
        </div>
        <Link
          to="/withdraw"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          سحب جديد
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : !data || data.length === 0 ? (
        <div className="card-glow rounded-3xl p-10 text-center">
          <span className="text-4xl">🧾</span>
          <p className="mt-4 font-bold">لا توجد سحوبات بعد</p>
          <p className="mt-2 text-sm text-muted-foreground">
            أكمل المهام واجمع 1000 نقطة على الأقل، ثم اطلب أول سحب لك.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((w) => {
            const s = statusMeta[w.status];
            return (
              <li key={w.id} className="card-glow rounded-2xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-primary" dir="ltr">
                      ${Number(w.amount_usd).toFixed(2)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
                      {w.points_spent.toLocaleString("en-US")} pts → فودافون كاش{" "}
                      <span className="font-semibold">{w.account_number}</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${s.className}`}>
                    {s.icon} {s.text}
                  </span>
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">{formatDate(w.created_at)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
