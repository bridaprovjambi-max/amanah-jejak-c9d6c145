import { createFileRoute, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { RouteTransition } from "@/components/RouteTransition";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    // Server-side / pre-render path: no browser session available,
    // let the client gate handle it (avoids SSR redirect loops).
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/" });
    }
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { session, loading } = useAuth();

  if (loading || !session) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="text-sm text-muted-foreground">Memuat…</div>
      </div>
    );
  }
  return (
    <AppShell>
      <RouteTransition />
    </AppShell>
  );
}
