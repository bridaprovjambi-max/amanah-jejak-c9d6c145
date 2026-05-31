import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  Paperclip, X, Download, Trash2, FileIcon, Plus,
  ChevronDown, ChevronUp, Check, XCircle, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/pptk")({
  component: PptkPage,
});

type PptkStatus = "submitted" | "reviewed" | "approved" | "rejected";

interface PptkReport {
  id: string;
  reporter_id: string;
  period_year: number;
  period_month: number;
  kegiatan: string;
  uraian_pelaksanaan: string;
  target_fisik_bulan: string | null;
  target_realisasi_keuangan: string | null;
  realisasi_fisik: string | null;
  realisasi_keuangan: string | null;
  kendala: string | null;
  faktor_pendukung: string | null;
  tindak_lanjut: string | null;
  status: PptkStatus;
  sekretaris_id: string | null;
  sekretaris_notes: string | null;
  sekretaris_at: string | null;
  kepala_id: string | null;
  kepala_notes: string | null;
  kepala_at: string | null;
  created_at: string;
}

interface PptkAttachment {
  id: string;
  report_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

const MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember",
];

const STATUS_LABEL: Record<PptkStatus, string> = {
  submitted: "Diajukan ke Sekretaris",
  reviewed: "Diteruskan ke Kepala",
  approved: "Disetujui Kepala",
  rejected: "Ditolak",
};

const STATUS_VARIANT: Record<PptkStatus, "default" | "secondary" | "outline" | "destructive"> = {
  submitted: "secondary",
  reviewed: "default",
  approved: "default",
  rejected: "destructive",
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PptkPage() {
  const { user, profile, hasRole } = useAuth();
  const now = new Date();

  const [reports, setReports] = useState<PptkReport[]>([]);
  const [attachments, setAttachments] = useState<Record<string, PptkAttachment[]>>({});
  const [reporters, setReporters] = useState<Record<string, { full_name: string; jabatan: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);

  const isSekretaris = hasRole(["sekretaris", "admin"]);
  const isKepala = hasRole(["kepala", "admin"]);

  // Form
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [kegiatan, setKegiatan] = useState("");
  const [uraian, setUraian] = useState("");
  const [targetFisik, setTargetFisik] = useState("");
  const [targetKeu, setTargetKeu] = useState("");
  const [realFisik, setRealFisik] = useState("");
  const [realKeu, setRealKeu] = useState("");
  const [kendala, setKendala] = useState("");
  const [faktorPendukung, setFaktorPendukung] = useState("");
  const [tindak, setTindak] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter
  const [filterStatus, setFilterStatus] = useState<PptkStatus | "all">("all");
  const [filterYear, setFilterYear] = useState<number | "all">(now.getFullYear());

  // Action dialogs (inline note)
  const [actionFor, setActionFor] = useState<{ id: string; kind: "review" | "approve" | "reject" } | null>(null);
  const [actionNote, setActionNote] = useState("");

  const load = async () => {
    setLoading(true);
    const { data: rep } = await supabase
      .from("pptk_reports")
      .select("*")
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })
      .order("created_at", { ascending: false });
    const rows = (rep ?? []) as PptkReport[];
    setReports(rows);
    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const reporterIds = Array.from(new Set(rows.map((r) => r.reporter_id)));
      const [{ data: atts }, { data: profs }] = await Promise.all([
        supabase.from("pptk_report_attachments").select("*").in("report_id", ids),
        supabase.from("profiles").select("id, full_name, jabatan").in("id", reporterIds),
      ]);
      const grouped: Record<string, PptkAttachment[]> = {};
      ((atts ?? []) as PptkAttachment[]).forEach((a) => {
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

  useEffect(() => { load(); }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const tooBig = arr.find((f) => f.size > 20 * 1024 * 1024);
    if (tooBig) return toast.error(`File "${tooBig.name}" melebihi 20 MB`);
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const uploadFiles = async (reportId: string) => {
    for (const f of pendingFiles) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${user!.id}/pptk/${reportId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) { toast.error(`Gagal unggah ${f.name}: ${upErr.message}`); continue; }
      const { error: insErr } = await supabase.from("pptk_report_attachments").insert({
        report_id: reportId,
        uploaded_by: user!.id,
        file_path: path,
        file_name: f.name,
        file_size: f.size,
        mime_type: f.type || null,
      });
      if (insErr) toast.error(`Gagal simpan metadata: ${insErr.message}`);
    }
  };

  const resetForm = () => {
    setKegiatan(""); setUraian(""); setTargetFisik(""); setTargetKeu("");
    setRealFisik(""); setRealKeu(""); setKendala(""); setFaktorPendukung("");
    setTindak(""); setPendingFiles([]);
    setPeriodYear(now.getFullYear()); setPeriodMonth(now.getMonth() + 1);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (kegiatan.trim().length < 3) return toast.error("Nama Sub Kegiatan minimal 3 karakter");
    if (uraian.trim().length < 5) return toast.error("Uraian pelaksanaan minimal 5 karakter");
    setBusy(true);
    const { data, error } = await supabase
      .from("pptk_reports")
      .insert({
        reporter_id: user!.id,
        period_year: periodYear,
        period_month: periodMonth,
        kegiatan: kegiatan.trim(),
        uraian_pelaksanaan: uraian.trim(),
        target_fisik_bulan: targetFisik.trim() || null,
        target_realisasi_keuangan: targetKeu.trim() || null,
        realisasi_fisik: realFisik.trim() || null,
        realisasi_keuangan: realKeu.trim() || null,
        kendala: kendala.trim() || null,
        faktor_pendukung: faktorPendukung.trim() || null,
        tindak_lanjut: tindak.trim() || null,
      })
      .select("id")
      .single();
    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Gagal menyimpan"); }
    if (pendingFiles.length > 0) await uploadFiles(data.id);
    await supabase.from("activity_log").insert({
      user_id: user!.id,
      action: "create_pptk_report",
      entity_type: "pptk_report",
      entity_id: data.id,
      details: { period_year: periodYear, period_month: periodMonth, kegiatan: kegiatan.trim() },
    });
    setBusy(false);
    toast.success("Laporan PPTK diajukan ke Sekretaris");
    resetForm(); setShowForm(false); load();
  };

  const downloadAtt = async (att: PptkAttachment) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Gagal");
    window.open(data.signedUrl, "_blank");
  };

  const deleteReport = async (r: PptkReport) => {
    if (!confirm("Hapus laporan ini? Semua lampiran ikut terhapus.")) return;
    const atts = attachments[r.id] ?? [];
    const { error } = await supabase.from("pptk_reports").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    toast.success("Laporan dihapus");
    load();
  };

  const submitAction = async () => {
    if (!actionFor) return;
    const { id, kind } = actionFor;
    const note = actionNote.trim() || null;
    let patch: Partial<PptkReport> = {};
    if (kind === "review") {
      patch = {
        status: "reviewed",
        sekretaris_id: user!.id,
        sekretaris_notes: note,
        sekretaris_at: new Date().toISOString(),
      };
    } else if (kind === "approve") {
      patch = {
        status: "approved",
        kepala_id: user!.id,
        kepala_notes: note,
        kepala_at: new Date().toISOString(),
      };
    } else {
      patch = {
        status: "rejected",
        kepala_id: user!.id,
        kepala_notes: note,
        kepala_at: new Date().toISOString(),
      };
    }
    const { error } = await supabase.from("pptk_reports").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    await supabase.from("activity_log").insert({
      user_id: user!.id,
      action: `pptk_${kind}`,
      entity_type: "pptk_report",
      entity_id: id,
      details: { note },
    });
    toast.success("Tindakan tersimpan");
    setActionFor(null); setActionNote(""); load();
  };

  const canDelete = (r: PptkReport) => r.reporter_id === user?.id || hasRole("admin");
  const filtered = reports.filter((r) => {
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterYear !== "all" && r.period_year !== filterYear) return false;
    return true;
  });
  const years = Array.from(new Set(reports.map((r) => r.period_year))).sort((a, b) => b - a);

  return (
    <div className="space-y-7 min-w-0">
      <div className="animate-fade-in-up">
        <PageHeader
          eyebrow="Pelaporan Berkala"
          title="Laporan Pelaksanaan Kegiatan (PPTK)"
          description="Alur: Pelapor (PPTK) → Sekretaris → Kepala BRIDA."
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
          <CardHeader><CardTitle>Formulir Laporan PPTK</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama PPTK</Label>
                <Input value={profile?.full_name ?? user?.email ?? ""} disabled readOnly className="bg-muted/50" />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
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
                  <Input type="number" min={2020} max={2100} value={periodYear}
                    onChange={(e) => setPeriodYear(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nama Sub Kegiatan *</Label>
                <Input value={kegiatan} onChange={(e) => setKegiatan(e.target.value)} maxLength={300} />
              </div>

              <div className="space-y-2">
                <Label>Uraian Pelaksanaan *</Label>
                <Textarea value={uraian} onChange={(e) => setUraian(e.target.value)}
                  placeholder="Apa yang dikerjakan, hasil/output, tahapan pelaksanaan..."
                  rows={4} maxLength={6000} />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Target Fisik Bulan</Label>
                  <Input value={targetFisik} onChange={(e) => setTargetFisik(e.target.value)} placeholder="contoh: 100%" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Target Realisasi Keuangan</Label>
                  <Input value={targetKeu} onChange={(e) => setTargetKeu(e.target.value)} placeholder="contoh: Rp 150.000.000" maxLength={120} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Realisasi Fisik</Label>
                  <Input value={realFisik} onChange={(e) => setRealFisik(e.target.value)} placeholder="contoh: 80%" maxLength={100} />
                </div>
                <div className="space-y-2">
                  <Label>Realisasi Keuangan</Label>
                  <Input value={realKeu} onChange={(e) => setRealKeu(e.target.value)} placeholder="contoh: Rp 120.000.000 / 75%" maxLength={120} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Faktor Penghambat</Label>
                  <Textarea value={kendala} onChange={(e) => setKendala(e.target.value)} rows={3} maxLength={2000} />
                </div>
                <div className="space-y-2">
                  <Label>Faktor Pendukung</Label>
                  <Textarea value={faktorPendukung} onChange={(e) => setFaktorPendukung(e.target.value)} rows={3} maxLength={2000} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tindak Lanjut</Label>
                <Textarea value={tindak} onChange={(e) => setTindak(e.target.value)} rows={3} maxLength={2000} />
              </div>

              <div className="space-y-2">
                <Label>Bukti Pendukung</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" multiple className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
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
                        <button type="button" onClick={() => setPendingFiles((p) => p.filter((_, x) => x !== i))}
                          className="text-muted-foreground hover:text-destructive">
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
                  {busy ? "Mengirim..." : "Kirim ke Sekretaris"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as PptkStatus | "all")}>
            <SelectTrigger className="h-8 w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua status</SelectItem>
              {(Object.keys(STATUS_LABEL) as PptkStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Tahun</Label>
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(v === "all" ? "all" : Number(v))}>
            <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tahun</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} laporan</div>
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        <Badge variant="outline">{MONTHS[r.period_month - 1]} {r.period_year}</Badge>
                        {atts.length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Paperclip className="h-3 w-3" /> {atts.length}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-base sm:text-lg font-semibold break-words">{r.kegiatan}</h3>
                      <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                        Pelapor: <b>{rep?.full_name ?? "—"}</b>{rep?.jabatan ? ` · ${rep.jabatan}` : ""}
                        {" · "}{formatDateID(r.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Link to="/pptk/$reportId" params={{ reportId: r.id }}>
                        <Button variant="ghost" size="sm" title="Lihat detail">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !isOpen }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {canDelete(r) && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteReport(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                  {isOpen && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <Field label="Uraian Pelaksanaan" value={r.uraian_pelaksanaan} />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <Field label="Target Fisik Bulan" value={r.target_fisik_bulan} />
                        <Field label="Target Realisasi Keuangan" value={r.target_realisasi_keuangan} />
                        <Field label="Realisasi Fisik" value={r.realisasi_fisik} />
                        <Field label="Realisasi Keuangan" value={r.realisasi_keuangan} />
                        <Field label="Faktor Penghambat" value={r.kendala} />
                        <Field label="Faktor Pendukung" value={r.faktor_pendukung} />
                        <Field label="Tindak Lanjut" value={r.tindak_lanjut} />
                      </div>

                      {atts.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-muted-foreground mb-1">Lampiran</div>
                          <ul className="space-y-1">
                            {atts.map((a) => (
                              <li key={a.id} className="flex items-center justify-between text-sm rounded-md border border-border bg-muted/40 px-3 py-1.5">
                                <span className="truncate flex items-center gap-2">
                                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                  {a.file_name} <span className="text-muted-foreground">({fmtBytes(a.file_size)})</span>
                                </span>
                                <Button size="sm" variant="ghost" onClick={() => downloadAtt(a)}>
                                  <Download className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Workflow notes */}
                      {(r.sekretaris_at || r.kepala_at) && (
                        <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
                          {r.sekretaris_at && (
                            <div>
                              <b>Sekretaris</b> · {new Date(r.sekretaris_at).toLocaleString("id-ID")}
                              {r.sekretaris_notes && <div className="text-muted-foreground mt-0.5">{r.sekretaris_notes}</div>}
                            </div>
                          )}
                          {r.kepala_at && (
                            <div>
                              <b>Kepala BRIDA</b> · {new Date(r.kepala_at).toLocaleString("id-ID")}
                              {r.kepala_notes && <div className="text-muted-foreground mt-0.5">{r.kepala_notes}</div>}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Workflow actions */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {r.status === "submitted" && isSekretaris && (
                          <Button size="sm" onClick={() => { setActionFor({ id: r.id, kind: "review" }); setActionNote(""); }}>
                            <Check className="h-4 w-4" /> Teruskan ke Kepala
                          </Button>
                        )}
                        {r.status === "reviewed" && isKepala && (
                          <>
                            <Button size="sm" onClick={() => { setActionFor({ id: r.id, kind: "approve" }); setActionNote(""); }}>
                              <Check className="h-4 w-4" /> Setujui
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setActionFor({ id: r.id, kind: "reject" }); setActionNote(""); }}>
                              <XCircle className="h-4 w-4" /> Tolak
                            </Button>
                          </>
                        )}
                      </div>

                      {actionFor?.id === r.id && (
                        <div className="rounded-md border border-border p-3 space-y-2">
                          <Label className="text-xs">
                            Catatan {actionFor.kind === "review" ? "Sekretaris" : "Kepala"} (opsional)
                          </Label>
                          <Textarea rows={3} value={actionNote} onChange={(e) => setActionNote(e.target.value)} maxLength={2000} />
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setActionFor(null); setActionNote(""); }}>Batal</Button>
                            <Button size="sm" onClick={submitAction}>Simpan</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="text-sm whitespace-pre-wrap">{value}</div>
    </div>
  );
}
