import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramNotification } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/tasks/new")({
  component: NewTask,
});

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(2000).optional(),
  assignee_kind: z.enum(["user", "pokja"]),
  assignee_id: z.string().uuid("Pilih penerima tugas"),
  priority: z.enum(["rendah", "normal", "tinggi"]),
  deadline: z.string().optional(),
});

function NewTask() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const notify = useServerFn(sendTelegramNotification);
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; jabatan: string | null }>>([]);
  const [pokja, setPokja] = useState<Array<{ id: string; name: string }>>([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignee_kind: "user" as "user" | "pokja",
    assignee_id: "",
    priority: "normal" as "rendah" | "normal" | "tinggi",
    deadline: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: pk }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, jabatan").order("full_name"),
        supabase.from("pokja").select("id, name").order("name"),
      ]);
      setUsers(p ?? []);
      setPokja(pk ?? []);
    })();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const payload = {
      title: parsed.data.title,
      description: parsed.data.description || null,
      assigned_by: user!.id,
      assigned_to: parsed.data.assignee_kind === "user" ? parsed.data.assignee_id : null,
      assigned_to_pokja: parsed.data.assignee_kind === "pokja" ? parsed.data.assignee_id : null,
      priority: parsed.data.priority,
      deadline: parsed.data.deadline ? new Date(parsed.data.deadline).toISOString() : null,
    };
    const { data, error } = await supabase.from("tasks").insert(payload).select("id").single();
    if (!error) {
      await supabase.from("activity_log").insert({
        user_id: user!.id,
        action: "create_task",
        entity_type: "task",
        entity_id: data!.id,
        details: { title: payload.title },
      });
      // Fire-and-forget Telegram notification to recipients
      const msg =
        `<b>📋 Penugasan Baru</b>\n` +
        `<b>${payload.title}</b>\n` +
        (payload.description ? `${payload.description}\n` : "") +
        `\nPemberi: ${profile?.full_name ?? "—"}` +
        `\nPrioritas: ${payload.priority}` +
        (payload.deadline
          ? `\nTenggat: ${new Date(payload.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
          : "");
      notify({
        data: {
          userIds: payload.assigned_to ? [payload.assigned_to] : undefined,
          pokjaId: payload.assigned_to_pokja ?? undefined,
          message: msg,
        },
      }).catch((e) => console.error("notify error", e));
    }
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Penugasan dibuat");
    navigate({ to: "/tasks/$taskId", params: { taskId: data!.id } });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/tasks" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Kembali
        </Link>
        <h1 className="mt-3 font-display text-2xl lg:text-3xl font-bold">Buat Penugasan Baru</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Delegasikan wewenang & tanggung jawab ke pejabat atau Kelompok Kerja Riset.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="space-y-1.5">
          <Label htmlFor="title">Judul tugas *</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="contoh: Menyusun naskah akademik..."
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Deskripsi / instruksi</Label>
          <Textarea
            id="desc"
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            maxLength={2000}
            placeholder="Jelaskan lingkup, target, dan keluaran yang diharapkan…"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Jenis penerima</Label>
            <Select
              value={form.assignee_kind}
              onValueChange={(v) =>
                setForm({ ...form, assignee_kind: v as "user" | "pokja", assignee_id: "" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Individu</SelectItem>
                <SelectItem value="pokja">Kelompok Kerja</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Penerima *</Label>
            <Select
              value={form.assignee_id}
              onValueChange={(v) => setForm({ ...form, assignee_id: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih…" />
              </SelectTrigger>
              <SelectContent>
                {form.assignee_kind === "user"
                  ? users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                        {u.jabatan ? ` — ${u.jabatan}` : ""}
                      </SelectItem>
                    ))
                  : pokja.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                {form.assignee_kind === "pokja" && pokja.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Belum ada pokja. Buat di menu Kelompok Kerja.
                  </div>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Prioritas</Label>
            <Select
              value={form.priority}
              onValueChange={(v) => setForm({ ...form, priority: v as "rendah" | "normal" | "tinggi" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rendah">Rendah</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="tinggi">Tinggi</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deadline">Tenggat</Label>
            <Input
              id="deadline"
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/tasks" })}>
            Batal
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan Penugasan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
