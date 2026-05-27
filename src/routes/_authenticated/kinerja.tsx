import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Trophy, Medal, Target, Clock, TrendingUp, X, ArrowUpRight, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { JENJANG_LABEL } from "@/lib/auth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/kinerja")({
  component: KinerjaPage,
});

type Jenjang = "eselon_ii" | "eselon_iii" | "eselon_iv" | "pokja" | "staf" | "jafung";

interface TaskRow {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  deadline: string | null;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  created_at: string;
  updated_at: string;
}


interface ProfileRow {
  id: string;
  full_name: string;
  jabatan: string | null;
  jenjang: Jenjang;
  pokja_id: string | null;
}

interface PokjaRow {
  id: string;
  name: string;
}

interface UserScore {
  id: string;
  name: string;
  jabatan: string | null;
  jenjang: Jenjang;
  pokja_id: string | null;
  total: number;
  completed: number;
  overdue: number;
  in_progress: number;
  pending: number;
  rate: number;
  score: number;
  avgDays: number | null;
}

interface PokjaScore {
  id: string;
  name: string;
  total: number;
  completed: number;
  overdue: number;
  rate: number;
  score: number;
}

function KinerjaPage() {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [pokja, setPokja] = useState<PokjaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: p }, { data: pk }] = await Promise.all([
        supabase
          .from("tasks")
          .select("id,title,status,deadline,assigned_to,assigned_to_pokja,created_at,updated_at"),
        supabase.from("profiles").select("id,full_name,jabatan,jenjang,pokja_id"),
        supabase.from("pokja").select("id,name"),
      ]);
      setTasks((t as TaskRow[]) ?? []);
      setProfiles((p as ProfileRow[]) ?? []);
      setPokja((pk as PokjaRow[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const { userScores, pokjaScores } = useMemo(() => {
    const now = Date.now();
    const userMap = new Map<string, UserScore>();
    const pokjaMap = new Map<string, PokjaScore>();

    profiles.forEach((pr) => {
      userMap.set(pr.id, {
        id: pr.id,
        name: pr.full_name,
        jabatan: pr.jabatan,
        jenjang: pr.jenjang,
        pokja_id: pr.pokja_id,
        total: 0,
        completed: 0,
        overdue: 0,
        in_progress: 0,
        pending: 0,
        rate: 0,
        score: 0,
        avgDays: null,
      });
    });
    pokja.forEach((pk) => {
      pokjaMap.set(pk.id, {
        id: pk.id,
        name: pk.name,
        total: 0,
        completed: 0,
        overdue: 0,
        rate: 0,
        score: 0,
      });
    });

    const userDurations = new Map<string, number[]>();

    tasks.forEach((t) => {
      const isOverdue =
        t.status !== "completed" && t.deadline && new Date(t.deadline).getTime() < now;

      if (t.assigned_to) {
        const u = userMap.get(t.assigned_to);
        if (u) {
          u.total++;
          if (t.status === "completed") {
            u.completed++;
            const days =
              (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) /
              (1000 * 60 * 60 * 24);
            if (!userDurations.has(u.id)) userDurations.set(u.id, []);
            userDurations.get(u.id)!.push(days);
          } else if (t.status === "in_progress") u.in_progress++;
          else u.pending++;
          if (isOverdue) u.overdue++;
        }
      }
      if (t.assigned_to_pokja) {
        const pk = pokjaMap.get(t.assigned_to_pokja);
        if (pk) {
          pk.total++;
          if (t.status === "completed") pk.completed++;
          if (isOverdue) pk.overdue++;
        }
      }
    });

    const userScores: UserScore[] = Array.from(userMap.values())
      .map((u) => {
        const ds = userDurations.get(u.id);
        u.avgDays = ds && ds.length > 0 ? ds.reduce((a, b) => a + b, 0) / ds.length : null;
        u.rate = u.total > 0 ? (u.completed / u.total) * 100 : 0;
        // Score: completion rate minus 10 per overdue, cap 0-100
        u.score = Math.max(0, Math.min(100, u.rate - u.overdue * 10));
        return u;
      })
      .filter((u) => u.total > 0)
      .sort((a, b) => b.score - a.score || b.completed - a.completed);

    const pokjaScores: PokjaScore[] = Array.from(pokjaMap.values())
      .map((pk) => {
        pk.rate = pk.total > 0 ? (pk.completed / pk.total) * 100 : 0;
        pk.score = Math.max(0, Math.min(100, pk.rate - pk.overdue * 10));
        return pk;
      })
      .filter((pk) => pk.total > 0)
      .sort((a, b) => b.score - a.score || b.completed - a.completed);

    return { userScores, pokjaScores };
  }, [tasks, profiles, pokja]);

  const totalTasks = tasks.length;
  const totalCompleted = tasks.filter((t) => t.status === "completed").length;
  const totalOverdue = tasks.filter(
    (t) => t.status !== "completed" && t.deadline && new Date(t.deadline).getTime() < Date.now(),
  ).length;
  const orgRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

  if (loading) {
    return <p className="text-sm text-muted-foreground py-12 text-center">Memuat data kinerja…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Kinerja & Penilaian</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tingkat penyelesaian tugas per pengguna dan kelompok kerja.
        </p>
      </div>

      {/* Org-level summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          icon={<Target className="h-4 w-4" />}
          label="Total Tugas"
          value={totalTasks.toString()}
        />
        <SummaryCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Selesai"
          value={`${totalCompleted}`}
          sub={`${orgRate.toFixed(1)}%`}
        />
        <SummaryCard
          icon={<Clock className="h-4 w-4" />}
          label="Terlambat"
          value={totalOverdue.toString()}
          tone="danger"
        />
        <SummaryCard
          icon={<Trophy className="h-4 w-4" />}
          label="Kinerja Org."
          value={`${orgRate.toFixed(0)}%`}
          tone="primary"
        />
      </div>

      {/* User leaderboard */}
      <section className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-[var(--brand-gold)]" />
            Leaderboard Pengguna
          </h2>
          <span className="text-xs text-muted-foreground">
            {userScores.length} pengguna aktif
          </span>
        </div>
        {userScores.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Belum ada tugas yang ditugaskan kepada pengguna individu.
          </p>
        ) : (
          <ol className="space-y-2">
            {userScores.slice(0, 20).map((u, i) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3"
              >
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium truncate">{u.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {JENJANG_LABEL[u.jenjang]}
                    </span>
                  </div>
                  {u.jabatan && (
                    <div className="text-[11px] text-muted-foreground truncate">{u.jabatan}</div>
                  )}
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${u.rate}%` }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      <b className="text-foreground">{u.completed}</b>/{u.total} selesai
                    </span>
                    <span>{u.rate.toFixed(0)}%</span>
                    {u.overdue > 0 && (
                      <span className="text-destructive">{u.overdue} terlambat</span>
                    )}
                    {u.avgDays !== null && (
                      <span>Rata-rata {u.avgDays.toFixed(1)} hari</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold font-display">{u.score.toFixed(0)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    skor
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Pokja leaderboard */}
      <section className="rounded-2xl border border-border bg-card p-5 lg:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Medal className="h-5 w-5 text-[var(--brand-gold)]" />
            Leaderboard Kelompok Kerja
          </h2>
          <span className="text-xs text-muted-foreground">{pokjaScores.length} pokja aktif</span>
        </div>
        {pokjaScores.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Belum ada tugas yang ditugaskan ke pokja.
          </p>
        ) : (
          <ol className="space-y-2">
            {pokjaScores.map((pk, i) => (
              <li
                key={pk.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/50 p-3"
              >
                <RankBadge rank={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{pk.name}</div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${pk.rate}%` }}
                    />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      <b className="text-foreground">{pk.completed}</b>/{pk.total} selesai
                    </span>
                    <span>{pk.rate.toFixed(0)}%</span>
                    {pk.overdue > 0 && (
                      <span className="text-destructive">{pk.overdue} terlambat</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-lg font-bold font-display">{pk.score.toFixed(0)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    skor
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground text-center">
        Skor dihitung dari tingkat penyelesaian dikurangi 10 poin per tugas terlambat (skala 0–100).
      </p>
    </div>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  sub,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "primary" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "text-primary"
      : tone === "danger"
      ? "text-destructive"
      : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={`mt-1.5 font-display text-2xl font-bold ${toneClass}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? "bg-gradient-to-br from-yellow-400 to-amber-600 text-white"
      : rank === 2
      ? "bg-gradient-to-br from-gray-300 to-gray-500 text-white"
      : rank === 3
      ? "bg-gradient-to-br from-amber-600 to-amber-800 text-white"
      : "bg-muted text-muted-foreground";
  return (
    <div
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-bold font-display text-sm ${styles}`}
    >
      {rank}
    </div>
  );
}
