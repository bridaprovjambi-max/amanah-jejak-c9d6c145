import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  TrendingUp,
  Users,
  Layers,
  FileText,
  Activity,
  Target,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays, startOfDay, isAfter } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, JENJANG_LABEL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import type { TaskStatus } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

interface TaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  deadline: string | null;
  assigned_by: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  created_at: string;
  updated_at: string;
}

interface PokjaRow {
  id: string;
  name: string;
}

interface ProfileLite {
  id: string;
  full_name: string;
}

const CHART_COLORS = {
  navy: "oklch(0.21 0.06 255)",
  mid: "oklch(0.36 0.08 245)",
  teal: "oklch(0.55 0.08 215)",
  aqua: "oklch(0.75 0.07 195)",
  warning: "oklch(0.74 0.15 75)",
  destructive: "oklch(0.58 0.21 25)",
  success: "oklch(0.62 0.14 160)",
};

function Dashboard() {
  const { profile, user, hasRole } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [pokjaList, setPokjaList] = useState<PokjaRow[]>([]);
  const [counts, setCounts] = useState({ users: 0, pokja: 0, documents: 0, reports: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [tasksRes, profsRes, pokjaRes, docsRes, reportsRes] = await Promise.all([
        supabase.from("tasks").select("*").order("created_at", { ascending: false }),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("pokja").select("id, name"),
        supabase.from("documents").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
      ]);
      setTasks((tasksRes.data as TaskRow[]) ?? []);
      const map: Record<string, string> = {};
      (profsRes.data ?? []).forEach((p: ProfileLite) => (map[p.id] = p.full_name));
      setUserMap(map);
      setPokjaList((pokjaRes.data as PokjaRow[]) ?? []);
      setCounts({
        users: profsRes.data?.length ?? 0,
        pokja: pokjaRes.data?.length ?? 0,
        documents: docsRes.count ?? 0,
        reports: reportsRes.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const isLeader = hasRole(["kepala", "sekretaris", "admin"]);
  const visible = useMemo(
    () =>
      isLeader
        ? tasks
        : tasks.filter(
            (t) =>
              t.assigned_to === user?.id ||
              t.assigned_by === user?.id ||
              (t.assigned_to_pokja && t.assigned_to_pokja === profile?.pokja_id),
          ),
    [isLeader, tasks, user?.id, profile?.pokja_id],
  );

  const stats = useMemo(() => {
    const now = new Date();
    return {
      total: visible.length,
      pending: visible.filter((t) => t.status === "pending").length,
      inProgress: visible.filter((t) => t.status === "in_progress").length,
      completed: visible.filter((t) => t.status === "completed").length,
      overdue: visible.filter(
        (t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now,
      ).length,
      highPriority: visible.filter((t) => t.priority === "high" && t.status !== "completed").length,
    };
  }, [visible]);

  const completionRate = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;

  // 14-day trend: tasks created vs completed per day
  const trendData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => startOfDay(subDays(new Date(), 13 - i)));
    return days.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const created = visible.filter((t) => {
        const c = new Date(t.created_at);
        return c >= d && c < next;
      }).length;
      const completed = visible.filter((t) => {
        if (t.status !== "completed") return false;
        const u = new Date(t.updated_at);
        return u >= d && u < next;
      }).length;
      return {
        date: format(d, "dd MMM", { locale: localeId }),
        Dibuat: created,
        Selesai: completed,
      };
    });
  }, [visible]);

  // Status breakdown for donut
  const statusBreakdown = useMemo(
    () => [
      { name: "Menunggu", value: stats.pending, color: CHART_COLORS.mid },
      { name: "Berjalan", value: stats.inProgress, color: CHART_COLORS.aqua },
      { name: "Selesai", value: stats.completed, color: CHART_COLORS.success },
      { name: "Terlambat", value: stats.overdue, color: CHART_COLORS.destructive },
    ].filter((s) => s.value > 0),
    [stats],
  );

  // Pokja load
  const pokjaLoad = useMemo(() => {
    const counts = pokjaList.map((p) => ({
      name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name,
      Aktif: tasks.filter(
        (t) => t.assigned_to_pokja === p.id && t.status !== "completed",
      ).length,
      Selesai: tasks.filter(
        (t) => t.assigned_to_pokja === p.id && t.status === "completed",
      ).length,
    }));
    return counts.filter((c) => c.Aktif + c.Selesai > 0).slice(0, 6);
  }, [pokjaList, tasks]);

  // Upcoming deadlines (next 7 days)
  const upcoming = useMemo(() => {
    const now = new Date();
    const week = new Date();
    week.setDate(now.getDate() + 7);
    return visible
      .filter(
        (t) =>
          t.status !== "completed" &&
          t.deadline &&
          new Date(t.deadline) >= now &&
          new Date(t.deadline) <= week,
      )
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime())
      .slice(0, 5);
  }, [visible]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Selamat datang, {profile?.full_name?.split(" ")[0]}
          </p>
          <h1 className="font-display text-2xl lg:text-3xl font-bold text-primary">
            Dashboard {isLeader ? "Pemantauan" : "Saya"}
          </h1>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mt-1.5 font-medium">
            {profile && JENJANG_LABEL[profile.jenjang]}
          </p>
        </div>
        <Link to="/tasks/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Buat Penugasan
          </Button>
        </Link>
      </div>

      {/* Hero stat band */}
      <div className="relative overflow-hidden rounded-xl bg-hero-navy text-white shadow-lg">
        <div className="absolute inset-0 bg-grid-soft opacity-60 pointer-events-none" />
        <div className="relative grid gap-px bg-white/10 md:grid-cols-4">
          <HeroStat
            icon={ListChecks}
            label="Total Tugas"
            value={stats.total}
            sublabel={isLeader ? "Seluruh institusi" : "Lingkup Anda"}
          />
          <HeroStat
            icon={Activity}
            label="Sedang Berjalan"
            value={stats.inProgress}
            sublabel={`${stats.pending} menunggu`}
            accent
          />
          <HeroStat
            icon={CheckCircle2}
            label="Tingkat Penyelesaian"
            value={`${completionRate}%`}
            sublabel={`${stats.completed} dari ${stats.total}`}
          />
          <HeroStat
            icon={AlertTriangle}
            label="Perlu Perhatian"
            value={stats.overdue + stats.highPriority}
            sublabel={`${stats.overdue} terlambat · ${stats.highPriority} prioritas tinggi`}
            danger={stats.overdue + stats.highPriority > 0}
          />
        </div>
      </div>

      {/* Secondary metric chips */}
      {isLeader && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricChip icon={Users} label="Pengguna" value={counts.users} />
          <MetricChip icon={Layers} label="Pokja Riset" value={counts.pokja} />
          <MetricChip icon={FileText} label="Dokumen" value={counts.documents} />
          <MetricChip icon={Target} label="Laporan" value={counts.reports} />
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Trend area chart - spans 2 */}
        <ChartCard
          className="lg:col-span-2"
          title="Tren 14 Hari"
          subtitle="Penugasan dibuat vs diselesaikan"
          icon={TrendingUp}
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.teal} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={CHART_COLORS.teal} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.35} />
                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.012 230)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.5 0.025 240)" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.5 0.025 240)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "white",
                    border: "1px solid oklch(0.9 0.012 230)",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="Dibuat" stroke={CHART_COLORS.teal} strokeWidth={2} fill="url(#gCreated)" />
                <Area type="monotone" dataKey="Selesai" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#gDone)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Status donut */}
        <ChartCard title="Komposisi Status" subtitle="Distribusi penugasan" icon={Activity}>
          {statusBreakdown.length === 0 ? (
            <EmptyChart label="Belum ada data" />
          ) : (
            <>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="value"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid oklch(0.9 0.012 230)",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 mt-2">
                {statusBreakdown.map((s) => (
                  <li key={s.name} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                      <span className="text-muted-foreground">{s.name}</span>
                    </span>
                    <span className="font-semibold text-foreground">{s.value}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </ChartCard>
      </div>

      {/* Pokja load + upcoming */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Beban Kerja per Pokja"
          subtitle="Penugasan aktif vs selesai"
          icon={Layers}
        >
          {pokjaLoad.length === 0 ? (
            <EmptyChart label="Belum ada pokja dengan penugasan" />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pokjaLoad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.012 230)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "oklch(0.5 0.025 240)" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.5 0.025 240)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "oklch(0.96 0.008 230)" }}
                    contentStyle={{
                      background: "white",
                      border: "1px solid oklch(0.9 0.012 230)",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="Aktif" stackId="a" fill={CHART_COLORS.teal} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Selesai" stackId="a" fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>

        <ChartCard title="Tenggat 7 Hari" subtitle="Penugasan mendekati deadline" icon={Clock}>
          {upcoming.length === 0 ? (
            <EmptyChart label="Tidak ada tenggat dekat" />
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((t) => {
                const d = new Date(t.deadline!);
                const days = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                const urgent = days <= 2;
                return (
                  <li key={t.id}>
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: t.id }}
                      className="block rounded-md border border-border p-2.5 hover:border-accent hover:bg-secondary/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-medium truncate flex-1">{t.title}</p>
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 shrink-0",
                            urgent
                              ? "bg-destructive/15 text-destructive"
                              : "bg-accent/20 text-primary",
                          )}
                        >
                          H-{days}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {format(d, "EEEE, dd MMM yyyy", { locale: localeId })}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Latest tasks */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display font-bold text-primary">Penugasan Terbaru</h2>
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5">
              Aktivitas paling baru
            </p>
          </div>
          <Link to="/tasks" className="text-xs font-semibold text-[oklch(0.55_0.08_215)] hover:underline">
            Lihat semua →
          </Link>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">Memuat…</div>
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
            {visible.slice(0, 6).map((t) => (
              <li key={t.id}>
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: t.id }}
                  className="flex items-start justify-between gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors"
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
                        : t.deadline && isAfter(new Date(), new Date(t.deadline))
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

function HeroStat({
  icon: Icon,
  label,
  value,
  sublabel,
  accent,
  danger,
}: {
  icon: typeof ListChecks;
  label: string;
  value: number | string;
  sublabel?: string;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="relative bg-[oklch(0.21_0.06_255)] p-5 md:p-6">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
          {label}
        </span>
        <div
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md",
            danger
              ? "bg-destructive/20 text-destructive"
              : accent
              ? "bg-accent/20 text-accent"
              : "bg-white/10 text-accent",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 font-display text-3xl lg:text-4xl font-bold text-white tabular-nums">
        {value}
      </div>
      {sublabel && (
        <div className="text-[11px] text-white/55 mt-1">{sublabel}</div>
      )}
    </div>
  );
}

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-accent transition-colors">
      <div className="grid h-9 w-9 place-items-center rounded-md bg-primary-soft text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="font-display text-lg font-bold text-primary tabular-nums leading-none">
          {value}
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mt-1 font-medium">
          {label}
        </div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon: typeof TrendingUp;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-display font-bold text-primary">{title}</h3>
          {subtitle && (
            <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 text-[oklch(0.45_0.08_215)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-48 grid place-items-center text-xs text-muted-foreground">{label}</div>
  );
}
