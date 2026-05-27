import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Folder,
  Plus,
  Save,
  Trash2,
  ArrowUp,
  ArrowDown,
  Loader2,
  Lock,
  Pencil,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/folders")({
  component: FolderSettingsPage,
});

interface FolderRow {
  id: string;
  slug: string;
  name: string;
  hint: string | null;
  sort_order: number;
  is_system: boolean;
}

function slugify(input: string) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .slice(0, 60);
}

function FolderSettingsPage() {
  const { hasRole } = useAuth();
  const canManage = hasRole(["admin", "kepala", "sekretaris"]);

  const [rows, setRows] = useState<FolderRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, { name: string; hint: string }>>({});
  const [newName, setNewName] = useState("");
  const [newHint, setNewHint] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const [{ data: f }, { data: d }] = await Promise.all([
      supabase.from("document_folders").select("*").order("sort_order", { ascending: true }),
      supabase.from("documents").select("folder"),
    ]);
    setRows((f as FolderRow[]) ?? []);
    const c: Record<string, number> = {};
    (d ?? []).forEach((r: { folder: string }) => {
      c[r.folder] = (c[r.folder] ?? 0) + 1;
    });
    setCounts(c);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.sort_order - b.sort_order), [rows]);

  const startEdit = (row: FolderRow) => {
    setEditing((e) => ({ ...e, [row.id]: { name: row.name, hint: row.hint ?? "" } }));
  };

  const cancelEdit = (id: string) => {
    setEditing((e) => {
      const n = { ...e };
      delete n[id];
      return n;
    });
  };

  const saveEdit = async (row: FolderRow) => {
    const draft = editing[row.id];
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Nama folder wajib diisi");
      return;
    }
    setSaving(row.id);
    const { error } = await supabase
      .from("document_folders")
      .update({ name: draft.name.trim(), hint: draft.hint.trim() || null })
      .eq("id", row.id);
    setSaving(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Folder diperbarui");
    cancelEdit(row.id);
    load();
  };

  const move = async (row: FolderRow, dir: -1 | 1) => {
    const idx = sorted.findIndex((r) => r.id === row.id);
    const swap = sorted[idx + dir];
    if (!swap) return;
    setSaving(row.id);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("document_folders").update({ sort_order: swap.sort_order }).eq("id", row.id),
      supabase.from("document_folders").update({ sort_order: row.sort_order }).eq("id", swap.id),
    ]);
    setSaving(null);
    if (e1 || e2) {
      toast.error("Gagal mengubah urutan");
      return;
    }
    load();
  };

  const remove = async (row: FolderRow) => {
    if ((counts[row.slug] ?? 0) > 0) {
      toast.error("Folder masih berisi dokumen. Pindahkan/hapus dokumen terlebih dahulu.");
      return;
    }
    if (!confirm(`Hapus folder "${row.name}"?`)) return;
    const { error } = await supabase.from("document_folders").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Folder dihapus");
    load();
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) {
      toast.error("Nama folder wajib diisi");
      return;
    }
    const slug = slugify(name);
    if (!slug) {
      toast.error("Nama folder tidak valid");
      return;
    }
    if (rows.some((r) => r.slug.toLowerCase() === slug.toLowerCase())) {
      toast.error("Folder dengan nama tersebut sudah ada");
      return;
    }
    setCreating(true);
    const nextOrder = (sorted[sorted.length - 1]?.sort_order ?? 0) + 1;
    const { error } = await supabase.from("document_folders").insert({
      slug,
      name,
      hint: newHint.trim() || null,
      sort_order: nextOrder,
      is_system: false,
    });
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Folder dibuat");
    setNewName("");
    setNewHint("");
    load();
  };

  if (!canManage) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <Lock className="mx-auto h-8 w-8 text-muted-foreground/60" />
        <p className="mt-3 text-sm text-muted-foreground">
          Hanya admin, Kepala, atau Sekretaris yang dapat mengelola folder dokumen.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Pengaturan Folder</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola folder dokumen: tambah, ubah nama, atur urutan, dan perbarui keterangan.
        </p>
      </div>

      {/* Create */}
      <form
        onSubmit={create}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Tambah Folder Baru</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-name">Nama Folder *</Label>
            <Input
              id="new-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Contoh: Tim Audit"
              maxLength={60}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-hint">Keterangan</Label>
            <Input
              id="new-hint"
              value={newHint}
              onChange={(e) => setNewHint(e.target.value)}
              placeholder="Penjelasan singkat folder"
              maxLength={200}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan…
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" /> Tambah Folder
              </>
            )}
          </Button>
        </div>
      </form>

      {/* List */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/40">
          <Folder className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Daftar Folder</h2>
          <span className="ml-auto text-xs text-muted-foreground">{sorted.length} folder</span>
        </div>
        {loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Memuat…</p>
        ) : sorted.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Belum ada folder.</p>
        ) : (
          <ul className="divide-y divide-border">
            {sorted.map((row, idx) => {
              const draft = editing[row.id];
              const isEditing = !!draft;
              const docCount = counts[row.slug] ?? 0;
              return (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    {/* Reorder */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => move(row, -1)}
                        disabled={idx === 0 || saving === row.id}
                        title="Naik"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => move(row, 1)}
                        disabled={idx === sorted.length - 1 || saving === row.id}
                        title="Turun"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {isEditing ? (
                        <div className="grid gap-2 lg:grid-cols-2">
                          <Input
                            value={draft.name}
                            onChange={(e) =>
                              setEditing((s) => ({
                                ...s,
                                [row.id]: { ...draft, name: e.target.value },
                              }))
                            }
                            placeholder="Nama folder"
                            maxLength={60}
                          />
                          <Textarea
                            value={draft.hint}
                            onChange={(e) =>
                              setEditing((s) => ({
                                ...s,
                                [row.id]: { ...draft, hint: e.target.value },
                              }))
                            }
                            placeholder="Keterangan"
                            rows={1}
                            maxLength={200}
                          />
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium">{row.name}</span>
                            {row.is_system && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft text-primary px-2 py-0.5 text-[10px] uppercase tracking-wider">
                                Sistem
                              </span>
                            )}
                            <span className="text-[11px] text-muted-foreground">
                              · slug: <code className="font-mono">{row.slug}</code>
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              · {docCount} dokumen
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {row.hint || (
                              <span className="italic opacity-60">Tanpa keterangan</span>
                            )}
                          </p>
                        </>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isEditing ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => saveEdit(row)}
                            disabled={saving === row.id}
                          >
                            {saving === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => cancelEdit(row.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(row)}
                            title="Ubah"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(row)}
                            disabled={row.is_system || docCount > 0}
                            className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                            title={
                              row.is_system
                                ? "Folder sistem tidak dapat dihapus"
                                : docCount > 0
                                  ? "Folder masih berisi dokumen"
                                  : "Hapus"
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="px-5 py-3 text-[11px] text-muted-foreground border-t border-border bg-muted/20">
          Catatan: slug folder bersifat tetap dan dipakai sebagai identitas. Mengubah nama tidak
          mengubah slug, jadi dokumen yang sudah ada tetap tertaut ke folder yang benar.
        </p>
      </div>
    </div>
  );
}
