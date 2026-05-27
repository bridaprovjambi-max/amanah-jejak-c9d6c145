import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Calendar, Send, Trash2, Paperclip, X, Download, FileIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramNotification } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge, type TaskStatus } from "@/components/StatusBadge";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  component: TaskDetail,
});

interface Task {
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

interface Report {
  id: string;
  task_id: string;
  reported_by: string;
  content: string;
  progress: number;
  status: TaskStatus | null;
  created_at: string;
}

function TaskDetail() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const notify = useServerFn(sendTelegramNotification);
  const [task, setTask] = useState<Task | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [pokjaMap, setPokjaMap] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState(0);
  const [reportStatus, setReportStatus] = useState<TaskStatus>("in_progress");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: t }, { data: r }, { data: p }, { data: pk }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("reports").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("pokja").select("id, name"),
    ]);
    setTask((t as Task) ?? null);
    setReports((r as Report[]) ?? []);
    const u: Record<string, string> = {};
    (p ?? []).forEach((x: { id: string; full_name: string }) => (u[x.id] = x.full_name));
    setUsers(u);
    const m: Record<string, string> = {};
    (pk ?? []).forEach((x: { id: string; name: string }) => (m[x.id] = x.name));
    setPokjaMap(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [taskId]);

  if (loading) return <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>;
  if (!task)
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Tugas tidak ditemukan.</p>
        <Link to="/tasks">
          <Button variant="outline" className="mt-4">Kembali ke daftar</Button>
        </Link>
      </div>
    );

  const overdue =
    task.status !== "completed" && task.deadline && new Date(task.deadline) < new Date();
  const canDelete = user?.id === task.assigned_by;

  const submitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 3) {
      toast.error("Isi laporan minimal 3 karakter");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("reports").insert({
      task_id: task.id,
      reported_by: user!.id,
      content: content.trim(),
      progress,
      status: reportStatus,
    });
    if (!error) {
      // Sync task status to latest report
      await supabase
        .from("tasks")
        .update({ status: reportStatus })
        .eq("id", task.id);
      await supabase.from("activity_log").insert({
        user_id: user!.id,
        action: "create_report",
        entity_type: "task",
        entity_id: task.id,
        details: { progress, status: reportStatus },
      });
      // Notify task assigner (and assignee if completed by someone else)
      const statusLabel =
        reportStatus === "completed" ? "✅ Selesai" : reportStatus === "in_progress" ? "🔄 Berjalan" : "⏳ Menunggu";
      const recipients = new Set<string>();
      if (task.assigned_by && task.assigned_by !== user!.id) recipients.add(task.assigned_by);
      if (reportStatus === "completed" && task.assigned_to && task.assigned_to !== user!.id)
        recipients.add(task.assigned_to);
      const msg =
        `<b>📝 Laporan Baru</b>\n` +
        `Tugas: <b>${task.title}</b>\n` +
        `Pelapor: ${profile?.full_name ?? "—"}\n` +
        `Status: ${statusLabel} (${progress}%)\n\n` +
        content.trim().slice(0, 1500);
      if (recipients.size > 0) {
        notify({
          data: { userIds: Array.from(recipients), message: msg },
        }).catch((e) => console.error("notify error", e));
      }
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setContent("");
    setProgress(0);
    toast.success("Laporan terkirim");
    load();
  };

  const removeTask = async () => {
    if (!confirm("Hapus penugasan ini? Semua laporan ikut terhapus.")) return;
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Penugasan dihapus");
    navigate({ to: "/tasks" });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link to="/tasks" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali ke daftar
      </Link>

      <div className="rounded-2xl border border-border bg-card p-6 lg:p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={overdue ? "overdue" : task.status} />
              <PriorityBadge priority={task.priority} />
            </div>
            <h1 className="mt-3 font-display text-2xl lg:text-3xl font-bold">{task.title}</h1>
            {task.description && (
              <p className="mt-3 text-sm text-foreground/80 whitespace-pre-wrap">
                {task.description}
              </p>
            )}
          </div>
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={removeTask} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="mt-6 grid sm:grid-cols-3 gap-4 text-sm border-t border-border pt-5">
          <Meta label="Pemberi tugas" value={users[task.assigned_by] ?? "—"} />
          <Meta
            label="Penerima"
            value={
              task.assigned_to
                ? users[task.assigned_to] ?? "—"
                : task.assigned_to_pokja
                ? `Pokja ${pokjaMap[task.assigned_to_pokja] ?? "—"}`
                : "—"
            }
          />
          <Meta
            label="Tenggat"
            value={
              task.deadline
                ? new Date(task.deadline).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "Tanpa tenggat"
            }
            icon={<Calendar className="h-3.5 w-3.5" />}
          />
        </div>
      </div>

      {/* Report form */}
      <form
        onSubmit={submitReport}
        className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4"
      >
        <h2 className="font-display font-semibold">Tambah Laporan Pelaksanaan</h2>
        <div className="space-y-1.5">
          <Label htmlFor="content">Isi laporan</Label>
          <Textarea
            id="content"
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tuliskan progres, kendala, atau hasil pelaksanaan…"
            maxLength={2000}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="progress">Progres (%)</Label>
            <Input
              id="progress"
              type="number"
              min={0}
              max={100}
              value={progress}
              onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={reportStatus} onValueChange={(v) => setReportStatus(v as TaskStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="in_progress">Berjalan</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            <Send className="mr-2 h-4 w-4" /> {busy ? "Mengirim…" : "Kirim Laporan"}
          </Button>
        </div>
      </form>

      <div>
        <h2 className="font-display font-semibold mb-3">Riwayat Pelaporan</h2>
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada laporan. Jadilah yang pertama.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary text-xs font-semibold">
                      {(users[r.reported_by] ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{users[r.reported_by] ?? "Pengguna"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.status && <StatusBadge status={r.status} />}
                    <span className="text-xs font-semibold text-primary">{r.progress}%</span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap">{r.content}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${r.progress}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}
