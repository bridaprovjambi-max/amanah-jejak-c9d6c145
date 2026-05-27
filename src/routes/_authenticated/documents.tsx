import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { FileText, Upload, Download, Trash2, Loader2, Search, CalendarDays, X, Folder, FolderOpen, ChevronRight, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

const FOLDERS = [
  "Kepala",
  "Sekretaris",
  "Kasubbag",
  "Pokja Riset",
  "Pokja Inovasi",
  "Jafung",
  "Staf",
  "Umum",
] as const;
type FolderName = (typeof FOLDERS)[number];

const FOLDER_HINT: Record<FolderName, string> = {
  Kepala: "Dokumen pimpinan & kebijakan strategis",
  Sekretaris: "Administrasi & koordinasi kesekretariatan",
  Kasubbag: "Dokumen sub-bagian & operasional",
  "Pokja Riset": "Materi & laporan kelompok kerja riset",
  "Pokja Inovasi": "Materi & laporan kelompok kerja inovasi",
  Jafung: "Dokumen jabatan fungsional",
  Staf: "Dokumen staf pelaksana",
  Umum: "Dokumen umum lintas tim",
};

interface DocRow {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string;
  created_at: string;
  folder: string;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

function DocumentsPage() {
  const { profile, hasRole } = useAuth();
  const [rows, setRows] = useState<DocRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUploader, setSelectedUploader] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const load = async () => {
    const [{ data: d }, { data: p }] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);
    setRows((d as DocRow[]) ?? []);
    const u: Record<string, string> = {};
    (p ?? []).forEach((x: { id: string; full_name: string }) => (u[x.id] = x.full_name));
    setUsers(u);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = q ? r.title.toLowerCase().includes(q) : true;
      const matchUploader = selectedUploader ? r.uploaded_by === selectedUploader : true;
      const rDate = new Date(r.created_at).toISOString().slice(0, 10);
      const matchDateFrom = dateFrom ? rDate >= dateFrom : true;
      const matchDateTo = dateTo ? rDate <= dateTo : true;
      return matchTitle && matchUploader && matchDateFrom && matchDateTo;
    });
  }, [rows, searchQuery, selectedUploader, dateFrom, dateTo]);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (searchQuery.trim()) c++;
    if (selectedUploader) c++;
    if (dateFrom) c++;
    if (dateTo) c++;
    return c;
  }, [searchQuery, selectedUploader, dateFrom, dateTo]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedUploader("");
    setDateFrom("");
    setDateTo("");
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !profile) return;
    if (!title.trim()) {
      toast.error("Judul wajib diisi");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Ukuran file maksimal 25MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `${profile.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error: upErr } = await supabase.storage.from("documents").upload(path, file);
    if (upErr) {
      toast.error(`Gagal mengunggah: ${upErr.message}`);
      setUploading(false);
      return;
    }
    const { error: insErr } = await supabase.from("documents").insert({
      title: title.trim(),
      description: description.trim() || null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || null,
      uploaded_by: profile.id,
    });
    if (insErr) {
      toast.error(`Gagal menyimpan: ${insErr.message}`);
      await supabase.storage.from("documents").remove([path]);
      setUploading(false);
      return;
    }
    toast.success("Dokumen berhasil diunggah");
    setTitle("");
    setDescription("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setUploading(false);
    load();
  };

  const handleDownload = async (row: DocRow) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(row.file_path, 60, { download: row.file_name });
    if (error || !data) {
      toast.error("Gagal membuat tautan unduh");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async (row: DocRow) => {
    if (!confirm(`Hapus "${row.title}"?`)) return;
    const { error } = await supabase.from("documents").delete().eq("id", row.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.storage.from("documents").remove([row.file_path]);
    toast.success("Dokumen dihapus");
    load();
  };

  const canDelete = (row: DocRow) =>
    profile?.id === row.uploaded_by || hasRole(["admin", "kepala", "sekretaris"]);

  const uploaderOptions = useMemo(() => {
    const map: Record<string, string> = {};
    rows.forEach((r) => {
      map[r.uploaded_by] = users[r.uploaded_by] ?? "Pengguna";
    });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows, users]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Dokumen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Unggah dan bagikan dokumen ke seluruh pengguna BRIDA.
        </p>
      </div>

      <form
        onSubmit={handleUpload}
        className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Judul Dokumen *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Contoh: Laporan Kegiatan Triwulan I"
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="file">Berkas (maks. 25MB) *</Label>
            <Input
              id="file"
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="desc">Deskripsi</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Keterangan singkat tentang dokumen…"
            rows={2}
            maxLength={500}
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={uploading || !file}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah…
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Unggah Dokumen
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Search & Filter Bar */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari judul dokumen…"
              className="pl-9 w-full"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowFilters((s) => !s)}
              className="shrink-0"
            >
              <CalendarDays className="mr-2 h-4 w-4" />
              Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
            </Button>
            {activeFilterCount > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Hapus Filter
              </Button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid gap-4 sm:grid-cols-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Uploader</Label>
              <select
                value={selectedUploader}
                onChange={(e) => setSelectedUploader(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Semua Uploader</option>
                {uploaderOptions.map(([uid, name]) => (
                  <option key={uid} value={uid}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tanggal Dari</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tanggal Sampai</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && rows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {filteredRows.length} dari {rows.length} dokumen
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada dokumen yang diunggah.</p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Tidak ada dokumen yang cocok dengan filter Anda.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={clearFilters}>
            Hapus Filter
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <ul className="divide-y divide-border">
            {filteredRows.map((r) => (
              <li key={r.id} className="flex items-start gap-4 px-5 py-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.title}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                      {r.description}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {r.file_name} · {formatSize(r.file_size)} ·{" "}
                    diunggah oleh {users[r.uploaded_by] ?? "Pengguna"} ·{" "}
                    {new Date(r.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(r)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete(r) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(r)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
