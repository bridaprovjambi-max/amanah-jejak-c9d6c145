import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Send, MessageCircle, Copy, Check, UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JABATAN_PRESETS } from "@/lib/jabatan-presets";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramNotification } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

type ProfileExtra = {
  telegram_chat_id?: string | null;
  nip?: string | null;
  pangkat_golongan?: string | null;
  jabatan?: string | null;
};

function SettingsPage() {
  const { user, profile, refresh } = useAuth();
  const [chatId, setChatId] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const sendNotif = useServerFn(sendTelegramNotification);

  // Profil kepegawaian
  const [fullName, setFullName] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [nip, setNip] = useState("");
  const [pangkat, setPangkat] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const p = profile as unknown as ProfileExtra | null;
    setChatId(p?.telegram_chat_id ?? "");
    setFullName(profile?.full_name ?? "");
    setJabatan(p?.jabatan ?? "");
    setNip(p?.nip ?? "");
    setPangkat(p?.pangkat_golongan ?? "");
  }, [profile]);

  const saveProfile = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      return toast.error("Nama lengkap minimal 2 karakter");
    }
    if (nip && !/^[0-9]+$/.test(nip.trim())) {
      return toast.error("NIP hanya boleh berisi angka");
    }
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        jabatan: jabatan.trim() || null,
        nip: nip.trim() || null,
        pangkat_golongan: pangkat.trim() || null,
      })
      .eq("id", user!.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profil disimpan");
    refresh();
  };


  const save = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ telegram_chat_id: chatId.trim() || null })
      .eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Pengaturan Telegram disimpan");
    refresh();
  };

  const testSend = async () => {
    if (!chatId.trim()) return toast.error("Isi & simpan Chat ID dulu");
    try {
      const res = await sendNotif({
        data: {
          userIds: [user!.id],
          message: `<b>DeLapan</b>\nHalo ${profile?.full_name ?? "pengguna"}! Notifikasi Telegram Anda aktif.`,
        },
      });
      if (res.sent > 0) toast.success("Pesan uji terkirim — cek Telegram Anda");
      else if (res.reason === "connector_missing")
        toast.error("Bot Telegram belum disetel admin. Hubungi administrator.");
      else toast.error("Pesan tidak terkirim. Pastikan Chat ID benar & bot sudah Anda /start.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengirim");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText("/start");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Pengaturan Akun</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kelola informasi kepegawaian dan notifikasi Anda.
        </p>
      </div>

      {/* Profil Kepegawaian */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
            <UserCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Informasi Kepegawaian</h2>
            <p className="text-sm text-muted-foreground">
              Data ini ditampilkan di profil dan daftar pengguna BRIDA.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="full_name">Nama Lengkap *</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nip">NIP</Label>
            <Input
              id="nip"
              inputMode="numeric"
              placeholder="contoh: 198501012010012001"
              value={nip}
              onChange={(e) => setNip(e.target.value.replace(/\D/g, ""))}
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pangkat">Pangkat / Golongan</Label>
            <Input
              id="pangkat"
              placeholder="contoh: Penata Tk. I / III-d"
              value={pangkat}
              onChange={(e) => setPangkat(e.target.value)}
              maxLength={80}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="jabatan">Jabatan</Label>
            <Input
              id="jabatan"
              placeholder="contoh: Kasubbag Umum & Kepegawaian"
              value={jabatan}
              onChange={(e) => setJabatan(e.target.value)}
              maxLength={160}
            />
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "Menyimpan…" : "Simpan Profil"}
          </Button>
        </div>
      </div>


      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display font-semibold">Hubungkan Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Ikuti 3 langkah berikut agar notifikasi tugas masuk ke Telegram Anda.
            </p>
          </div>
        </div>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">1</span>
            <div>
              Buka Telegram, cari bot <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="font-mono px-1.5 py-0.5 bg-muted rounded hover:bg-muted/70">@userinfobot</a>.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">2</span>
            <div className="flex-1">
              Kirim perintah{" "}
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded font-mono hover:bg-muted/70"
              >
                /start {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>{" "}
              ke bot. Bot akan membalas dengan <b>Id</b> berupa angka — itulah <b>Chat ID</b> Anda.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">3</span>
            <div>
              Buka bot DeLapan BRIDA (tanya admin untuk nama bot), kirim <code className="px-1.5 py-0.5 bg-muted rounded font-mono">/start</code> agar bot bisa mengirim pesan kepada Anda.
            </div>
          </li>
          <li className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold">4</span>
            <div>Tempel Chat ID tersebut di kolom di bawah, simpan, lalu klik <b>Kirim Uji Coba</b>.</div>
          </li>
        </ol>

        <div className="space-y-1.5 pt-2">
          <Label htmlFor="chatid">Telegram Chat ID</Label>
          <Input
            id="chatid"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            placeholder="contoh: 123456789"
            inputMode="numeric"
          />
          <p className="text-xs text-muted-foreground">
            Kosongkan dan simpan untuk menonaktifkan notifikasi Telegram.
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" onClick={testSend} disabled={busy}>
            <Send className="mr-2 h-4 w-4" /> Kirim Uji Coba
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <b>Catatan:</b> Notifikasi otomatis dikirim saat Anda menerima penugasan baru,
        ketika ada laporan baru pada tugas yang Anda berikan, dan saat status tugas berubah
        menjadi <i>Selesai</i>. Pengingat tenggat dikirim H-1.
      </div>
    </div>
  );
}
