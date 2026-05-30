import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, UserPlus, Network, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JABATAN_PRESETS } from "@/lib/jabatan-presets";
import { PANGKAT_PRESETS } from "@/lib/pangkat-presets";
import delapanLogo from "@/assets/delapan-logo.webp";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  head: () => ({
    meta: [
      { title: "Daftar — DeLapan" },
      { name: "description", content: "Buat akun DeLapan untuk bergabung dengan ekosistem pelaporan internal BRIDA Provinsi Jambi." },
      { property: "og:title", content: "Daftar — DeLapan" },
      { property: "og:description", content: "Bergabung dengan ekosistem pelaporan internal BRIDA Jambi." },
      { property: "og:url", content: "/signup" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "/signup" }],
  }),
});

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  jabatan: z.string().trim().max(160).optional(),
  nip: z.string().trim().max(30).regex(/^[0-9]*$/, "NIP hanya boleh berisi angka").optional(),
  pangkat_golongan: z.string().trim().max(80).optional(),
  is_pptk: z.boolean().optional(),
  email: z.string().trim().email().max(255),
  password: z.string().min(8, "Minimal 8 karakter").max(72),
});

function SignupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    jabatan: "",
    nip: "",
    pangkat_golongan: "",
    is_pptk: false,
    email: "",
    password: "",
  });
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: parsed.data.full_name,
          jabatan: parsed.data.jabatan ?? "",
          nip: parsed.data.nip ?? "",
          pangkat_golongan: parsed.data.pangkat_golongan ?? "",
          is_pptk: parsed.data.is_pptk ?? false,
        },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Pendaftaran berhasil! Administrator akan menetapkan peran & jenjang Anda.");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="min-h-dvh grid lg:grid-cols-[1fr_1.1fr] bg-background">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-hero-navy text-white p-12 xl:p-16">
        <div className="absolute inset-0 bg-grid-soft opacity-60 pointer-events-none" />
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[oklch(0.45_0.12_250)]/30 blur-3xl pointer-events-none" />

        <Link to="/" className="relative inline-flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-white p-1.5 shadow-elegant">
            <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-tight">DeLapan</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-accent font-medium">
              BRIDA Jambi
            </div>
          </div>
        </Link>

        <div className="relative max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 backdrop-blur-sm">
            <UserPlus className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Pendaftaran Internal
            </span>
          </div>
          <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] text-balance">
            Bergabung dengan{" "}
            <span className="text-brand-gradient">ekosistem riset</span> daerah.
          </h2>
          <div className="divider-gold mt-8 h-px w-24" />
          <p className="mt-6 text-sm leading-relaxed text-white/70">
            Khusus pejabat dan anggota Kelompok Kerja Riset BRIDA Provinsi Jambi.
            Pastikan data jabatan sesuai SK terbaru.
          </p>

          <div className="mt-10 space-y-4">
            {[
              { icon: Network, label: "Struktur berjenjang", desc: "Eselon II → III → IV → Pokja" },
              { icon: ClipboardList, label: "Pelaporan terpadu", desc: "Penugasan, capaian, telaah staf" },
              { icon: ShieldCheck, label: "Akses terkendali", desc: "Peran ditetapkan administrator" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3 border-l-2 border-accent/40 pl-4">
                <f.icon className="mt-0.5 h-4 w-4 text-accent shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-white">{f.label}</div>
                  <div className="text-[11px] text-white/55">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[10px] uppercase tracking-[0.22em] text-white/40">
          © {new Date().getFullYear()} · BRIDA Provinsi Jambi
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-white p-0.5 ring-brand">
              <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
            </div>
            <span className="font-display text-lg font-bold text-primary">DeLapan</span>
          </Link>

          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[oklch(0.55_0.08_215)]">
            Pendaftaran Akun Baru
          </div>
          <h1 className="mt-2 font-display text-3xl lg:text-4xl font-bold text-primary leading-tight">
            Buat akun DeLapan
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-primary font-semibold hover:text-accent transition-colors underline-offset-4 hover:underline">
              Masuk di sini
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nama lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => update("full_name", e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jabatan" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jabatan</Label>
              <Select value={form.jabatan} onValueChange={(v) => update("jabatan", v)}>
                <SelectTrigger id="jabatan" className="h-11">
                  <SelectValue placeholder="Pilih jabatan" />
                </SelectTrigger>
                <SelectContent>
                  {JABATAN_PRESETS.map((j) => (
                    <SelectItem key={j} value={j}>{j}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nip" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">NIP</Label>
                <Input
                  id="nip"
                  inputMode="numeric"
                  placeholder="contoh: 19850101…"
                  value={form.nip}
                  onChange={(e) => update("nip", e.target.value.replace(/\D/g, ""))}
                  maxLength={30}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pangkat_golongan" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pangkat / Golongan</Label>
                <Select value={form.pangkat_golongan} onValueChange={(v) => update("pangkat_golongan", v)}>
                  <SelectTrigger id="pangkat_golongan" className="h-11">
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {PANGKAT_PRESETS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-border bg-accent/5 p-3.5 cursor-pointer transition-colors hover:bg-accent/10 hover:border-accent/30">
              <Checkbox
                checked={form.is_pptk}
                onCheckedChange={(v) => update("is_pptk", v === true)}
                className="mt-0.5"
              />
              <span className="text-xs leading-snug text-foreground/80">
                Saya juga menjabat sebagai{" "}
                <b className="text-primary">Pejabat Pelaksana Teknis Kegiatan (PPTK)</b>.
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kata sandi</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => update("password", e.target.value)}
                  required
                  className="h-11"
                />
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              Jenjang & peran sistem akan ditetapkan oleh administrator setelah akun terverifikasi.
            </div>

            <Button type="submit" className="group w-full h-11 font-semibold shadow-elegant" disabled={busy}>
              {busy ? "Mendaftarkan…" : (
                <>
                  Daftar sekarang
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
