import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Calendar, ArrowRight, Inbox, AlertCircle, CheckCircle2, Clock, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type TaskStatus, PriorityBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/tasks/")({
  component: TasksList,
});

interface Row {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: string;
  deadline: string | null;
  assigned_by: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  created_at: string;
}

function TasksList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [pokja, setPokja] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: p }, { data: pk }] = await Promise.all([
        supabase.from("tasks").select("*").is("parent_task_id", null).order("created_at", { ascending: false }).limit(500),

        supabase.from("profiles").select("id, full_name"),
        supabase.from("pokja").select("id, name"),
      ]);
      setRows((t as Row[]) ?? []);
      const u: Record<string, string> = {};
      (p ?? []).forEach((x: { id: string; full_name: string }) => (u[x.id] = x.full_name));
      setUsers(u);
      const m: Record<string, string> = {};
      (pk ?? []).forEach((x: { id: string; name: string }) => (m[x.id] = x.name));
      setPokja(m);
      setLoading(false);
    })();
  }, []);

  const stats = useMemo(() => {
    const now = new Date();
    let pending = 0, inprog = 0, done = 0, over = 0;
    for (const r of rows) {
      const isOver = r.status !== "completed" && r.deadline && new Date(r.deadline) < now;
      if (isOver) over++;
      else if (r.status === "pending") pending++;
      else if (r.status === "in_progress") inprog++;
      else if (r.status === "completed") done++;
    }
    return { total: rows.length, pending, inprog, done, over };
  }, [rows]);

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((s) => s[0]).join("").toUpperCase();

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Delegasi & Pelaksanaan"
        title="Penugasan"
        description="Daftar wewenang & tanggung jawab yang didelegasikan secara berjenjang."
        actions={
          <Link to="/tasks/new">
            <Button className="shadow-elegant font-semibold">
              <Plus className="mr-1 h-4 w-4" /> Buat Penugasan
            </Button>
          </Link>
        }
      />

      {/* Stat strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Inbox, label: "Total", value: stats.total, tone: "text-primary", bg: "bg-primary/5" },
          { icon: Activity, label: "Berjalan", value: stats.inprog, tone: "text-[oklch(0.55_0.08_215)]", bg: "bg-[oklch(0.55_0.08_215)]/5" },
          { icon: CheckCircle2, label: "Selesai", value: stats.done, tone: "text-success", bg: "bg-success/5" },
          { icon: AlertCircle, label: "Terlambat", value: stats.over, tone: "text-destructive", bg: "bg-destructive/5" },
        ].map((s) => (
          <div key={s.label} className={`relative overflow-hidden rounded-xl border border-border ${s.bg} p-4`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{s.label}</div>
                <div className={`mt-1 font-display text-3xl font-bold ${s.tone}`}>{s.value}</div>
              </div>
              <div className={`grid h-9 w-9 place-items-center rounded-md bg-card border border-border ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-border bg-card p-3 shadow-card-elegant">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul penugasan…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-10 border-transparent bg-muted/40 focus-visible:bg-card"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-52 h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="in_progress">Berjalan</SelectItem>
            <SelectItem value="completed">Selesai</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-xl border border-border bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-20 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-4 font-display text-lg text-primary">Belum ada penugasan</p>
          <p className="mt-1 text-sm text-muted-foreground">Coba ubah filter atau buat penugasan baru.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const overdue =
              t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date();
            const giverName = users[t.assigned_by] ?? "—";
            const receiverName = t.assigned_to
              ? users[t.assigned_to] ?? "—"
              : t.assigned_to_pokja
              ? `Pokja ${pokja[t.assigned_to_pokja] ?? "—"}`
              : "—";
            return (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="group relative block overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30 hover:shadow-elegant hover:-translate-y-0.5"
              >
                {/* gold accent stripe on hover */}
                <span className="absolute inset-y-0 left-0 w-0.5 bg-accent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-bold text-primary leading-tight">{t.title}</h3>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    {t.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                          {initials(giverName)}
                        </div>
                        <span className="text-muted-foreground">
                          <span className="text-foreground font-medium">{giverName}</span>
                        </span>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <div className="flex items-center gap-2">
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-[10px] font-bold text-accent-foreground">
                          {initials(receiverName)}
                        </div>
                        <span className="text-muted-foreground">
                          <span className="text-foreground font-medium">{receiverName}</span>
                        </span>
                      </div>
                      {t.deadline && (
                        <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 font-medium ${overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                          {overdue ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
                          {new Date(t.deadline).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={overdue ? "overdue" : t.status} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
