import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard", label: "الرئيسية", icon: "🏠" },
  { to: "/tasks", label: "المهام", icon: "📋" },
  { to: "/withdraw", label: "السحب", icon: "💸" },
  { to: "/withdrawals", label: "السجل", icon: "🧾" },
] as const;

const adminNavItem = { to: "/admin", label: "الإدارة", icon: "🛡️" } as const;

/** Admin link is rendered from the server-side role table (has_role), never from local state. */
function useIsAdmin() {
  const query = useQuery({
    queryKey: ["is-admin"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return false;
      const { data: ok } = await supabase.rpc("has_role", {
        _user_id: data.user.id,
        _role: "admin",
      });
      return ok === true;
    },
    staleTime: 60_000,
  });
  return query.data === true;
}

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-[var(--shadow-glow)]">
              أ
            </span>
            <span className="text-xl font-extrabold">أرباح</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground" }}
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                to={adminNavItem.to}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-muted hover:text-gold"
                activeProps={{ className: "bg-muted text-gold" }}
              >
                🛡️ الإدارة
              </Link>
            )}
          </nav>
          <button
            onClick={handleSignOut}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
          >
            خروج
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        <Outlet />
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:hidden">
        <div className={cn("grid", isAdmin ? "grid-cols-5" : "grid-cols-4")}>
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground"
              activeProps={{ className: cn("text-primary") }}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              to={adminNavItem.to}
              className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-gold"
              activeProps={{ className: cn("text-gold") }}
            >
              <span className="text-lg">{adminNavItem.icon}</span>
              {adminNavItem.label}
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
