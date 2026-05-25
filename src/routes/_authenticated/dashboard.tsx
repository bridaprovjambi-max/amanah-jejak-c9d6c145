import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListChecks, Clock, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, JENJANG_LABEL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { TaskStatus } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  deadline: string | null;
  assigned_by: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  created_at: string;
}

function Dashboard() {
  const { profile, user, hasRole } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });
      setTasks((data as TaskRow[]) ?? []);
      const { data: profs } = await supabase.from("profiles").select("id, full_name");
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string }) => {
        map[p.id] = p.full_name;
      });
      setUserMap(map);
      setLoading(false);
    })();
  }, []);

  const isLeader = hasRole(["kepala", "sekretaris", "admin"]);
  const visible = isLeader
    ? tasks
    : tasks.filter(
        (t) =>
          t.assigned_to === user?.id ||
          t.assigned_by === user?.id ||
          (t.assigned_to_pokja && t.assigned_to_pokja === profile?.pokja_id),
      );

  const stats = {
    total: visible.length,
    pending: visible.filter((t) => t.status === "pending").length,
    inProgress: visible.filter((t) => t.status === "in_progress").length,
    completed: visible.filter((t) => t.status === "completed").length,
    overdue: visible.filter((t) => {
      if (t.status === "completed") return false;
      return t.deadline && new Date(t.deadline) < new Date();
    }).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Selamat datang, {profile?.full_name?.split(" ")[0]}
          </p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">
            Dashboard {isLeader ? "Pemantauan" : "Saya"}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {profile && JENJANG_LABEL[profile.jenjang]}
          </p>
        </div>
        <Link to="/tasks/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Buat Penugasan
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ListChecks}
          label="Total Tugas"
          value={stats.total}
          tone="primary"
        />
        <StatCard
          icon={Clock}
          label="Sedang Berjalan"
          value={stats.inProgress}
          tone="warning"
        />
        <StatCard
          icon={CheckCircle2}
          label="Selesai"
          value={stats.completed}
          tone="success"
        />
        <StatCard
          icon={AlertTriangle}
          label="Terlambat"
          value={stats.overdue}
          tone="destructive"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-display font-semibold">Penugasan Terbaru</h2>
          <Link
            to="/tasks"
            className="text-xs font-medium text-primary hover:underline"
          >
            Lihat semua →
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            Memuat…
          </div>
        ) : visible.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Belum ada penugasan.</p>
            <Link to="/tasks/new">
              <Button variant="outline" size="sm" className="mt-3">
                Buat penugasan pertama
              </Button>
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.slice(0, 8).map((t) => (
              <li key={t.id}>
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: t.id }}
                  className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{t.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Dari <span className="text-foreground">{userMap[t.assigned_by] ?? "—"}</span>
                      {t.assigned_to && (
                        <>
                          {" "}→ <span className="text-foreground">{userMap[t.assigned_to] ?? "—"}</span>
                        </>
                      )}
                      {t.deadline && (
                        <> · Tenggat {new Date(t.deadline).toLocaleDateString("id-ID")}</>
                      )}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      t.status === "completed"
                        ? "completed"
                        : t.deadline && new Date(t.deadline) < new Date()
                        ? "overdue"
                        : t.status
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number;
  tone: "primary" | "warning" | "success" | "destructive";
}) {
  const cls = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning/15 text-warning-foreground",
    success: "bg-success/15 text-success",
    destructive: "bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${cls}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4">
        <div className="text-2xl lg:text-3xl font-display font-bold">{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{label}</div>
      </div>
    </div>
  );
}
