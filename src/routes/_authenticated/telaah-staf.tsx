import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, X, Paperclip, Download, Trash2, FileIcon,
  ChevronDown, ChevronUp, FileText, Send, History, Eye,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Jenjang } from "@/lib/auth";
import { sendTelegramNotification } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/telaah-staf")({
  component: TelaahStafPage,
});

type Category = "perencanaan" | "keuangan" | "kepegawaian";
type ReviewStatus = "draft" | "submitted" | "reviewed" | "approved" | "rejected";

const CATEGORY_LABEL: Record<Category, string> = {
  perencanaan: "Perencanaan",
  keuangan: "Keuangan",
  kepegawaian: "Kepegawaian",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: "Draf",
  submitted: "Terkirim",
  reviewed: "Ditelaah",
  approved: "Disetujui",
  rejected: "Ditolak",
};

const STATUS_VARIANT: Record<ReviewStatus, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  submitted: "secondary",
  reviewed: "default",
  approved: "default",
  rejected: "destructive",
};

const REVIEW_SECTIONS = [
  { key: "pokok_persoalan" as const, label: "Pokok Persoalan", placeholder: "Inti persoalan yang akan ditelaah", rows: 3, maxLength: 3000 },
  { key: "pra_anggapan" as const, label: "Pra Anggapan", placeholder: "Dugaan/anggapan dasar sebelum analisis", rows: 3, maxLength: 3000 },
  { key: "fakta_data" as const, label: "Fakta dan Data yang Berpengaruh Terhadap Persoalan", placeholder: "Uraikan fakta, data, regulasi, atau kondisi yang relevan", rows: 5, maxLength: 6000 },
  { key: "pembahasan" as const, label: "Pembahasan / Analisis", placeholder: "Analisis persoalan berdasarkan fakta dan pra anggapan", rows: 6, maxLength: 8000 },
  { key: "kesimpulan" as const, label: "Kesimpulan", placeholder: "", rows: 3, maxLength: 3000 },
];

interface ProfileLite {
  id: string;
  full_name: string;
  jabatan: string | null;
  jenjang: Jenjang;
  telegram_chat_id: string | null;
}

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

interface Attachment {
  id: string;
  review_id: string;
  uploaded_by: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string | null;
}

interface HistoryEntry {
  id: string;
  review_id: string;
  changed_by: string | null;
  from_status: ReviewStatus | null;
  to_status: ReviewStatus;
  notes: string | null;
  created_at: string;
}

const ATASAN_JENJANG: Record<Jenjang, Jenjang[]> = {
  staf: ["eselon_iv", "eselon_iii"],
  pokja: ["eselon_iii"],
  jafung: ["eselon_iii", "eselon_ii"],
  eselon_iv: ["eselon_iii"],
  eselon_iii: ["eselon_ii"],
  eselon_ii: ["eselon_ii"],
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function TelaahStafPage() {
  const { user, profile, hasRole } = useAuth();
  const notify = useServerFn(sendTelegramNotification);

  const [reviews, setReviews] = useState<StaffReview[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [attachments, setAttachments] = useState<Record<string, Attachment[]>>({});
  const [history, setHistory] = useState<Record<string, HistoryEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showForm, setShowForm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Form state — format baku 6 bagian
  const [category, setCategory] = useState<Category>("perencanaan");
  const [judul, setJudul] = useState("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [pokokPersoalan, setPokokPersoalan] = useState("");
  const [praAnggapan, setPraAnggapan] = useState("");
  const [faktaData, setFaktaData] = useState("");
  const [pembahasan, setPembahasan] = useState("");
  const [kesimpulan, setKesimpulan] = useState("");
  const [saran, setSaran] = useState<string[]>([""]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sectionStateMap = {
    pokok_persoalan: [pokokPersoalan, setPokokPersoalan] as const,
    pra_anggapan: [praAnggapan, setPraAnggapan] as const,
    fakta_data: [faktaData, setFaktaData] as const,
    pembahasan: [pembahasan, setPembahasan] as const,
    kesimpulan: [kesimpulan, setKesimpulan] as const,
  };

  // Filter
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [filterScope, setFilterScope] = useState<"all" | "mine" | "incoming">("all");

  const profMap = useMemo(() => {
    const m: Record<string, ProfileLite> = {};
    profiles.forEach((p) => (m[p.id] = p));
    return m;
  }, [profiles]);

  const suggestedRecipient = useMemo(() => {
    if (!profile) return "";
    const targets = ATASAN_JENJANG[profile.jenjang] ?? [];
    for (const j of targets) {
      const found = profiles.find((p) => p.jenjang === j && p.id !== profile.id);
      if (found) return found.id;
    }
    return "";
  }, [profile, profiles]);

  useEffect(() => {
    if (suggestedRecipient && !recipientId) setRecipientId(suggestedRecipient);
  }, [suggestedRecipient, recipientId]);

  const load = async () => {
    setLoading(true);
    const [{ data: rev }, { data: profs }] = await Promise.all([
      supabase.from("staff_reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, jabatan, jenjang, telegram_chat_id"),
    ]);
    const rows = ((rev ?? []) as unknown as StaffReview[]).map((r) => ({
      ...r,
      saran: Array.isArray(r.saran) ? r.saran : [],
    }));
    setReviews(rows);
    setProfiles((profs ?? []) as ProfileLite[]);

    if (rows.length > 0) {
      const ids = rows.map((r) => r.id);
      const [{ data: atts }, { data: hist }] = await Promise.all([
        supabase.from("staff_review_attachments").select("*").in("review_id", ids),
        supabase
          .from("staff_review_history")
          .select("*")
          .in("review_id", ids)
          .order("created_at", { ascending: true }),
      ]);
      const grouped: Record<string, Attachment[]> = {};
      ((atts ?? []) as Attachment[]).forEach((a) => {
        (grouped[a.review_id] ??= []).push(a);
      });
      setAttachments(grouped);

      const groupedHist: Record<string, HistoryEntry[]> = {};
      ((hist ?? []) as unknown as HistoryEntry[]).forEach((h) => {
        (groupedHist[h.review_id] ??= []).push(h);
      });
      setHistory(groupedHist);
    } else { setAttachments({}); setHistory({}); }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const tooBig = arr.find((f) => f.size > 20 * 1024 * 1024);
    if (tooBig) return toast.error(`File "${tooBig.name}" melebihi 20 MB`);
    setPendingFiles((prev) => [...prev, ...arr]);
  };

  const uploadFiles = async (reviewId: string) => {
    for (const f of pendingFiles) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${user!.id}/telaah/${reviewId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, f, { contentType: f.type || "application/octet-stream", upsert: false });
      if (upErr) { toast.error(`Gagal mengunggah ${f.name}: ${upErr.message}`); continue; }
      await supabase.from("staff_review_attachments").insert({
        review_id: reviewId,
        uploaded_by: user!.id,
        file_path: path,
        file_name: f.name,
        file_size: f.size,
        mime_type: f.type || null,
      });
    }
  };

  const resetForm = () => {
    setJudul("");
    REVIEW_SECTIONS.forEach((s) => sectionStateMap[s.key][1](""));
    setSaran([""]);
    setPendingFiles([]);
    setRecipientId(suggestedRecipient);
  };

  const cleanArr = (a: string[]) => a.map((s) => s.trim()).filter(Boolean);

  function validateForm(): { ok: true } | { ok: false; message: string } {
    if (!recipientId) return { ok: false, message: "Pilih tujuan telaah (atasan)" };
    if (judul.trim().length < 3) return { ok: false, message: "Judul minimal 3 karakter" };
    for (const sec of REVIEW_SECTIONS) {
      const [val] = sectionStateMap[sec.key];
      if (val.trim().length < 5) return { ok: false, message: `${sec.label} wajib diisi` };
    }
    const cleanSaran = cleanArr(saran);
    if (cleanSaran.length === 0) return { ok: false, message: "Tambahkan minimal 1 saran" };
    return { ok: true };
  }

  const openPreview = () => {
    const v = validateForm();
    if (!v.ok) { toast.error(v.message); return; }
    setShowPreview(true);
  };

  const doSubmit = async () => {
    const cleanSaran = cleanArr(saran);
    setBusy(true);
    const insertPayload: Record<string, unknown> = {
      reporter_id: user!.id,
      recipient_id: recipientId,
      category,
      judul: judul.trim(),
      status: "submitted" as ReviewStatus,
      saran: cleanSaran,
    };
    for (const sec of REVIEW_SECTIONS) {
      const [val] = sectionStateMap[sec.key];
      insertPayload[sec.key] = val.trim();
    }
    const { data, error } = await supabase
      .from("staff_reviews")
      .insert(insertPayload as any)
      .select("id")
      .single();

    if (error || !data) { setBusy(false); return toast.error(error?.message ?? "Gagal menyimpan"); }
    if (pendingFiles.length > 0) await uploadFiles(data.id);

    await supabase.from("activity_log").insert({
      user_id: user!.id,
      action: "create_staff_review",
      entity_type: "staff_review",
      entity_id: data.id,
      details: { category, recipient_id: recipientId },
    });

    const recipient = profMap[recipientId];
    if (recipient?.telegram_chat_id) {
      const msg =
        `<b>📋 Telaah Staf Baru</b>\n` +
        `Kategori: <b>${CATEGORY_LABEL[category]}</b>\n` +
        `Pelapor: ${profile?.full_name ?? "—"}\n` +
        `Judul: <b>${judul.trim()}</b>\n\n` +
        `Pokok Persoalan: ${pokokPersoalan.trim().slice(0, 500)}`;
      notify({ data: { userIds: [recipientId], message: msg } }).catch((e) =>
        console.error("notify error", e),
      );
    }

    setBusy(false);
    toast.success("Telaah staf terkirim");
    resetForm();
    setShowForm(false);
    setShowPreview(false);
    load();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const v = validateForm();
    if (!v.ok) return toast.error(v.message);
    await doSubmit();
  };

  const updateStatus = async (r: StaffReview, status: ReviewStatus, notes?: string): Promise<void> => {
    const { error } = await supabase
      .from("staff_reviews")
      .update({
        status,
        disposisi_notes: notes ?? r.disposisi_notes,
        disposisi_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) { toast.error(error.message); return; }

    toast.success("Disposisi diperbarui");
    const reporter = profMap[r.reporter_id];
    if (reporter?.telegram_chat_id) {
      const msg =
        `<b>📝 Disposisi Telaah</b>\n` +
        `Telaah: <b>${r.judul}</b>\n` +
        `Status: <b>${STATUS_LABEL[status]}</b>\n` +
        (notes ? `Catatan: ${notes.slice(0, 600)}` : "");
      notify({ data: { userIds: [r.reporter_id], message: msg } }).catch(() => {});
    }
    load();
  };

  const deleteReview = async (r: StaffReview) => {
    if (!confirm("Hapus telaah ini? Semua lampiran ikut terhapus.")) return;
    const atts = attachments[r.id] ?? [];
    const { error } = await supabase.from("staff_reviews").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    if (atts.length > 0) await supabase.storage.from("documents").remove(atts.map((a) => a.file_path));
    toast.success("Telaah dihapus");
    load();
  };

  const downloadAtt = async (att: Attachment) => {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(att.file_path, 60);
    if (error || !data) return toast.error(error?.message ?? "Gagal membuat tautan");
    window.open(data.signedUrl, "_blank");
  };

  const filtered = reviews.filter((r) => {
    if (filterCategory !== "all" && r.category !== filterCategory) return false;
    if (filterScope === "mine" && r.reporter_id !== user?.id) return false;
    if (filterScope === "incoming" && r.recipient_id !== user?.id) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6 px-4 sm:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 sm:h-7 sm:w-7 text-primary flex-shrink-0" />
            <span className="truncate">Telaah Staf</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Format baku: Pokok Persoalan · Pra Anggapan · Fakta & Data · Pembahasan · Kesimpulan · Saran.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)} size="sm" className="shrink-0">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Tutup" : "Telaah baru"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader className="pb-3 px-4 sm:px-6">
            <CardTitle className="text-base sm:text-lg">Formulir Telaah Staf</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={submit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Kategori *</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                    <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs sm:text-sm">Ditujukan kepada *</Label>
                  <Select value={recipientId} onValueChange={setRecipientId}>
                    <SelectTrigger className="h-9 sm:h-10 text-sm"><SelectValue placeholder="Pilih atasan" /></SelectTrigger>
                    <SelectContent>
                      {profiles
                        .filter((p) => p.id !== user?.id)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}{p.jabatan ? ` — ${p.jabatan}` : ""}
                            {p.id === suggestedRecipient ? " (disarankan)" : ""}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Judul *</Label>
                <Input value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={300} placeholder="Telaah Staf tentang ..." className="h-9 sm:h-10 text-sm" />
              </div>

              {REVIEW_SECTIONS.map((sec, i) => {
                const [val, setVal] = sectionStateMap[sec.key];
                return (
                  <div key={sec.key} className="space-y-2">
                    <Label className="text-xs sm:text-sm">{i + 1}. {sec.label} *</Label>
                    <Textarea
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      rows={Math.max(2, sec.rows - 1)}
                      maxLength={sec.maxLength}
                      placeholder={sec.placeholder}
                      className="text-base sm:text-sm min-h-[80px]"
                    />
                  </div>
                );
              })}

              <ArrayField label={`${REVIEW_SECTIONS.length + 1}. Saran *`} items={saran} setItems={setSaran} placeholder="Saran ke-" />

              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Lampiran pendukung</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
                  <Button type="button" variant="outline" size="sm" className="h-9 text-xs sm:text-sm" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-4 w-4" /> Tambah file
                  </Button>
                  <span className="text-[11px] sm:text-xs text-muted-foreground">Maks 20 MB per file</span>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {pendingFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs sm:text-sm rounded-md border border-border bg-muted/40 px-3 py-1.5">
                        <span className="truncate flex items-center gap-2 min-w-0">
                          <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                          <span className="text-muted-foreground hidden sm:inline">({fmtBytes(f.size)})</span>
                        </span>
                        <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive flex-shrink-0 ml-2">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { resetForm(); setShowForm(false); }} className="h-9 text-xs sm:text-sm">Batal</Button>
                <Button type="button" variant="outline" onClick={openPreview} className="h-9 text-xs sm:text-sm">
                  <Eye className="h-4 w-4" /> Pratinjau
                </Button>
                <Button type="submit" disabled={busy} className="h-9 text-xs sm:text-sm">
                  <Send className="h-4 w-4" />
                  {busy ? "Menyimpan..." : "Kirim telaah"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Eye className="h-5 w-5 text-primary flex-shrink-0" /> Pratinjau Telaah Staf
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 sm:space-y-5">
            <SectionJumpNav
              prefix="preview"
              labels={[...REVIEW_SECTIONS.map((s) => s.label), "Saran"]}
            />
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
              <Badge variant="secondary" className="text-[10px] sm:text-xs">{CATEGORY_LABEL[category]}</Badge>
              <span className="text-muted-foreground">→</span>
              <span className="font-medium">{profMap[recipientId]?.full_name ?? "—"}</span>
            </div>
            <h2 className="font-display text-lg sm:text-xl font-semibold break-words">{judul.trim() || "(Judul kosong)"}</h2>

            {REVIEW_SECTIONS.map((sec, i) => (
              <div key={sec.key} id={`preview-sec-${i + 1}`} className="scroll-mt-20">
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                  {i + 1}. {sec.label}
                </div>
                <p className="text-xs sm:text-sm whitespace-pre-wrap text-foreground/90">
                  {(sectionStateMap[sec.key][0] as string).trim() || <span className="italic text-muted-foreground">(kosong)</span>}
                </p>
              </div>
            ))}

            <div id={`preview-sec-${REVIEW_SECTIONS.length + 1}`} className="scroll-mt-20">
              <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                {REVIEW_SECTIONS.length + 1}. Saran
              </div>
              {cleanArr(saran).length > 0 ? (
                <ol className="list-decimal list-inside text-xs sm:text-sm space-y-1 text-foreground/90">
                  {cleanArr(saran).map((it, i) => <li key={i} className="whitespace-pre-wrap">{it}</li>)}
                </ol>
              ) : (
                <p className="text-xs sm:text-sm italic text-muted-foreground">(kosong)</p>
              )}
            </div>

            {pendingFiles.length > 0 && (
              <div>
                <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Lampiran</div>
                <ul className="space-y-1">
                  {pendingFiles.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs sm:text-sm rounded-md border border-border bg-muted/40 px-3 py-1.5">
                      <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted-foreground hidden sm:inline">({fmtBytes(f.size)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2 border-t border-border">
              <Button variant="ghost" onClick={() => setShowPreview(false)} className="h-9 text-xs sm:text-sm">Kembali ke form</Button>
              <Button
                onClick={async () => {
                  setShowPreview(false);
                  await doSubmit();
                }}
                disabled={busy}
                className="h-9 text-xs sm:text-sm"
              >
                <Send className="h-4 w-4" />
                {busy ? "Menyimpan..." : "Kirim telaah"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-[10px] sm:text-xs">Kategori</Label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as Category | "all")}>
            <SelectTrigger className="h-8 w-[150px] sm:w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-[10px] sm:text-xs">Lingkup</Label>
          <Select value={filterScope} onValueChange={(v) => setFilterScope(v as typeof filterScope)}>
            <SelectTrigger className="h-8 w-[140px] sm:w-[180px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="mine">Telaah saya</SelectItem>
              <SelectItem value="incoming">Untuk saya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-[10px] sm:text-xs text-muted-foreground ml-auto">{filtered.length} telaah</div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Memuat...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Belum ada telaah. Klik <b>Telaah baru</b> untuk membuat.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const isOpen = !!expanded[r.id];
            const reporter = profMap[r.reporter_id];
            const recipient = profMap[r.recipient_id];
            const atts = attachments[r.id] ?? [];
            const hist = history[r.id] ?? [];
            const canDelete = r.reporter_id === user?.id || hasRole("admin");
            const canDisposisi = r.recipient_id === user?.id;
            return (
              <Card key={r.id}>
                <CardHeader className="pb-3 px-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <Badge variant="secondary" className="text-[10px] sm:text-xs">{CATEGORY_LABEL[r.category]}</Badge>
                        <Badge variant={STATUS_VARIANT[r.status]} className="text-[10px] sm:text-xs">{STATUS_LABEL[r.status]}</Badge>
                        {atts.length > 0 && (
                          <Badge variant="outline" className="gap-1 text-[10px] sm:text-xs">
                            <Paperclip className="h-3 w-3" /> {atts.length}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-base sm:text-lg font-semibold break-words">{r.judul}</h3>
                      <div className="mt-1 text-[10px] sm:text-xs text-muted-foreground">
                        Dari <b>{reporter?.full_name ?? "—"}</b>
                        {" → "}
                        Kepada <b>{recipient?.full_name ?? "—"}</b>
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !isOpen }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteReview(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-4 sm:space-y-5 border-t border-border pt-3 sm:pt-4 px-4 sm:px-6">
                    <SectionJumpNav
                      prefix={r.id}
                      labels={[...REVIEW_SECTIONS.map((s) => s.label), "Saran"]}
                    />
                    {REVIEW_SECTIONS.map((sec, i) => (
                      <Section key={sec.key} id={`${r.id}-sec-${i + 1}`} num={i + 1} label={sec.label} text={(r as any)[sec.key] ?? ""} />
                    ))}
                    <ListSection id={`${r.id}-sec-${REVIEW_SECTIONS.length + 1}`} num={REVIEW_SECTIONS.length + 1} label="Saran" items={r.saran} />

                    {atts.length > 0 && (
                      <div>
                        <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 sm:mb-2">Lampiran</div>
                        <ul className="space-y-1">
                          {atts.map((a) => (
                            <li key={a.id} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs sm:text-sm">
                              <span className="truncate flex items-center gap-2 min-w-0">
                                <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{a.file_name}</span>
                                <span className="text-muted-foreground hidden sm:inline">({fmtBytes(a.file_size)})</span>
                              </span>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 flex-shrink-0 ml-2" onClick={() => downloadAtt(a)}>
                                <Download className="h-4 w-4" />
                              </Button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <HistoryTimeline entries={hist} profMap={profMap} />

                    {canDisposisi && (
                      <DispositionForm review={r} onSubmit={updateStatus} />
                    )}
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

function HistoryTimeline({
  entries, profMap,
}: {
  entries: HistoryEntry[];
  profMap: Record<string, ProfileLite>;
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 sm:mb-2 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5 flex-shrink-0" /> Riwayat Status & Disposisi
      </div>
      <ol className="relative border-l border-border ml-1.5 sm:ml-2 space-y-2.5 sm:space-y-3">
        {entries.map((h) => {
          const actor = h.changed_by ? profMap[h.changed_by] : null;
          const isCreate = h.from_status === null;
          return (
            <li key={h.id} className="ml-3 sm:ml-4">
              <span className="absolute -left-[5px] sm:-left-1.5 mt-1 h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                {isCreate ? (
                  <Badge variant="outline" className="text-[10px] sm:text-xs">Dibuat</Badge>
                ) : (
                  <>
                    {h.from_status && (
                      <Badge variant="outline" className="text-[10px] sm:text-xs">{STATUS_LABEL[h.from_status]}</Badge>
                    )}
                    <span className="text-[10px] sm:text-xs text-muted-foreground">→</span>
                    <Badge variant={STATUS_VARIANT[h.to_status]} className="text-[10px] sm:text-xs">{STATUS_LABEL[h.to_status]}</Badge>
                  </>
                )}
              </div>
              <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-muted-foreground">
                <b>{actor?.full_name ?? "Sistem"}</b>
                {actor?.jabatan ? ` — ${actor.jabatan}` : ""}
                {" · "}
                {new Date(h.created_at).toLocaleString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
              {h.notes && (
                <p className="mt-1 sm:mt-1.5 text-xs sm:text-sm whitespace-pre-wrap rounded-md bg-muted/40 border border-border px-2.5 sm:px-3 py-1.5 sm:py-2">
                  {h.notes}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ArrayField({
  label, items, setItems, placeholder,
}: {
  label: string; items: string[]; setItems: (v: string[]) => void; placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs sm:text-sm">{label}</Label>
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              setItems(next);
            }}
            placeholder={`${placeholder}${i + 1}`}
            maxLength={1000}
            className="h-9 sm:h-10 text-sm"
          />
          {items.length > 1 && (
            <Button type="button" variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs sm:text-sm" onClick={() => setItems([...items, ""])}>
        <Plus className="h-4 w-4" /> Tambah
      </Button>
    </div>
  );
}

function Section({ num, label, text, id }: { num: number; label: string; text: string; id?: string }) {
  return (
    <div id={id} className="scroll-mt-20">
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
        {num}. {label}
      </div>
      <p className="text-xs sm:text-sm whitespace-pre-wrap text-foreground/90">
        {text.trim() || <span className="italic text-muted-foreground">(kosong)</span>}
      </p>
    </div>
  );
}

function ListSection({ num, label, items, id }: { num: number; label: string; items: string[]; id?: string }) {
  const clean = items.map((s) => s.trim()).filter(Boolean);
  return (
    <div id={id} className="scroll-mt-20">
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
        {num}. {label}
      </div>
      {clean.length > 0 ? (
        <ol className="list-decimal list-inside text-xs sm:text-sm space-y-0.5 sm:space-y-1 text-foreground/90">
          {clean.map((it, i) => <li key={i} className="whitespace-pre-wrap">{it}</li>)}
        </ol>
      ) : (
        <p className="text-xs sm:text-sm italic text-muted-foreground">(kosong)</p>
      )}
    </div>
  );
}

function SectionJumpNav({ prefix, labels }: { prefix: string; labels: string[] }) {
  const jump = (num: number) => {
    const el = document.getElementById(`${prefix}-sec-${num}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="sticky top-0 z-10 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1 shrink-0">Lompat ke:</span>
        {labels.map((lbl, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jump(i + 1)}
            title={`${i + 1}. ${lbl}`}
            aria-label={`Lompat ke bagian ${i + 1}: ${lbl}`}
            className="shrink-0 inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-full border border-border bg-muted/40 text-[11px] font-semibold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

function DispositionForm({
  review, onSubmit,
}: {
  review: StaffReview;
  onSubmit: (r: StaffReview, status: ReviewStatus, notes?: string) => Promise<void>;
}) {
  const [notes, setNotes] = useState(review.disposisi_notes ?? "");
  const [status, setStatus] = useState<ReviewStatus>(review.status);
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-3 space-y-3">
      <div className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground">Beri disposisi</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
          <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="reviewed">Ditelaah</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          className="sm:col-span-2 text-base sm:text-sm min-h-[72px]"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan disposisi..."
          rows={2}
          maxLength={2000}
        />
      </div>
      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={busy}
          className="h-8 text-xs sm:text-sm"
          onClick={async () => {
            setBusy(true);
            await onSubmit(review, status, notes.trim() || undefined);
            setBusy(false);
          }}
        >
          Simpan disposisi
        </Button>
      </div>
    </div>
  );
}
