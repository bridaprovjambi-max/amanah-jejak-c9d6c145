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
import { TaskComments } from "@/components/TaskComments";

import { SubTasks } from "@/components/SubTasks";

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
  parent_task_id: string | null;
  created_at: string;
}

interface ParentLite {
  id: string;
  title: string;
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

interface Attachment {
  id: string;
  report_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

interface TaskAttachment {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB per file
const MAX_FILES = 5;

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function TaskDetail() {
  const { taskId } = Route.useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const notify = useServerFn(sendTelegramNotification);
  const [task, setTask] = useState<Task | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [parent, setParent] = useState<ParentLite | null>(null);
  const [users, setUsers] = useState<Record<string, { name: string; nip: string | null; pangkat: string | null }>>({});
  const [pokjaMap, setPokjaMap] = useState<Record<string, string>>({});
  const [content, setContent] = useState("");
  const [progress, setProgress] = useState(0);
  const [reportStatus, setReportStatus] = useState<TaskStatus>("in_progress");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [{ data: t }, { data: r }, { data: p }, { data: pk }] = await Promise.all([
      supabase.from("tasks").select("*").eq("id", taskId).maybeSingle(),
      supabase.from("reports").select("*").eq("task_id", taskId).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, nip, pangkat_golongan"),
      supabase.from("pokja").select("id, name"),
    ]);
    const taskRow = (t as Task) ?? null;
    setTask(taskRow);
    if (taskRow?.parent_task_id) {
      const { data: par } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("id", taskRow.parent_task_id)
        .maybeSingle();
      setParent((par as ParentLite) ?? null);
    } else {
      setParent(null);
    }
    const reportRows = (r as Report[]) ?? [];
    setReports(reportRows);
    const u: Record<string, { name: string; nip: string | null; pangkat: string | null }> = {};
    (p ?? []).forEach((x: { id: string; full_name: string; nip: string | null; pangkat_golongan: string | null }) => {
      u[x.id] = { name: x.full_name, nip: x.nip, pangkat: x.pangkat_golongan };
    });
    setUsers(u);
    const m: Record<string, string> = {};
    (pk ?? []).forEach((x: { id: string; name: string }) => (m[x.id] = x.name));
    setPokjaMap(m);
    if (reportRows.length > 0) {
      const { data: att } = await supabase
        .from("report_attachments")
        .select("*")
        .in("report_id", reportRows.map((x) => x.id))
        .order("created_at", { ascending: true });
      setAttachments((att as Attachment[]) ?? []);
    } else {
      setAttachments([]);
    }
    const { data: tAtt } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: true });
    setTaskAttachments((tAtt as TaskAttachment[]) ?? []);
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

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = [...pendingFiles];
    for (const f of Array.from(files)) {
      if (next.length >= MAX_FILES) {
        toast.error(`Maksimal ${MAX_FILES} berkas per laporan`);
        break;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name} melebihi 20MB`);
        continue;
      }
      next.push(f);
    }
    setPendingFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (idx: number) =>
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const downloadAttachment = async (att: { file_path: string }) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 60);
    if (error || !data) {
      toast.error(error?.message ?? "Gagal membuat tautan unduh");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const deleteAttachment = async (att: Attachment) => {
    if (!confirm(`Hapus lampiran "${att.file_name}"?`)) return;
    const { error: dbErr } = await supabase.from("report_attachments").delete().eq("id", att.id);
    if (dbErr) return toast.error(dbErr.message);
    await supabase.storage.from("documents").remove([att.file_path]);
    setAttachments((prev) => prev.filter((x) => x.id !== att.id));
    toast.success("Lampiran dihapus");
  };

  const deleteTaskAttachment = async (att: TaskAttachment) => {
    if (!confirm(`Hapus lampiran "${att.file_name}"?`)) return;
    const { error: dbErr } = await supabase.from("task_attachments").delete().eq("id", att.id);
    if (dbErr) return toast.error(dbErr.message);
    await supabase.storage.from("documents").remove([att.file_path]);
    setTaskAttachments((prev) => prev.filter((x) => x.id !== att.id));
    toast.success("Lampiran dihapus");
  };

  const uploadAttachments = async (reportId: string) => {
    const rows: Omit<Attachment, "id" | "created_at">[] = [];
    for (const f of pendingFiles) {
      const safeName = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${user!.id}/reports/${reportId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) {
        toast.error(`Gagal mengunggah ${f.name}: ${upErr.message}`);
        continue;
      }
      rows.push({
        report_id: reportId,
        uploaded_by: user!.id,
        file_path: path,
        file_name: f.name,
        file_size: f.size,
        mime_type: f.type || null,
      });
    }
    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("report_attachments").insert(rows);
      if (insErr) toast.error(`Gagal menyimpan metadata lampiran: ${insErr.message}`);
    }
  };

  const submitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (content.trim().length < 3) {
      toast.error("Isi laporan minimal 3 karakter");
      return;
    }
    setBusy(true);
    const { data: newReport, error } = await supabase
      .from("reports")
      .insert({
        task_id: task.id,
        reported_by: user!.id,
        content: content.trim(),
        progress,
        status: reportStatus,
      })
      .select("id")
      .single();
    if (!error && newReport) {
      if (pendingFiles.length > 0) {
        await uploadAttachments(newReport.id);
      }
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
        details: { progress, status: reportStatus, attachments: pendingFiles.length },
      });
      // Notify task assigner (and assignee if completed by someone else)
      const statusLabel =
        reportStatus === "completed" ? "✅ Selesai" : reportStatus === "in_progress" ? "🔄 Berjalan" : "⏳ Menunggu";
      const recipients = new Set<string>();
      if (task.assigned_by && task.assigned_by !== user!.id) recipients.add(task.assigned_by);
      if (reportStatus === "completed" && task.assigned_to && task.assigned_to !== user!.id)
        recipients.add(task.assigned_to);
      const attachNote = pendingFiles.length > 0 ? `\n📎 ${pendingFiles.length} lampiran` : "";
      const msg =
        `<b>📝 Laporan Baru</b>\n` +
        `Tugas: <b>${task.title}</b>\n` +
        `Pelapor: ${profile?.full_name ?? "—"}\n` +
        `Status: ${statusLabel} (${progress}%)${attachNote}\n\n` +
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
    setPendingFiles([]);
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
          <UserMeta
            label="Pemberi tugas"
            user={users[task.assigned_by]}
          />
          <UserMeta
            label="Penerima"
            user={
              task.assigned_to
                ? users[task.assigned_to]
                : task.assigned_to_pokja
                ? { name: `Pokja ${pokjaMap[task.assigned_to_pokja] ?? "—"}`, nip: null, pangkat: null }
                : undefined
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

        {taskAttachments.length > 0 && (
          <div className="mt-5 border-t border-border pt-5">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Lampiran tugas
            </div>
            <ul className="space-y-1.5">
              {taskAttachments.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => downloadAttachment(a)}
                    className="flex items-center gap-2 min-w-0 text-left hover:text-primary"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{a.file_name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatBytes(a.file_size)}
                    </span>
                  </button>
                  {(user?.id === a.uploaded_by || user?.id === task.assigned_by) && (
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTaskAttachment(a)}
                      aria-label="Hapus lampiran"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
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

        <div className="space-y-2">
          <Label>Lampiran berkas (opsional, maks {MAX_FILES} berkas, 20MB/berkas)</Label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={pendingFiles.length >= MAX_FILES}
            >
              <Paperclip className="mr-2 h-4 w-4" /> Pilih berkas
            </Button>
            <span className="text-xs text-muted-foreground">
              {pendingFiles.length} dipilih
            </span>
          </div>
          {pendingFiles.length > 0 && (
            <ul className="space-y-1.5">
              {pendingFiles.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{f.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatBytes(f.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removePendingFile(i)}
                    aria-label="Hapus berkas"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            <Send className="mr-2 h-4 w-4" /> {busy ? "Mengirim…" : "Kirim Laporan"}
          </Button>
        </div>
      </form>

      <TaskComments
        taskId={task.id}
        taskTitle={task.title}
        profiles={Object.entries(users).map(([id, u]) => ({ id, full_name: u.name }))}
      />



      <div>
        <h2 className="font-display font-semibold mb-3">Riwayat Pelaporan</h2>
        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada laporan. Jadilah yang pertama.</p>
          </div>
        ) : (
          <ol className="space-y-3">
            {reports.map((r) => {
              const reporter = users[r.reported_by];
              return (
              <li key={r.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary-soft text-primary text-xs font-semibold">
                      {(reporter?.name ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{reporter?.name ?? "Pengguna"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {reporter?.nip && <span className="mr-2">NIP: {reporter.nip}</span>}
                        {reporter?.pangkat && <span>{reporter.pangkat}</span>}
                      </div>
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
                {attachments.filter((a) => a.report_id === r.id).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {attachments
                      .filter((a) => a.report_id === r.id)
                      .map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs"
                        >
                          <button
                            type="button"
                            onClick={() => downloadAttachment(a)}
                            className="flex items-center gap-2 min-w-0 text-left hover:text-primary"
                          >
                            <Download className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{a.file_name}</span>
                            <span className="text-muted-foreground shrink-0">
                              {formatBytes(a.file_size)}
                            </span>
                          </button>
                          {user?.id === a.uploaded_by && (
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => deleteAttachment(a)}
                              aria-label="Hapus lampiran"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
              );
            })}
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

function UserMeta({
  label,
  user,
}: {
  label: string;
  user?: { name: string; nip: string | null; pangkat: string | null };
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{user?.name ?? "—"}</div>
      {user?.nip && <div className="text-[11px] text-muted-foreground">NIP: {user.nip}</div>}
      {user?.pangkat && <div className="text-[11px] text-muted-foreground">{user.pangkat}</div>}
    </div>
  );
}
