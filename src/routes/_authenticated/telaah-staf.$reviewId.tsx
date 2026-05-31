import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileIcon, Trash2, FileText, History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Jenjang } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/telaah-staf/$reviewId")({
  component: TelaahDetail,
});

type Category = "perencanaan" | "keuangan" | "kepegawaian";
type ReviewStatus = "draft" | "submitted" | "reviewed" | "approved" | "rejected";

const CATEGORY_LABEL: Record<Category, string> = {
  perencanaan: "Perencanaan", keuangan: "Keuangan", kepegawaian: "Kepegawaian",
};
const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draf", submitted: "Terkirim", reviewed: "Ditelaah", approved: "Disetujui", rejected: "Ditolak",
};
const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline", submitted: "secondary", reviewed: "default", approved: "default", rejected: "destructive",
};

interface StaffReview {
  id: string;
  reporter_id: string;
  recipient_id: string;
  category: Category;
  judul: string;
  pokok_persoalan: string;
  pra_anggapan: string;
  fakta_data: string;
  pembahasan: string;
  kesimpulan: string;
  saran: string[];
  status: ReviewStatus;
  disposisi_notes: string | null;
  disposisi_at: string | null;
  created_at: string;
}

interface Profile { id: string; full_name: string; jabatan: string | null; jenjang: Jenjang }
interface Attachment { id: string; file_path: string; file_name: string; file_size: number; mime_type: string | null }
interface HistoryEntry { id: string; from_status: ReviewStatus | null; to_status: ReviewStatus; notes: string | null; created_at: string; changed_by: string | null }

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function TelaahDetail() {
  const { reviewId } = Route.useParams();
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [review, setReview] = useState<StaffReview | null>(null);
  const [reporter, setReporter] = useState<Profile | null>(null);
  const [recipient, setRecipient] = useState<Profile | null>(null);
  const [atts, setAtts] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("staff_reviews").select("*").eq("id", reviewId).maybeSingle();
    if (!data) { setLoading(false); return; }
    const r = { ...data, saran: Array.isArray((data as { saran?: unknown }).saran) ? (data as { saran: string[] }).saran : [] } as StaffReview;
    setReview(r);
    const [{ data: profs }, { data: a }, { data: h }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, jabatan, jenjang").in("id", [r.reporter_id, r.recipient_id]),
      supabase.from("staff_review_attachments").select("*").eq("review_id", reviewId),
      supabase.from("staff_review_history").select("*").eq("review_id", reviewId).order("created_at", { ascending: true }),
    ]);
    const pMap = new Map<string, Profile>();
    (profs ?? []).forEach((p) => pMap.set((p as Profile).id, p as Profile));
    setReporter(pMap.get(r.reporter_id) ?? null);
    setRecipient(pMap.get(r.recipient_id) ?? null);
    setAtts((a ?? []) as Attachment[]);
    setHistory((h ?? []) as unknown as HistoryEntry[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, [reviewId]);

  const downloadAtt = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Gagal");
    window.open(data.signedUrl, "_blank");
  };

  const remove = async () => {
    if (!review || !confirm("Hapus telaah ini?")) return;
    const { error } = await supabase.from("staff_reviews").delete().eq("id", review.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    toast.success("Telaah dihapus");
    navigate({ to: "/telaah-staf" });
  };

  if (loading) return <div className="max-w-4xl mx-auto p-6 text-sm text-muted-foreground">Memuat...</div>;
  if (!review) return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Link to="/telaah-staf"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
      <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Telaah tidak ditemukan.</CardContent></Card>
    </div>
  );

  const canDelete = review.reporter_id === user?.id || hasRole("admin");

  return (
    <div className="max-w-4xl mx-auto space-y-5 px-4 sm:px-0">
      <div className="flex items-center justify-between gap-2">
        <Link to="/telaah-staf"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4" /> Kembali</Button></Link>
        {canDelete && (
          <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[review.status]}>{STATUS_LABEL[review.status]}</Badge>
            <Badge variant="outline">{CATEGORY_LABEL[review.category]}</Badge>
          </div>
          <CardTitle className="font-display text-xl sm:text-2xl flex items-start gap-2 mt-2">
            <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
            <span>{review.judul}</span>
          </CardTitle>
          <div className="text-xs text-muted-foreground">
            Dari: {reporter?.full_name ?? "—"}{reporter?.jabatan ? ` · ${reporter.jabatan}` : ""}
            <br />Kepada: {recipient?.full_name ?? "—"}{recipient?.jabatan ? ` · ${recipient.jabatan}` : ""}
            <br />Dibuat: {new Date(review.created_at).toLocaleString("id-ID")}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 border-t border-border pt-4">
          <Section title="1. Pokok Persoalan" text={review.pokok_persoalan} />
          <Section title="2. Pra Anggapan" text={review.pra_anggapan} />
          <Section title="3. Fakta dan Data" text={review.fakta_data} />
          <Section title="4. Pembahasan / Analisis" text={review.pembahasan} />
          <Section title="5. Kesimpulan" text={review.kesimpulan} />
          {review.saran.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">6. Saran</div>
              <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground/90">
                {review.saran.map((s, i) => <li key={i} className="whitespace-pre-wrap">{s}</li>)}
              </ol>
            </div>
          )}

          {atts.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Lampiran</div>
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

          {review.disposisi_notes && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-xs">
              <b>Catatan disposisi</b>
              {review.disposisi_at && <span className="text-muted-foreground"> · {new Date(review.disposisi_at).toLocaleString("id-ID")}</span>}
              <div className="mt-1 whitespace-pre-wrap text-foreground/90">{review.disposisi_notes}</div>
            </div>
          )}

          {history.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <History className="h-3 w-3" /> Riwayat
              </div>
              <ul className="space-y-1 text-xs">
                {history.map((h) => (
                  <li key={h.id} className="rounded-md border border-border bg-muted/30 px-3 py-1.5">
                    <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("id-ID")}</span>
                    {" · "}
                    {h.from_status ? STATUS_LABEL[h.from_status] : "—"} → <b>{STATUS_LABEL[h.to_status]}</b>
                    {h.notes && <div className="text-foreground/80 mt-0.5 whitespace-pre-wrap">{h.notes}</div>}
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
