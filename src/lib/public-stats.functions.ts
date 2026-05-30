import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

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

interface RawTask {
  status: string;
  deadline: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_pokja: string | null;
}
interface RawPokja {
  id: string;
  name: string;
}
interface RawAggregate {
  tasks: RawTask[];
  pokja: RawPokja[];
  documentsCount: number;
  usersCount: number;
}

export const getPublicStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicStats> => {
    // Anon client (no service-role key). The underlying RPC is SECURITY DEFINER
    // and returns ONLY aggregate-safe columns explicitly.
    const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
    const anonKey =
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
    const sb = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await sb.rpc("get_public_stats_aggregate");
    if (error) throw new Error(error.message);
    const agg = data as unknown as RawAggregate;

    const tasks = agg.tasks ?? [];
    const pokja = agg.pokja ?? [];
    const now = new Date();

    const pending = tasks.filter((t) => t.status === "pending").length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const completed = tasks.filter((t) => t.status === "completed").length;
    const overdue = tasks.filter(
      (t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now,
    ).length;
    const total = tasks.length;

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
      documentsCount: agg.documentsCount ?? 0,
      usersCount: agg.usersCount ?? 0,
      trend,
      statusBreakdown,
      pokjaLoad,
    };
  },
);
