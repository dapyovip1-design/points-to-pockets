import { createFileRoute } from "@tanstack/react-router";
import { useProfile } from "@/hooks/use-profile";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/tasks")({
  component: TasksPage,
});

function TasksPage() {
  const { data: profile, isLoading } = useProfile();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">المهام والاستبيانات</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            أكمل أي مهمة من القائمة وستُضاف نقاطك تلقائيًا خلال دقائق.
          </p>
        </div>
        <div className="card-glow rounded-2xl px-4 py-2 text-center">
          <p className="text-[11px] font-semibold text-muted-foreground">رصيدك الحالي</p>
          <p className="text-lg font-black text-gradient-gold" dir="ltr">
            {isLoading ? "..." : `${(profile?.points ?? 0).toLocaleString("en-US")} pts`}
          </p>
        </div>
      </div>

      <div className="card-glow rounded-2xl px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        💡 نصيحة: النقاط تظهر هنا تلقائيًا بعد موافقة الشبكة على المهمة (عادةً خلال
        دقائق). لا تغلق هذه الصفحة أثناء إكمال المهمة، وحدّث الرصيد من لوحة التحكم.
      </div>

      {isLoading || !profile ? (
        <Skeleton className="h-[70vh] w-full rounded-3xl" />
      ) : (
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <iframe
            src={`https://offerwall.ayet.io/offers?adSlot=30627&externalIdentifier=${profile.id}`}
            title="جدول المهام والاستبيانات — Ayet Studios"
            className="h-[calc(100vh-230px)] min-h-[480px] w-full"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
