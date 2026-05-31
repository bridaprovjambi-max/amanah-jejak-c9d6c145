import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileIcon, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, JENJANG_LABEL, type Jenjang } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/wewenang/$reportId")({
  component: WewenangDetail,
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

interface Attachment {
  id: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
  uploaded_by: string;
}

const MONTHS = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function WewenangDetail() {
  const { reportId } = Route.useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<AuthorityReport | null>(null);
  const [reporter, setReporter] = useState<{ full_name: string; jabatan: string | null } | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("authority_reports").select("*").eq("id", reportId).maybeSingle();
    if (!data) { setLoading(false); return; }
    const r = data as AuthorityReport;
    setReport(r);
    const [{ data: prof }, { data: a }] = await Promise.all([
      supabase.from("profiles").select("full_name, jabatan").eq("id", r.reporter_id).maybeSingle(),
      supabase.from("authority_report_attachments").select("*").eq("report_id", reportId),
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
    const { error } = await supabase.from("authority_reports").delete().eq("id", report.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    toast.success("Laporan dihapus");
    navigate({ to: "/wewenang" });
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!report) return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/wewenang"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Laporan tidak ditemukan.</CardContent></Card>
    </div>
  );

  const canDelete = report.reporter_id === user?.id || hasRole("admin");

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-4 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <Link to="/wewenang"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">{JENJANG_LABEL[report.jenjang]}</Badge>
            <Badge variant="outline">{MONTHS[report.period_month - 1]} {report.period_year}</Badge>
          </div>
          <CardTitle className="font-display text-xl sm:text-2xl flex items-start gap-2 mt-2">
            <ShieldCheck className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <span>Laporan Wewenang</span>
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Pelapor: {reporter?.full_name ?? "—"}{reporter?.jabatan ? ` · ${reporter.jabatan}` : ""}
            {" · "}Dibuat: {new Date(report.created_at).toLocaleString("id-ID")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-border pt-4">
          <Section title="Uraian wewenang" text={report.authority_description} />
          <Section title="Ringkasan pelaksanaan" text={report.execution_summary} />
          {report.obstacles && <Section title="Kendala" text={report.obstacles} />}
          {report.follow_up_notes && <Section title="Catatan tindak lanjut" text={report.follow_up_notes} />}
          {atts.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Bukti pendukung</div>
              <ul className="space-y-1">
                {atts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm">
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
        </CardContent>
      </Card>
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
