import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const errorMap: Record<string, string> = {
  "Invalid login credentials": "البريد الإلكتروني أو كلمة المرور غير صحيحة",
  "User already registered": "هذا البريد مسجل بالفعل، جرّب تسجيل الدخول",
  "Password should be at least 6 characters": "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
  "Email rate limit exceeded": "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة",
};

function toArabicError(message?: string) {
  if (!message) return "حدث خطأ غير متوقع، حاول مرة أخرى";
  return errorMap[message] ?? message;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(toArabicError(error.message));
          return;
        }
        toast.success("تم تسجيل الدخول بنجاح");
        navigate({ to: "/dashboard" });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() || undefined }, emailRedirectTo: window.location.origin },
        });
        if (error) {
          toast.error(toArabicError(error.message));
          return;
        }
        if (data.session) {
          toast.success("تم إنشاء الحساب بنجاح");
          navigate({ to: "/dashboard" });
        } else {
          setAwaitingConfirm(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInWith(provider: "google" | "lovable") {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error(toArabicError(result.error.message));
    if (result.redirected) return;
  }

  if (awaitingConfirm) {
    return (
      <CenterCard>
        <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/15 text-3xl">📧</span>
        <h1 className="mt-5 text-2xl font-extrabold">تحقق من بريدك الإلكتروني</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          أرسلنا رابط تأكيد إلى <span className="font-semibold text-foreground">{email}</span>.
          افتح الرابط لتفعيل حسابك، ثم سجّل الدخول.
        </p>
        <Button className="mt-6 w-full" onClick={() => setAwaitingConfirm(false)}>
          العودة لصفحة الدخول
        </Button>
      </CenterCard>
    );
  }

  return (
    <CenterCard>
      <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">تسجيل الدخول</TabsTrigger>
          <TabsTrigger value="signup">حساب جديد</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input id="email" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input id="password" type="password" dir="ltr" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جارٍ الدخول..." : "تسجيل الدخول"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup">
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="name">الاسم (اختياري)</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="مثال: أحمد" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="semail">البريد الإلكتروني</Label>
              <Input id="semail" type="email" dir="ltr" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spassword">كلمة المرور</Label>
              <Input id="spassword" type="password" dir="ltr" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 أحرف على الأقل" />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "جارٍ إنشاء الحساب..." : "إنشاء الحساب"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        أو سجّل عبر
        <span className="h-px flex-1 bg-border" />
      </div>

      <button
        type="button"
        onClick={() => signInWith("google")}
        className="lovable-auth-button w-full justify-center"
      >
        المتابعة بحساب Google
      </button>
      <button
        type="button"
        onClick={() => signInWith("lovable")}
        className="lovable-auth-button mt-3 w-full justify-center"
      >
        Continue with Lovable
      </button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        بالمتابعة أنت توافق على شروط الاستخدام.{" "}
        <Link to="/" className="text-primary underline-offset-4 hover:underline">
          الرئيسية
        </Link>
      </p>
    </CenterCard>
  );
}

function CenterCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <div className="card-glow w-full max-w-md rounded-3xl p-8">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-xl font-black text-primary-foreground shadow-[var(--shadow-glow)]">
            أ
          </span>
          <span className="text-2xl font-extrabold">أرباح</span>
        </div>
        {children}
      </div>
    </div>
  );
}
