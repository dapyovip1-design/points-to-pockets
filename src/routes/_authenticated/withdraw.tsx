import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, POINTS_PER_USD } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/withdraw")({
  component: WithdrawPage,
});

const QUICK_AMOUNTS = [1000, 2000, 5000];

function WithdrawPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useProfile();

  const [points, setPoints] = useState("");
  const [account, setAccount] = useState("");
  const [busy, setBusy] = useState(false);

  const balance = profile?.points ?? 0;
  const requestedPoints = Number(points) || 0;
  const usd = requestedPoints / POINTS_PER_USD;
  const insufficient = requestedPoints > balance;
  const belowMin = requestedPoints > 0 && requestedPoints < POINTS_PER_USD;
  const validPhone = /^01[0125][0-9]{8}$/.test(account.trim());
  const canSubmit = requestedPoints >= POINTS_PER_USD && !insufficient && validPhone && !busy;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("request_withdrawal", {
        p_points: requestedPoints,
        p_account_number: account.trim(),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("تم إرسال طلب السحب بنجاح، ستجده في سجل السحوبات");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      await queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
      navigate({ to: "/withdrawals" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">سحب الأرباح</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          حوّل نقاطك إلى رصيد فودافون كاش — كل 1000 نقطة = 1 دولار.
        </p>
      </div>

      <div className="card-glow rounded-3xl p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-muted-foreground">رصيد نقاطك الحالي</span>
          <span className="text-xl font-black text-gradient-gold" dir="ltr">
            {isLoading ? "..." : `${balance.toLocaleString("en-US")} pts`}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
          ≈ ${(balance / POINTS_PER_USD).toFixed(2)}
        </p>
      </div>

      <form onSubmit={submit} className="card-glow space-y-5 rounded-3xl p-6">
        <div className="space-y-2">
          <Label htmlFor="points">المبلغ المطلوب (بالنقاط)</Label>
          <Input
            id="points"
            type="number"
            inputMode="numeric"
            min={1000}
            step={100}
            dir="ltr"
            placeholder="1000"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setPoints(String(amt))}
                className="rounded-full border border-border bg-panel px-3.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                dir="ltr"
              >
                {amt.toLocaleString("en-US")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPoints(String(balance))}
              className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              سحب الكل
            </button>
          </div>
          {requestedPoints > 0 && (
            <p className="text-xs font-semibold text-primary" dir="ltr">
              = ${usd.toFixed(2)} USD
            </p>
          )}
          {insufficient && (
            <p className="text-xs font-semibold text-destructive">الرصيد غير كافٍ لهذا المبلغ</p>
          )}
          {belowMin && !insufficient && (
            <p className="text-xs font-semibold text-warning">
              الحد الأدنى للسحب 1000 نقطة (1 دولار)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="account">رقم فودافون كاش</Label>
          <Input
            id="account"
            type="tel"
            dir="ltr"
            inputMode="numeric"
            placeholder="01xxxxxxxxx"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
          {account.length > 0 && !validPhone && (
            <p className="text-xs font-semibold text-destructive">
              أدخل رقم محفظة صحيح (11 رقمًا يبدأ بـ 010 أو 011 أو 012 أو 015)
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={!canSubmit}>
          {busy ? "جارٍ إرسال الطلب..." : "إرسال طلب السحب"}
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          يتم صرف الطلبات يدويًا خلال 24–48 ساعة. يمكنك متابعة حالة الطلب من سجل
          السحوبات.
        </p>
      </form>
    </div>
  );
}
