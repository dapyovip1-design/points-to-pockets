import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import heroImage from "@/assets/hero.png";

export const Route = createFileRoute("/")({
  component: Landing,
});

const features = [
  {
    icon: "📋",
    title: "استبيانات ومهام حقيقية",
    text: "آلاف المهام والاستبيانات من شبكة Ayet Studios العالمية، تُكافأ فور إكمالها.",
  },
  {
    icon: "⚡",
    title: "نقاط تتحول إلى دولار",
    text: "كل 1000 نقطة تعادل 1 دولار. رصيدك يتحدث تلقائيًا بعد إكمال أي مهمة.",
  },
  {
    icon: "📱",
    title: "سحب عبر فودافون كاش",
    text: "اطلب سحب أرباحك مباشرة إلى محفظة فودافون كاش، بحد أدنى 1 دولار فقط.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-xl font-black text-primary-foreground shadow-[var(--shadow-glow)]">
            أ
          </span>
          <span className="text-2xl font-extrabold tracking-tight">أرباح</span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/auth"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            تسجيل الدخول
          </Link>
          <Link
            to="/auth"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.03]"
          >
            ابدأ الآن
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-16">
        <section className="grid items-center gap-10 py-10 md:grid-cols-2 md:py-16">
          <div>
            <span className="inline-block rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-primary">
              منصة الربح من المهام رقم 1
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.25] md:text-5xl">
              اربح من <span className="text-primary">الاستبيانات</span> والمهام
              <br />
              <span className="text-gradient-gold">وسحبها فودافون كاش</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground">
              أنشئ حسابك مجانًا، أكمل المهام والاستبيانات من شبكة Ayet Studios،
              واجمع النقاط ثم اسحب أرباحك مباشرة إلى محفظة فودافون كاش.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/auth"
                className="rounded-xl bg-primary px-7 py-3.5 text-base font-bold text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
              >
                أنشئ حسابك مجانًا
              </Link>
              <Link
                to="/auth"
                className="rounded-xl border border-border bg-card px-7 py-3.5 text-base font-bold text-foreground transition-colors hover:bg-accent"
              >
                لدي حساب بالفعل
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-sm">
            <img
              src={heroImage}
              alt="اربح من المهام والاستبيانات"
              className="animate-float w-full rounded-3xl border border-border shadow-[var(--shadow-card)]"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="card-glow rounded-2xl p-6">
              <span className="text-3xl">{f.icon}</span>
              <h3 className="mt-4 text-lg font-bold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>

        <section className="card-glow mt-10 rounded-3xl p-8 text-center">
          <h2 className="text-2xl font-extrabold">كيف تعمل المنصة؟</h2>
          <div className="mt-8 grid gap-8 text-sm md:grid-cols-3">
            {[
              { n: "1", t: "سجّل حسابك بالبريد الإلكتروني في أقل من دقيقة." },
              { n: "2", t: "أكمل الاستبيانات والمهام واجمع النقاط فورًا." },
              { n: "3", t: "اطلب السحب إلى فودافون كاش ومتابعة حالته." },
            ].map((s) => (
              <div key={s.n}>
                <span className="animate-pulse-ring mx-auto grid size-12 place-items-center rounded-full bg-primary text-lg font-black text-primary-foreground">
                  {s.n}
                </span>
                <p className="mt-4 leading-relaxed text-muted-foreground">{s.t}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} منصة أرباح — جميع الحقوق محفوظة
      </footer>
    </div>
  );
}
