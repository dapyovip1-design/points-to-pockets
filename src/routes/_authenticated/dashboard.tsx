import { createFileRoute, Link } from "@tanstack/react-router";
import { useProfile, POINTS_PER_USD } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Withdrawal = Database["public"]["Tables"]["withdrawals"]["Row"];

const statusLabels: Record<string, { text: string; className: string }> = {
  pending: { text: "قيد الانتظار", className: "bg-warning/15 text-warning" },
  paid: { text: "تم الصرف", className: "bg-success/15 text-success" },
  rejected: { text: "مرفوض", className: "bg-destructive/15 text-destructive" },
};

function Dashboard() {
  const { data: profile, isLoading } = useProfile();

  const recent = useQuery<Withdrawal[]>({
    queryKey: ["withdrawals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const usd = (profile?.points ?? 0) / POINTS_PER_USD;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">
          أهلًا {profile?.display_name || "بك"} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          هذه لوحة حسابك — تابع رصيدك وابدأ بكسب النقاط.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="card-glow relative overflow-hidden rounded-3xl p-6">
          <div className="absolute -left-8 -top-8 size-32 rounded-full bg-gold/10 blur-2xl" />
          <p className="text-sm font-semibold text-muted-foreground">رصيد النقاط</p>
          <p className="mt-2 text-5xl font-black text-gradient-gold" dir="ltr">
            {isLoading ? "..." : (profile?.points ?? 0).toLocaleString("en-US")}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            إجمالي المكتسب: {(profile?.total_earned_points ?? 0).toLocaleString("en-US")} نقطة
          </p>
        </div>
        <div className="card-glow relative overflow-hidden rounded-3xl p-6">
          <div className="absolute -left-8 -top-8 size-32 rounded-full bg-primary/10 blur-2xl" />
          <p className="text-sm font-semibold text-muted-foreground">رصيد الدولار (USD)</p>
          <p className="mt-2 text-5xl font-black text-primary" dir="ltr">
            {isLoading ? "..." : `$${usd.toFixed(2)}`}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">كل 1000 نقطة = 1 دولار</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/tasks"
          className="card-glow group rounded-3xl p-6 transition-colors hover:bg-accent"
        >
          <span className="text-3xl">📋</span>
          <h2 className="mt-3 text-lg font-bold">المهام والاستبيانات</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            أكمل المهام من شبكة Ayet Studios واربح نقاطًا فورًا.
          </p>
          <span className="mt-4 inline-block text-sm font-bold text-primary group-hover:underline">
            ابدأ الآن ←
          </span>
        </Link>
        <Link
          to="/withdraw"
          className="card-glow group rounded-3xl p-6 transition-colors hover:bg-accent"
        >
          <span className="text-3xl">💸</span>
          <h2 className="mt-3 text-lg font-bold">سحب الأرباح</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            حوّل نقاطك إلى رصيد فودافون كاش بحد أدنى 1 دولار.
          </p>
          <span className="mt-4 inline-block text-sm font-bold text-primary group-hover:underline">
            اطلب سحبًا ←
          </span>
        </Link>
      </div>

      {recent.data && recent.data.length > 0 && (
        <section className="card-glow rounded-3xl p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">آخر السحوبات</h2>
            <Link to="/withdrawals" className="text-sm font-semibold text-primary hover:underline">
              السجل الكامل ←
            </Link>
          </div>
          <ul className="mt-4 space-y-3">
            {recent.data.map((w) => {
              const s = statusLabels[w.status] ?? { text: w.status, className: "bg-muted text-muted-foreground" };
              return (
                <li key={w.id} className="flex items-center justify-between rounded-xl bg-panel px-4 py-3">
                  <span className="text-sm font-bold" dir="ltr">
                    ${Number(w.amount_usd).toFixed(2)}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${s.className}`}>
                    {s.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
