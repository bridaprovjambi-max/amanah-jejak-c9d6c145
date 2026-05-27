import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge, type TaskStatus, PriorityBadge } from "@/components/StatusBadge";
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
        supabase.from("tasks").select("*").is("parent_task_id", null).order("created_at", { ascending: false }),
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

  const filtered = rows.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (q && !r.title.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Penugasan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Daftar semua wewenang & tanggung jawab yang didelegasikan.
          </p>
        </div>
        <Link to="/tasks/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Buat Penugasan
          </Button>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari judul tugas…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-48">
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
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm text-muted-foreground">Tidak ada penugasan ditemukan.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const overdue =
              t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date();
            return (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="block rounded-xl border border-border bg-card p-4 lg:p-5 hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{t.title}</h3>
                      <PriorityBadge priority={t.priority} />
                    </div>
                    {t.description && (
                      <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                        {t.description}
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        Pemberi:{" "}
                        <span className="text-foreground font-medium">
                          {users[t.assigned_by] ?? "—"}
                        </span>
                      </span>
                      <span>
                        Penerima:{" "}
                        <span className="text-foreground font-medium">
                          {t.assigned_to
                            ? users[t.assigned_to] ?? "—"
                            : t.assigned_to_pokja
                            ? `Pokja ${pokja[t.assigned_to_pokja] ?? "—"}`
                            : "—"}
                        </span>
                      </span>
                      {t.deadline && (
                        <span>
                          Tenggat:{" "}
                          <span className="text-foreground font-medium">
                            {new Date(t.deadline).toLocaleDateString("id-ID", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
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
