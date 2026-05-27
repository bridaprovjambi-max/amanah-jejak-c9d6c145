import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface PublicStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
  completionRate: number;
  pokjaCount: number;
  documentsCount: number;
  usersCount: number;
  trend: { date: string; Dibuat: number; Selesai: number }[];
  statusBreakdown: { name: string; value: number }[];
  pokjaLoad: { name: string; Aktif: number; Selesai: number }[];
}

export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    const [tasksRes, pokjaRes, docsRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("tasks")
        .select("status, deadline, created_at, updated_at, assigned_to_pokja"),
      supabaseAdmin.from("pokja").select("id, name"),
      supabaseAdmin.from("documents").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }),
    ]);

    const tasks = tasksRes.data ?? [];
    const pokja = pokjaRes.data ?? [];
    const now = new Date();

    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter(
      (t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now,
    ).length;
    const total = tasks.length;

    // 14-day trend
    const days: Date[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const trend = days.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const created = tasks.filter((t) => {
        const c = new Date(t.created_at);
        return c >= d && c < next;
      }).length;
      const done = tasks.filter((t) => {
        if (t.status !== "completed") return false;
        const u = new Date(t.updated_at);
        return u >= d && u < next;
      }).length;
      const label = d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      return { date: label, Dibuat: created, Selesai: done };
    });

    const statusBreakdown = [
      { name: "Menunggu", value: pending },
      { name: "Berjalan", value: inProgress },
      { name: "Selesai", value: completed },
      { name: "Terlambat", value: overdue },
    ].filter((s) => s.value > 0);

    const pokjaLoad = pokja
      .map((p) => ({
        name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name,
        Aktif: tasks.filter(
          (t) => t.assigned_to_pokja === p.id && t.status !== "completed",
        ).length,
        Selesai: tasks.filter(
          (t) => t.assigned_to_pokja === p.id && t.status === "completed",
        ).length,
      }))
      .filter((c) => c.Aktif + c.Selesai > 0)
      .slice(0, 6);

    return {
      total,
      pending,
      inProgress,
      completed,
      overdue,
      completionRate: total ? Math.round((completed / total) * 100) : 0,
      pokjaCount: pokja.length,
      documentsCount: docsRes.count ?? 0,
      usersCount: profilesRes.count ?? 0,
      trend,
      statusBreakdown,
      pokjaLoad,
    };
  },
);
