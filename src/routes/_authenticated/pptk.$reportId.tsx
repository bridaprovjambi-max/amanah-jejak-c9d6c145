import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileIcon, Trash2, ClipboardList, Check, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/pptk/$reportId")({
  component: PptkDetail,
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

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const STATUS_LABEL: Record<PptkStatus, string> = {
  submitted: "Diajukan ke Sekretaris",
  reviewed: "Diteruskan ke Kepala",
  approved: "Disetujui Kepala",
  rejected: "Ditolak",
};
const STATUS_VARIANT: Record<PptkStatus, "default" | "secondary" | "outline" | "destructive"> = {
  submitted: "secondary", reviewed: "default", approved: "default", rejected: "destructive",
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function PptkDetail() {
  const { reportId } = Route.useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<PptkReport | null>(null);
  const [reporter, setReporter] = useState<{ full_name: string; jabatan: string | null } | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionKind, setActionKind] = useState<"review" | "approve" | "reject" | null>(null);
  const [note, setNote] = useState("");

  const isSekretaris = hasRole(["sekretaris", "admin"]);
  const isKepala = hasRole(["kepala", "admin"]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("pptk_reports").select("*").eq("id", reportId).maybeSingle();
    if (!data) { setLoading(false); return; }
    const r = data as PptkReport;
    setReport(r);
    const [{ data: prof }, { data: a }] = await Promise.all([
      supabase.from("profiles").select("full_name, jabatan").eq("id", r.reporter_id).maybeSingle(),
      supabase.from("pptk_report_attachments").select("*").eq("report_id", reportId),
    ]);
    setReporter(prof as { full_name: string; jabatan: string | null } | null);
    setAtts((a ?? []) as Attachment[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [reportId]);

  const downloadAtt = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Gagal");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async () => {
    if (!report || !confirm("Hapus laporan ini?")) return;
    const { error } = await supabase.from("pptk_reports").delete().eq("id", report.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    toast.success("Laporan dihapus");
    navigate({ to: "/pptk" });
  };

  const submitAction = async () => {
    if (!report || !actionKind) return;
    const n = note.trim() || null;
    let patch: Partial<PptkReport> = {};
    if (actionKind === "review") patch = { status: "reviewed", sekretaris_id: user!.id, sekretaris_notes: n, sekretaris_at: new Date().toISOString() };
    else if (actionKind === "approve") patch = { status: "approved", kepala_id: user!.id, kepala_notes: n, kepala_at: new Date().toISOString() };
    else patch = { status: "rejected", kepala_id: user!.id, kepala_notes: n, kepala_at: new Date().toISOString() };
    const { error } = await supabase.from("pptk_reports").update(patch).eq("id", report.id);
    if (error) return toast.error(error.message);
    toast.success("Tindakan tersimpan");
    setActionKind(null); setNote(""); load();
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!report) return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/pptk"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Laporan tidak ditemukan.</CardContent></Card>
    </div>
  );

  const canDelete = report.reporter_id === user?.id || hasRole("admin");

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-4 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <Link to="/pptk"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[report.status]}>{STATUS_LABEL[report.status]}</Badge>
            <Badge variant="outline">{MONTHS[report.period_month - 1]} {report.period_year}</Badge>
          </div>
          <CardTitle className="font-display text-xl sm:text-2xl flex items-start gap-2 mt-2">
            <ClipboardList className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <span>{report.kegiatan}</span>
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Pelapor: {reporter?.full_name ?? "—"}{reporter?.jabatan ? ` · ${reporter.jabatan}` : ""}
            {" · "}Dibuat: {new Date(report.created_at).toLocaleString("id-ID")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-border pt-4">
          <Field label="Uraian Pelaksanaan" value={report.uraian_pelaksanaan} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Target Fisik Bulan" value={report.target_fisik_bulan} />
            <Field label="Target Realisasi Keuangan" value={report.target_realisasi_keuangan} />
            <Field label="Realisasi Fisik" value={report.realisasi_fisik} />
            <Field label="Realisasi Keuangan" value={report.realisasi_keuangan} />
            <Field label="Faktor Penghambat" value={report.kendala} />
            <Field label="Faktor Pendukung" value={report.faktor_pendukung} />
            <Field label="Tindak Lanjut" value={report.tindak_lanjut} />
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
                    <Button size="sm" variant="ghost" onClick={() => downloadAtt(a)}><Download className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(report.sekretaris_at || report.kepala_at) && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs space-y-2">
              {report.sekretaris_at && (
                <div>
                  <b>Sekretaris</b> · {new Date(report.sekretaris_at).toLocaleString("id-ID")}
                  {report.sekretaris_notes && <div className="text-muted-foreground mt-0.5">{report.sekretaris_notes}</div>}
                </div>
              )}
              {report.kepala_at && (
                <div>
                  <b>Kepala BRIDA</b> · {new Date(report.kepala_at).toLocaleString("id-ID")}
                  {report.kepala_notes && <div className="text-muted-foreground mt-0.5">{report.kepala_notes}</div>}
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {report.status === "submitted" && isSekretaris && (
              <Button size="sm" onClick={() => { setActionKind("review"); setNote(""); }}>
                <Check className="h-4 w-4" /> Teruskan ke Kepala
              </Button>
            )}
            {report.status === "reviewed" && isKepala && (
              <>
                <Button size="sm" onClick={() => { setActionKind("approve"); setNote(""); }}><Check className="h-4 w-4" /> Setujui</Button>
                <Button size="sm" variant="destructive" onClick={() => { setActionKind("reject"); setNote(""); }}><XCircle className="h-4 w-4" /> Tolak</Button>
              </>
            )}
          </div>

          {actionKind && (
            <div className="rounded-md border border-border p-3 space-y-2">
              <Label className="text-xs">Catatan {actionKind === "review" ? "Sekretaris" : "Kepala"} (opsional)</Label>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setActionKind(null); setNote(""); }}>Batal</Button>
                <Button size="sm" onClick={submitAction}>Simpan</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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
