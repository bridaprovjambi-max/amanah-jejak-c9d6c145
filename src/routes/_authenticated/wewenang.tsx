import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Paperclip,
  X,
  Download,
  Trash2,
  FileIcon,
  Plus,
  ChevronDown,
  ChevronUp,
  Eye,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, JENJANG_LABEL, type Jenjang } from "@/lib/auth";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import { formatDateTimeID } from "@/lib/format";

type WewenangSearch = { q?: string; jenjang?: Jenjang; year?: number };

const JENJANG_KEYS: Jenjang[] = ["staf", "pokja", "jafung", "eselon_iv", "eselon_iii", "eselon_ii"];

export const Route = createFileRoute("/_authenticated/wewenang")({
  validateSearch: (s: Record<string, unknown>): WewenangSearch => {
    const jenjang =
      typeof s.jenjang === "string" && (JENJANG_KEYS as readonly string[]).includes(s.jenjang)
        ? (s.jenjang as Jenjang)
        : undefined;
    const yearNum = typeof s.year === "number" ? s.year : typeof s.year === "string" ? Number(s.year) : NaN;
    return {
      q: typeof s.q === "string" && s.q ? s.q : undefined,
      jenjang,
      year: Number.isFinite(yearNum) ? yearNum : undefined,
    };
  },
  component: WewenangPage,
});

interface AuthorityReport {
  id: string;
  reporter_id: string;
  jenjang: Jenjang;
  period_year: number;
  period_month: number;
  authority_description: string;
  execution_summary: string;
  obstacles: string | null;
  follow_up_notes: string | null;
  status: string;
  created_at: string;
}

interface AuthorityAttachment {
  id: string;
  report_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function WewenangPage() {
  const { user, profile, hasRole } = useAuth();
  const now = new Date();

  const [reports, setReports] = useState<AuthorityReport[]>([]);
  const [attachments, setAttachments] = useState<Record<string, AuthorityAttachment[]>>({});
  const [reporters, setReporters] = useState<Record<string, { full_name: string; jabatan: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [jenjang, setJenjang] = useState<Jenjang>(profile?.jenjang ?? "pokja");
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [authorityDesc, setAuthorityDesc] = useState("");
  const [executionSummary, setExecutionSummary] = useState("");
  const [obstacles, setObstacles] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = search.q ?? "";
  const filterJenjang: Jenjang | "all" = search.jenjang ?? "all";
  const filterYear: number | "all" = search.year ?? now.getFullYear();
  const setQ = (v: string) =>
    navigate({ search: (p: WewenangSearch) => ({ ...p, q: v || undefined }), replace: true });
  const setFilterJenjang = (v: Jenjang | "all") =>
    navigate({ search: (p: WewenangSearch) => ({ ...p, jenjang: v === "all" ? undefined : v }), replace: true });
  const setFilterYear = (v: number | "all") =>
    navigate({ search: (p: WewenangSearch) => ({ ...p, year: v === "all" ? undefined : v }), replace: true });

  useEffect(() => {
    if (profile) setJenjang(profile.jenjang);
  }, [profile]);

  const load = async () => {
    setLoading(true);
    const { data: rep } = await supabase
      .from("authority_reports")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("created_at", { ascending: false });
    const rows = (rep ?? []) as AuthorityReport[];
    setReports(rows);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id)));
      const [{ data: atts }, { data: profs }] = await Promise.all([
        supabase.from("authority_report_attachments").select("*").in("report_id", ids),
        supabase.from("profiles").select("id, full_name, jabatan").in("id", reporterIds),
      ]);
      const grouped: Record<string, AuthorityAttachment[]> = {};
      ((atts ?? []) as AuthorityAttachment[]).forEach((a) => {
        (grouped[a.report_id] ??= []).push(a);
      });
      setAttachments(grouped);
      const map: Record<string, { full_name: string; jabatan: string | null }> = {};
      (profs ?? []).forEach((p: { id: string; full_name: string; jabatan: string | null }) => {
        map[p.id] = { full_name: p.full_name, jabatan: p.jabatan };
      });
      setReporters(map);
    } else {
      setAttachments({});
      setReporters({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const tooBig = arr.find((f) => f.size > 20 * 1024 * 1024);
    if (tooBig) {
      toast.error(`File "${tooBig.name}" melebihi 20 MB`);
      return;
    }
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const uploadFiles = async (reportId: string) => {
    for (const f of pendingFiles) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${user!.id}/wewenang/${reportId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) {
        toast.error(`Gagal mengunggah ${f.name}: ${upErr.message}`);
        continue;
      }
      const { error: insErr } = await supabase.from("authority_report_attachments").insert({
        report_id: reportId,
        uploaded_by: user!.id,
        file_path: path,
        file_name: f.name,
        file_size: f.size,
        mime_type: f.type || null,
      });
      if (insErr) toast.error(`Gagal menyimpan metadata: ${insErr.message}`);
    }
  };

  const resetForm = () => {
    setAuthorityDesc("");
    setExecutionSummary("");
    setObstacles("");
    setFollowUp("");
    setPendingFiles([]);
    setPeriodYear(now.getFullYear());
    setPeriodMonth(now.getMonth() + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (authorityDesc.trim().length < 5) return toast.error("Uraian wewenang minimal 5 karakter");
    if (executionSummary.trim().length < 5) return toast.error("Ringkasan pelaksanaan minimal 5 karakter");
    setBusy(true);
    const { data, error } = await supabase
      .from("authority_reports")
      .insert({
        reporter_id: user!.id,
        jenjang,
        period_year: periodYear,
        period_month: periodMonth,
        authority_description: authorityDesc.trim(),
        execution_summary: executionSummary.trim(),
        obstacles: obstacles.trim() || null,
        follow_up_notes: followUp.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Gagal menyimpan laporan");
    }
    if (pendingFiles.length > 0) await uploadFiles(data.id);
    await supabase.from("activity_log").insert({
      user_id: user!.id,
      action: "create_authority_report",
      entity_type: "authority_report",
      entity_id: data.id,
      details: { jenjang, period_year: periodYear, period_month: periodMonth },
    });
    setBusy(false);
    toast.success("Laporan wewenang tersimpan");
    resetForm();
    setShowForm(false);
    load();
  };

  const downloadAtt = async (att: AuthorityAttachment) => {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Gagal membuat tautan");
    window.open(data.signedUrl, "_blank");
  };

  const deleteAtt = async (att: AuthorityAttachment) => {
    if (!confirm(`Hapus lampiran "${att.file_name}"?`)) return;
    const { error } = await supabase.from("authority_report_attachments").delete().eq("id", att.id);
    if (error) return toast.error(error.message);
    await supabase.storage.from("documents").remove([att.file_path]);
    setAttachments((prev) => ({
      ...prev,
      [att.report_id]: (prev[att.report_id] ?? []).filter((a) => a.id !== att.id),
    }));
    toast.success("Lampiran dihapus");
  };

  const deleteReport = async (r: AuthorityReport) => {
    if (!confirm("Hapus laporan ini? Semua lampiran ikut terhapus.")) return;
    const atts = attachments[r.id] ?? [];
    const { error } = await supabase.from("authority_reports").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) {
      await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    }
    toast.success("Laporan dihapus");
    load();
  };

  const canDelete = (r: AuthorityReport) => r.reporter_id === user?.id || hasRole("admin");

  const filtered = reports.filter((r) => {
    if (filterJenjang !== "all" && r.jenjang !== filterJenjang) return false;
    if (filterYear !== "all" && r.period_year !== filterYear) return false;
    if (q && !r.authority_description.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const years = Array.from(new Set(reports.map((r) => r.period_year))).sort((a, b) => b - a);

  return (
    <div className="space-y-7 min-w-0">
      <div className="animate-fade-in-up">
        <PageHeader
          eyebrow="Pelaporan Berkala"
          title="Pelaporan Pelaksanaan Wewenang"
          description="Laporan periodik per jenjang dengan bukti pendukung dan catatan tindak lanjut."
          actions={
            <Button onClick={() => setShowForm((v) => !v)} size="sm" className="shrink-0">
              {showForm ? <X className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}
              {showForm ? "Tutup" : "Laporan baru"}
            </Button>
          }
        />
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Formulir Laporan</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2 sm:col-span-3">
                  <Label>Jenjang</Label>
                  <Select value={jenjang} onValueChange={(v) => setJenjang(v as Jenjang)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(JENJANG_LABEL) as Jenjang[]).map((j) => (
                        <SelectItem key={j} value={j}>{JENJANG_LABEL[j]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Bulan</Label>
                  <Select value={String(periodMonth)} onValueChange={(v) => setPeriodMonth(Number(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => (
                        <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun</Label>
                  <Input
                    type="number"
                    min={2020}
                    max={2100}
                    value={periodYear}
                    onChange={(e) => setPeriodYear(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Uraian wewenang yang dilaksanakan *</Label>
                <Textarea
                  value={authorityDesc}
                  onChange={(e) => setAuthorityDesc(e.target.value)}
                  placeholder="Tuliskan wewenang/tugas pokok sesuai jenjang yang menjadi fokus periode ini..."
                  rows={3}
                  maxLength={2000}
                />
              </div>

              <div className="space-y-2">
                <Label>Ringkasan pelaksanaan *</Label>
                <Textarea
                  value={executionSummary}
                  onChange={(e) => setExecutionSummary(e.target.value)}
                  placeholder="Apa saja yang telah dikerjakan, hasil/output yang dicapai..."
                  rows={4}
                  maxLength={4000}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kendala</Label>
                  <Textarea
                    value={obstacles}
                    onChange={(e) => setObstacles(e.target.value)}
                    placeholder="Kendala/hambatan yang ditemui (opsional)"
                    rows={3}
                    maxLength={2000}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Catatan tindak lanjut</Label>
                  <Textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    placeholder="Rencana/aksi tindak lanjut periode berikutnya (opsional)"
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bukti pendukung</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="h-4 w-4" /> Tambah file
                  </Button>
                  <span className="text-xs text-muted-foreground">Maks 20 MB per file</span>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pendingFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-sm rounded-md border border-border bg-muted/40 px-3 py-1.5">
                        <span className="truncate flex items-center gap-2">
                          <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          {f.name} <span className="text-muted-foreground">({fmtBytes(f.size)})</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { resetForm(); setShowForm(false); }}>
                  Batal
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? "Menyimpan..." : "Kirim laporan"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-border bg-card p-3 shadow-card-elegant">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cari uraian wewenang…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9 h-10 border-transparent bg-muted/40 focus-visible:bg-card"
          />
        </div>
        <Select value={filterJenjang} onValueChange={(v) => setFilterJenjang(v as Jenjang | "all")}>
          <SelectTrigger className="w-full sm:w-52 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua jenjang</SelectItem>
            {(Object.keys(JENJANG_LABEL) as Jenjang[]).map((j) => (
              <SelectItem key={j} value={j}>{JENJANG_LABEL[j]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(v === "all" ? "all" : Number(v))}>
          <SelectTrigger className="w-full sm:w-36 h-10"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua tahun</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Memuat...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Belum ada laporan. Klik <b>Laporan baru</b> untuk membuat.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((r, idx) => {
            const isOpen = !!expanded[r.id];
            const rep = reporters[r.reporter_id];
            const atts = attachments[r.id] ?? [];
            return (
              <Card key={r.id} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                <CardHeader className="pb-3 px-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{JENJANG_LABEL[r.jenjang]}</Badge>
                        <Badge variant="outline">{MONTHS[r.period_month - 1]} {r.period_year}</Badge>
                        {atts.length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Paperclip className="h-3 w-3" /> {atts.length}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-2 text-sm">
                        <span className="font-medium">{rep?.full_name ?? "—"}</span>
                        {rep?.jabatan && <span className="text-muted-foreground"> · {rep.jabatan}</span>}
                      </div>
                      <p className="mt-2 text-sm text-foreground/80 line-clamp-2">
                        {r.authority_description}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link to="/wewenang/$reportId" params={{ reportId: r.id }}>
                        <Button size="sm" variant="ghost" title="Lihat detail">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !isOpen }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {canDelete(r) && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReport(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-4 border-t border-border pt-4 px-4 sm:px-6">
                    <Section title="Uraian wewenang" text={r.authority_description} />
                    <Section title="Ringkasan pelaksanaan" text={r.execution_summary} />
                    {r.obstacles && <Section title="Kendala" text={r.obstacles} />}
                    {r.follow_up_notes && <Section title="Catatan tindak lanjut" text={r.follow_up_notes} />}
                    {atts.length > 0 && (
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                          Bukti pendukung
                        </div>
                        <ul className="space-y-1">
                          {atts.map((a) => (
                            <li key={a.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
                              <span className="truncate flex items-center gap-2">
                                <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                {a.file_name} <span className="text-muted-foreground">({fmtBytes(a.file_size)})</span>
                              </span>
                              <div className="flex items-center gap-1">
                                <Button size="sm" variant="ghost" onClick={() => downloadAtt(a)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                                {(a.uploaded_by === user?.id || hasRole("admin")) && (
                                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteAtt(a)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Dibuat: {formatDateTimeID(r.created_at)}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <p className="text-sm whitespace-pre-wrap text-foreground/90">{text}</p>
    </div>
  );
}
