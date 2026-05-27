import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, ChevronRight, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type TaskStatus } from "@/components/StatusBadge";

interface ProfileLite {
  id: string;
  full_name: string;
}

interface SubTask {
  id: string;
  title: string;
  status: TaskStatus;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  deadline: string | null;
  created_at: string;
}

interface Props {
  parentTaskId: string;
  parentAssignedBy: string;
  profiles: ProfileLite[];
}

export function SubTasks({ parentTaskId, parentAssignedBy, profiles }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<SubTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);

  const profileMap = profiles.reduce<Record<string, string>>((acc, p) => {
    acc[p.id] = p.full_name;
    return acc;
  }, {});

  const load = async () => {
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, assigned_to, assigned_to_pokja, deadline, created_at")
      .eq("parent_task_id", parentTaskId)
      .order("created_at", { ascending: true });
    setItems((data as SubTask[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`subtasks_${parentTaskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks", filter: `parent_task_id=eq.${parentTaskId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentTaskId]);

  const canManage = user?.id === parentAssignedBy;

  const total = items.length;
  const completed = items.filter((x) => x.status === "completed").length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3) {
      toast.error("Judul sub-tugas minimal 3 karakter");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("tasks").insert({
      title: title.trim(),
      parent_task_id: parentTaskId,
      assigned_by: user!.id,
      assigned_to: assignedTo || null,
      priority: "normal",
      status: "pending",
      deadline: deadline ? new Date(deadline).toISOString() : null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setTitle("");
    setAssignedTo("");
    setDeadline("");
    setShowForm(false);
    toast.success("Sub-tugas ditambahkan");
    load();
  };

  const remove = async (s: SubTask) => {
    if (!confirm(`Hapus sub-tugas "${s.title}"?`)) return;
    const { error } = await supabase.from("tasks").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.filter((x) => x.id !== s.id));
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display font-semibold">Sub-Tugas</h2>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "Belum ada sub-tugas" : `${completed} dari ${total} selesai`}
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1.5 h-4 w-4" /> {showForm ? "Tutup" : "Tambah"}
          </Button>
        )}
      </div>

      {total > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Progres keseluruhan</span>
            <span className="font-semibold text-primary">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {showForm && canManage && (
        <form
          onSubmit={submit}
          className="rounded-xl border border-dashed border-border bg-muted/30 p-4 space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="st-title">Judul sub-tugas</Label>
            <Input
              id="st-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="contoh: Susun TOR kegiatan"
              maxLength={200}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Penerima</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pengguna" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-deadline">Tenggat (opsional)</Label>
              <Input
                id="st-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-2">Memuat…</p>
      ) : items.length === 0 ? (
        !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">
            {canManage
              ? "Pecah tugas ini menjadi langkah-langkah konkret dengan penerima berbeda."
              : "Belum ada sub-tugas."}
          </p>
        )
      ) : (
        <ul className="space-y-2">
          {items.map((s) => {
            const overdue =
              s.status !== "completed" && s.deadline && new Date(s.deadline) < new Date();
            return (
              <li
                key={s.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5"
              >
                <Link
                  to="/tasks/$taskId"
                  params={{ taskId: s.id }}
                  className="flex-1 min-w-0 flex items-center gap-3 hover:text-primary"
                >
                  <StatusBadge status={overdue ? "overdue" : s.status} />
                  <span className="truncate text-sm">{s.title}</span>
                  {s.assigned_to && (
                    <span className="hidden sm:inline text-xs text-muted-foreground truncate">
                      · {profileMap[s.assigned_to] ?? "—"}
                    </span>
                  )}
                  {s.deadline && (
                    <span className="hidden md:inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <Calendar className="h-3 w-3" />
                      {new Date(s.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => remove(s)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Hapus sub-tugas"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
