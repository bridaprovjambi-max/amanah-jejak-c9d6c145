import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, X, Paperclip, Download, Trash2, FileIcon,
  ChevronDown, ChevronUp, FileText, Send, History,
} from "lucide-react";
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!recipientId) return toast.error("Pilih tujuan telaah (atasan)");
    if (judul.trim().length < 3) return toast.error("Judul minimal 3 karakter");
    for (const sec of REVIEW_SECTIONS) {
      const [val] = sectionStateMap[sec.key];
      if (val.trim().length < 5) return toast.error(`${sec.label} wajib diisi`);
    }
    const cleanSaran = cleanArr(saran);
    if (cleanSaran.length === 0) return toast.error("Tambahkan minimal 1 saran");

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
    load();
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <FileText className="h-7 w-7 text-primary" />
            Telaah Staf
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Format baku: Pokok Persoalan · Pra Anggapan · Fakta & Data · Pembahasan · Kesimpulan · Saran.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Tutup formulir" : "Telaah baru"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Formulir Telaah Staf</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kategori *</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                        <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Ditujukan kepada *</Label>
                  <Select value={recipientId} onValueChange={setRecipientId}>
                    <SelectTrigger><SelectValue placeholder="Pilih atasan" /></SelectTrigger>
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
                <Label>Judul *</Label>
                <Input value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={300} placeholder="Telaah Staf tentang ..." />
              </div>

              {REVIEW_SECTIONS.map((sec, i) => {
                const [val, setVal] = sectionStateMap[sec.key];
                return (
                  <div key={sec.key} className="space-y-2">
                    <Label>{i + 1}. {sec.label} *</Label>
                    <Textarea
                      value={val}
                      onChange={(e) => setVal(e.target.value)}
                      rows={sec.rows}
                      maxLength={sec.maxLength}
                      placeholder={sec.placeholder}
                    />
                  </div>
                );
              })}

              <ArrayField label={`${REVIEW_SECTIONS.length + 1}. Saran *`} items={saran} setItems={setSaran} placeholder="Saran ke-" />

              <div className="space-y-2">
                <Label>Lampiran pendukung</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                  />
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
                        <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => { resetForm(); setShowForm(false); }}>Batal</Button>
                <Button type="submit" disabled={busy}>
                  <Send className="h-4 w-4" />
                  {busy ? "Menyimpan..." : "Kirim telaah"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Kategori</Label>
          <Select value={filterCategory} onValueChange={(v) => setFilterCategory(v as Category | "all")}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kategori</SelectItem>
              {(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs">Lingkup</Label>
          <Select value={filterScope} onValueChange={(v) => setFilterScope(v as typeof filterScope)}>
            <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="mine">Telaah saya</SelectItem>
              <SelectItem value="incoming">Untuk saya</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground ml-auto">{filtered.length} telaah</div>
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
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{CATEGORY_LABEL[r.category]}</Badge>
                        <Badge variant={STATUS_VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                        {atts.length > 0 && (
                          <Badge variant="outline" className="gap-1">
                            <Paperclip className="h-3 w-3" /> {atts.length}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold">{r.judul}</h3>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Dari <b>{reporter?.full_name ?? "—"}</b>
                        {" → "}
                        Kepada <b>{recipient?.full_name ?? "—"}</b>
                        {" · "}
                        {new Date(r.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setExpanded((p) => ({ ...p, [r.id]: !isOpen }))}>
                        {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteReview(r)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                {isOpen && (
                  <CardContent className="space-y-4 border-t border-border pt-4">
                    <Section title="1. Pokok Persoalan" text={r.pokok_persoalan} />
                    <Section title="2. Pra Anggapan" text={r.pra_anggapan} />
                    <Section title="3. Fakta dan Data yang Berpengaruh Terhadap Persoalan" text={r.fakta_data} />
                    <Section title="4. Pembahasan / Analisis" text={r.pembahasan} />
                    <Section title="5. Kesimpulan" text={r.kesimpulan} />
                    {r.saran.length > 0 && <ListSection title="6. Saran" items={r.saran} />}

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
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Riwayat Status & Disposisi
      </div>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {entries.map((h) => {
          const actor = h.changed_by ? profMap[h.changed_by] : null;
          const isCreate = h.from_status === null;
          return (
            <li key={h.id} className="ml-4">
              <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <div className="flex flex-wrap items-center gap-2">
                {isCreate ? (
                  <Badge variant="outline">Dibuat</Badge>
                ) : (
                  <>
                    {h.from_status && (
                      <Badge variant="outline">{STATUS_LABEL[h.from_status]}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">→</span>
                    <Badge variant={STATUS_VARIANT[h.to_status]}>{STATUS_LABEL[h.to_status]}</Badge>
                  </>
                )}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                <b>{actor?.full_name ?? "Sistem"}</b>
                {actor?.jabatan ? ` — ${actor.jabatan}` : ""}
                {" · "}
                {new Date(h.created_at).toLocaleString("id-ID", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </div>
              {h.notes && (
                <p className="mt-1.5 text-sm whitespace-pre-wrap rounded-md bg-muted/40 border border-border px-3 py-2">
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
      <Label>{label}</Label>
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
          />
          {items.length > 1 && (
            <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => setItems([...items, ""])}>
        <Plus className="h-4 w-4" /> Tambah
      </Button>
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

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      <ol className="list-decimal list-inside text-sm space-y-1 text-foreground/90">
        {items.map((it, i) => <li key={i} className="whitespace-pre-wrap">{it}</li>)}
      </ol>
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
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Beri disposisi</div>
      <div className="grid sm:grid-cols-3 gap-3">
        <Select value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="reviewed">Ditelaah</SelectItem>
            <SelectItem value="approved">Disetujui</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
          </SelectContent>
        </Select>
        <Textarea
          className="sm:col-span-2"
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
