import { useEffect, useState } from "react";
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
import { useServerFn } from "@tanstack/react-start";
import { Activity, BarChart3, Layers, TrendingUp, CheckCircle2, ListChecks } from "lucide-react";
import { getPublicStats, type PublicStats } from "@/lib/public-stats.functions";

const C = {
  teal: "oklch(0.55 0.08 215)",
  aqua: "oklch(0.75 0.07 195)",
  mid: "oklch(0.36 0.08 245)",
  success: "oklch(0.62 0.14 160)",
  destructive: "oklch(0.58 0.21 25)",
};

const STATUS_COLORS: Record<string, string> = {
  Menunggu: C.mid,
  Berjalan: C.aqua,
  Selesai: C.success,
  Terlambat: C.destructive,
};

export function PublicStatsSection() {
  const fetchStats = useServerFn(getPublicStats);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchStats()
      .then((d) => {
        if (active) setStats(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fetchStats]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
      </section>
    );
  }
  if (!stats || stats.total === 0) return null;

  return (
    <section className="border-y border-border bg-secondary/30">
      <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="mb-10 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.08_215)]">
            Aktivitas Institusi
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-primary lg:text-4xl">
            Capaian penugasan secara langsung.
          </h2>
          <p className="mt-3 text-sm text-muted-foreground lg:text-base">
            Ringkasan agregat data penugasan, kelompok kerja, dan dokumen yang dikelola melalui DeLapan.
          </p>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi icon={ListChecks} label="Total Penugasan" value={stats.total} />
          <Kpi icon={Activity} label="Sedang Berjalan" value={stats.inProgress} accent />
          <Kpi
            icon={CheckCircle2}
            label="Tingkat Penyelesaian"
            value={`${stats.completionRate}%`}
          />
          <Kpi icon={Layers} label="Kelompok Kerja" value={stats.pokjaCount} />
        </div>

        {/* Charts grid */}
        <div className="mt-6 grid gap-5 lg:grid-cols-3">
          <ChartCard
            className="lg:col-span-2"
            title="Tren 14 Hari"
            subtitle="Penugasan dibuat vs diselesaikan"
            icon={TrendingUp}
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="pCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.teal} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={C.teal} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pDone" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.success} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={C.success} stopOpacity={0} />
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
                  <Area type="monotone" dataKey="Dibuat" stroke={C.teal} strokeWidth={2} fill="url(#pCreated)" />
                  <Area type="monotone" dataKey="Selesai" stroke={C.success} strokeWidth={2} fill="url(#pDone)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>

          <ChartCard title="Komposisi Status" subtitle="Distribusi penugasan" icon={Activity}>
            {stats.statusBreakdown.length === 0 ? (
              <Empty />
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.statusBreakdown}
                        dataKey="value"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {stats.statusBreakdown.map((entry, i) => (
                          <Cell key={i} fill={STATUS_COLORS[entry.name] ?? C.mid} />
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
                <ul className="space-y-1.5 mt-1">
                  {stats.statusBreakdown.map((s) => (
                    <li key={s.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-sm"
                          style={{ background: STATUS_COLORS[s.name] ?? C.mid }}
                        />
                        <span className="text-muted-foreground">{s.name}</span>
                      </span>
                      <span className="font-semibold text-foreground">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </ChartCard>

          {stats.pokjaLoad.length > 0 && (
            <ChartCard
              className="lg:col-span-3"
              title="Beban Kerja per Pokja"
              subtitle="Penugasan aktif vs selesai per kelompok kerja"
              icon={BarChart3}
            >
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.pokjaLoad} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                    <Bar dataKey="Aktif" stackId="a" fill={C.teal} />
                    <Bar dataKey="Selesai" stackId="a" fill={C.success} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>
          )}
        </div>
      </div>
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div
          className={
            accent
              ? "grid h-8 w-8 place-items-center rounded-md bg-accent/20 text-primary"
              : "grid h-8 w-8 place-items-center rounded-md bg-primary text-accent"
          }
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="mt-2 font-display text-2xl font-bold text-primary lg:text-3xl">{value}</div>
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
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="grid h-8 w-8 place-items-center rounded-md bg-primary text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold text-primary">{title}</h3>
          {subtitle && (
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty() {
  return (
    <div className="h-44 grid place-items-center text-xs text-muted-foreground">
      Belum ada data
    </div>
  );
}
