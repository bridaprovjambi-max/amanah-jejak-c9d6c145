import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { FileText, Upload, Download, Trash2, Loader2, Search, CalendarDays, X, Folder, FolderOpen, ChevronRight, ChevronDown, Lock } from "lucide-react";
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

// Folder slugs known to the permission matrix. Any folder NOT in this list
// is treated as a custom folder: visible to everyone, manageable by leaders
// + the uploader's own role-default folder.
const KNOWN_FOLDERS = [
  "Kepala",
  "Sekretaris",
  "Kasubbag",
  "Pokja Riset",
  "Pokja Inovasi",
  "Jafung",
  "Staf",
  "Umum",
] as const;
type FolderName = string;

interface FolderMeta {
  slug: string;
  name: string;
  hint: string | null;
  sort_order: number;
}


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

/**
 * Folder permission matrix per echelon/role.
 * - `view`: folders the user can see
 * - `manage`: folders the user can upload into (delete tetap berdasarkan uploader / leader)
 */
function getFolderPermissions(args: {
  jenjang?: string;
  isAdmin: boolean;
  isKepala: boolean;
  isSekretaris: boolean;
  isKasubbag: boolean;
  isJafung: boolean;
  pokjaName?: string | null;
  allSlugs: string[];
}): { view: FolderName[]; manage: FolderName[] } {
  const { jenjang, isAdmin, isKepala, isSekretaris, isKasubbag, isJafung, pokjaName, allSlugs } =
    args;

  // Custom folders (not in KNOWN_FOLDERS): visible to everyone, manageable
  // only by leaders. Keeps the role matrix predictable.
  const knownSet = new Set<string>(KNOWN_FOLDERS);
  const customSlugs = allSlugs.filter((s) => !knownSet.has(s));

  if (isAdmin || isKepala || jenjang === "eselon_ii") {
    return { view: [...allSlugs], manage: [...allSlugs] };
  }
  if (isSekretaris || jenjang === "eselon_iii") {
    return {
      view: [...allSlugs],
      manage: [
        "Sekretaris",
        "Kasubbag",
        "Pokja Riset",
        "Pokja Inovasi",
        "Jafung",
        "Staf",
        "Umum",
        ...customSlugs,
      ],
    };
  }
  if (isKasubbag || jenjang === "eselon_iv") {
    return {
      view: ["Sekretaris", "Kasubbag", "Staf", "Umum", ...customSlugs],
      manage: ["Kasubbag", "Staf", "Umum"],
    };
  }
  if (jenjang === "pokja") {
    const name = (pokjaName ?? "").toLowerCase();
    const own: FolderName = name.includes("inovasi") ? "Pokja Inovasi" : "Pokja Riset";
    return {
      view: ["Pokja Riset", "Pokja Inovasi", "Umum", ...customSlugs],
      manage: [own, "Umum"],
    };
  }
  if (isJafung || jenjang === "jafung") {
    return { view: ["Jafung", "Umum", ...customSlugs], manage: ["Jafung", "Umum"] };
  }
  if (jenjang === "staf") {
    return { view: ["Staf", "Umum", ...customSlugs], manage: ["Staf", "Umum"] };
  }
  return { view: ["Umum", ...customSlugs], manage: ["Umum"] };
}


/**
 * Tentukan folder default (home folder) pengguna berdasarkan jenjang/role.
 * Dipakai sebagai initial value saat memilih folder upload.
 */
function getDefaultFolder(args: {
  jenjang?: string;
  isAdmin: boolean;
  isKepala: boolean;
  isSekretaris: boolean;
  isKasubbag: boolean;
  isJafung: boolean;
  pokjaName?: string | null;
}): FolderName {
  const { jenjang, isAdmin, isKepala, isSekretaris, isKasubbag, isJafung, pokjaName } = args;

  if (isAdmin || isKepala || jenjang === "eselon_ii") return "Kepala";
  if (isSekretaris || jenjang === "eselon_iii") return "Sekretaris";
  if (isKasubbag || jenjang === "eselon_iv") return "Kasubbag";
  if (jenjang === "pokja") {
    const name = (pokjaName ?? "").toLowerCase();
    return name.includes("inovasi") ? "Pokja Inovasi" : "Pokja Riset";
  }
  if (isJafung || jenjang === "jafung") return "Jafung";
  if (jenjang === "staf") return "Staf";
  return "Umum";
}

function DocumentsPage() {
  const { profile, hasRole } = useAuth();
  const [rows, setRows] = useState<DocRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [pokjaMap, setPokjaMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folder, setFolder] = useState<FolderName>("Umum");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Folder navigation
  const [activeFolder, setActiveFolder] = useState<FolderName | "ALL">("ALL");
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FOLDERS.map((f) => [f, true]))
  );

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUploader, setSelectedUploader] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  const permissions = useMemo(
    () =>
      getFolderPermissions({
        jenjang: profile?.jenjang,
        isAdmin: hasRole("admin"),
        isKepala: hasRole("kepala"),
        isSekretaris: hasRole("sekretaris"),
        isKasubbag: hasRole("kasubbag"),
        isJafung: hasRole("jafung_member"),
        pokjaName: profile?.pokja_id ? pokjaMap[profile.pokja_id] : null,
      }),
    [profile, hasRole, pokjaMap],
  );

  const defaultFolder = useMemo(
    () =>
      getDefaultFolder({
        jenjang: profile?.jenjang,
        isAdmin: hasRole("admin"),
        isKepala: hasRole("kepala"),
        isSekretaris: hasRole("sekretaris"),
        isKasubbag: hasRole("kasubbag"),
        isJafung: hasRole("jafung_member"),
        pokjaName: profile?.pokja_id ? pokjaMap[profile.pokja_id] : null,
      }),
    [profile, hasRole, pokjaMap],
  );

  const viewSet = useMemo(() => new Set<string>(permissions.view), [permissions]);
  const manageSet = useMemo(() => new Set<string>(permissions.manage), [permissions]);

  // Sinkronkan folder upload: prioritaskan defaultFolder kalau diizinkan,
  // kalau tidak pakai folder pertama dari manage permissions
  useEffect(() => {
    if (permissions.manage.length) {
      const target = manageSet.has(defaultFolder) ? defaultFolder : permissions.manage[0];
      setFolder(target);
    }
  }, [permissions, manageSet, defaultFolder]);

  // Reset filter folder jika user tidak punya akses
  useEffect(() => {
    if (activeFolder !== "ALL" && !viewSet.has(activeFolder)) {
      setActiveFolder("ALL");
    }
  }, [activeFolder, viewSet]);

  const load = async () => {
    const [{ data: d }, { data: p }, { data: pk }] = await Promise.all([
      supabase.from("documents").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("pokja").select("id, name"),
    ]);
    setRows((d as DocRow[]) ?? []);
    const u: Record<string, string> = {};
    (p ?? []).forEach((x: { id: string; full_name: string }) => (u[x.id] = x.full_name));
    setUsers(u);
    const pm: Record<string, string> = {};
    (pk ?? []).forEach((x: { id: string; name: string }) => (pm[x.id] = x.name));
    setPokjaMap(pm);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  // Hanya tampilkan dokumen dari folder yang boleh dilihat user
  const visibleRows = useMemo(
    () => rows.filter((r) => viewSet.has((r.folder || "Umum") as FolderName)),
    [rows, viewSet],
  );

  const filteredRows = useMemo(() => {
    return visibleRows.filter((r) => {
      const q = searchQuery.trim().toLowerCase();
      const matchTitle = q ? r.title.toLowerCase().includes(q) : true;
      const matchUploader = selectedUploader ? r.uploaded_by === selectedUploader : true;
      const rDate = new Date(r.created_at).toISOString().slice(0, 10);
      const matchDateFrom = dateFrom ? rDate >= dateFrom : true;
      const matchDateTo = dateTo ? rDate <= dateTo : true;
      const matchFolder = activeFolder === "ALL" ? true : (r.folder || "Umum") === activeFolder;
      return matchTitle && matchUploader && matchDateFrom && matchDateTo && matchFolder;
    });
  }, [visibleRows, searchQuery, selectedUploader, dateFrom, dateTo, activeFolder]);

  const folderCounts = useMemo(() => {
    const c: Record<string, number> = {};
    FOLDERS.forEach((f) => (c[f] = 0));
    visibleRows.forEach((r) => {
      const k = (r.folder || "Umum") as FolderName;
      c[k] = (c[k] ?? 0) + 1;
    });
    return c;
  }, [visibleRows]);

  const groupedByFolder = useMemo(() => {
    const g: Record<string, DocRow[]> = {};
    FOLDERS.forEach((f) => (g[f] = []));
    filteredRows.forEach((r) => {
      const k = (r.folder || "Umum") as FolderName;
      (g[k] ??= []).push(r);
    });
    return g;
  }, [filteredRows]);

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
    if (!manageSet.has(folder)) {
      toast.error(`Anda tidak memiliki izin mengunggah ke folder "${folder}"`);
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
      folder,
    });
    if (insErr) {
      toast.error(`Gagal menyimpan: ${insErr.message}`);
      await supabase.storage.from("documents").remove([path]);
      setUploading(false);
      return;
    }
    toast.success(`Dokumen tersimpan di folder "${folder}"`);
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
    (profile?.id === row.uploaded_by && manageSet.has((row.folder || "Umum") as FolderName)) ||
    hasRole(["admin", "kepala", "sekretaris"]);

  const uploaderOptions = useMemo(() => {
    const map: Record<string, string> = {};
    visibleRows.forEach((r) => {
      map[r.uploaded_by] = users[r.uploaded_by] ?? "Pengguna";
    });
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]));
  }, [visibleRows, users]);

  const visibleFolders = useMemo(() => FOLDERS.filter((f) => viewSet.has(f)), [viewSet]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Dokumen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Akses dokumen disesuaikan dengan jenjang & peran Anda di BRIDA.
        </p>
        <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Akses folder Anda: {permissions.view.length === FOLDERS.length ? "Semua folder" : permissions.view.join(", ")}
        </div>
      </div>

      {permissions.manage.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
          Anda tidak memiliki izin untuk mengunggah dokumen. Hubungi pimpinan untuk akses lebih lanjut.
        </div>
      ) : (
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
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="folder">Folder / Tim *</Label>
              <select
                id="folder"
                value={folder}
                onChange={(e) => setFolder(e.target.value as FolderName)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {permissions.manage.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">{FOLDER_HINT[folder]}</p>
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
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={uploading || !file}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Mengunggah…
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" /> Unggah ke {folder}
                </>
              )}
            </Button>
          </div>
        </form>
      )}

      {/* Folder chips */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <FolderOpen className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold">Folder Dokumen</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveFolder("ALL")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
              activeFolder === "ALL"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background hover:border-primary/40"
            }`}
          >
            Semua <span className="opacity-70">({visibleRows.length})</span>
          </button>
          {visibleFolders.map((f) => {
            const active = activeFolder === f;
            const canManage = manageSet.has(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => setActiveFolder(f)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:border-primary/40"
                }`}
                title={canManage ? "Anda dapat mengunggah ke folder ini" : "Hanya baca"}
              >
                {canManage ? <Folder className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {f} <span className="opacity-70">({folderCounts[f] ?? 0})</span>
              </button>
            );
          })}
        </div>
      </div>

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
      {!loading && visibleRows.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Menampilkan {filteredRows.length} dari {visibleRows.length} dokumen yang dapat Anda akses
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <FileText className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada dokumen pada folder yang dapat Anda akses.</p>
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
        <div className="space-y-4">
          {(activeFolder === "ALL" ? visibleFolders : [activeFolder]).map((f) => {
            const items = groupedByFolder[f] ?? [];
            if (items.length === 0) return null;
            const isOpen = expanded[f] ?? true;
            const canManage = manageSet.has(f);
            return (
              <div key={f} className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [f]: !isOpen }))}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-muted/40 hover:bg-muted/60 transition"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-display font-semibold text-sm truncate">{f}</span>
                    {!canManage && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <Lock className="h-3 w-3" /> Hanya baca
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground hidden sm:inline truncate">
                      · {FOLDER_HINT[f]}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground shrink-0">
                    {items.length} dokumen
                  </span>
                </button>
                {isOpen && (
                  <ul className="divide-y divide-border">
                    {items.map((r) => (
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
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
