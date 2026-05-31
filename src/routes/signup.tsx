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

function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 text-5xl" : "h-12 w-12 text-2xl";
  return (
    <div className={`relative grid ${dim} place-items-center rounded-2xl bg-gold-gradient font-display font-bold text-white glow-gold animate-pulse-glow`}>
      <span className="drop-shadow-[0_2px_8px_oklch(0.2_0.1_280/0.6)]">8</span>
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/30" />
    </div>
  );
}

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

  const inputCls = "h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20";

  return (
    <main className="relative min-h-dvh grid lg:grid-cols-[1fr_1.1fr] overflow-hidden bg-cosmos text-white">
      <div className="pointer-events-none absolute inset-0 bg-grid-cosmos opacity-70" />
      <div className="pointer-events-none absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.24_290/0.35)] blur-3xl animate-float-orb" />
      <div className="pointer-events-none absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.65_0.25_25/0.25)] blur-3xl animate-float-orb" style={{ animationDelay: "1.5s" }} />

      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16">
        <Link to="/" className="relative inline-flex items-center gap-3 animate-fade-in-up">
          <BrandMark />
          <div className="leading-tight">
            <div className="font-display text-xl font-bold tracking-tight text-white">DeLapan</div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-white/60 font-medium">
              Delegasi & Pelaporan
            </div>
          </div>
        </Link>

        <div className="relative max-w-md animate-slide-up" style={{ animationDelay: "0.15s" }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 backdrop-blur-sm">
            <UserPlus className="h-3.5 w-3.5 text-[oklch(0.82_0.12_80)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
              Pendaftaran Internal
            </span>
          </div>
          <h2 className="mt-6 font-display text-4xl xl:text-6xl font-bold leading-[1.02] text-balance">
            Bergabung dengan{" "}
            <span className="text-gold-gradient">ekosistem riset</span> daerah.
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-white/65 max-w-sm">
            Khusus pejabat dan anggota Kelompok Kerja Riset BRIDA Provinsi Jambi.
            Pastikan data jabatan sesuai SK terbaru.
          </p>

          <div className="mt-10 space-y-4 stagger">
            {[
              { icon: Network, label: "Struktur berjenjang", desc: "Eselon II → III → IV → Pokja" },
              { icon: ClipboardList, label: "Pelaporan terpadu", desc: "Penugasan, capaian, telaah staf" },
              { icon: ShieldCheck, label: "Akses terkendali", desc: "Peran ditetapkan administrator" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold-gradient/90 text-white">
                  <f.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">{f.label}</div>
                  <div className="text-[11px] text-white/55">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[10px] uppercase tracking-[0.22em] text-white/35">
          © {new Date().getFullYear()} · BRIDA Provinsi Jambi
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md panel-glass rounded-3xl p-8 sm:p-10 animate-slide-up">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-bold text-white">DeLapan</span>
          </Link>

          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[oklch(0.82_0.12_80)]">
            Pendaftaran Akun Baru
          </div>
          <h1 className="mt-2 font-display text-3xl lg:text-4xl font-bold text-white leading-tight">
            Buat akun DeLapan
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Sudah punya akun?{" "}
            <Link to="/login" className="text-white font-semibold underline-offset-4 hover:underline">
              Masuk di sini
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-7 space-y-5 stagger">
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Nama lengkap</Label>
              <Input id="full_name" value={form.full_name} onChange={(e) => update("full_name", e.target.value)} required className={inputCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="jabatan" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Jabatan</Label>
              <Select value={form.jabatan} onValueChange={(v) => update("jabatan", v)}>
                <SelectTrigger id="jabatan" className={inputCls}>
                  <SelectValue placeholder="Pilih jabatan" />
                </SelectTrigger>
                <SelectContent>
                  {JABATAN_PRESETS.map((j) => (<SelectItem key={j} value={j}>{j}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nip" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">NIP</Label>
                <Input id="nip" inputMode="numeric" placeholder="contoh: 19850101…" value={form.nip} onChange={(e) => update("nip", e.target.value.replace(/\D/g, ""))} maxLength={30} className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pangkat_golongan" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Pangkat / Gol.</Label>
                <Select value={form.pangkat_golongan} onValueChange={(v) => update("pangkat_golongan", v)}>
                  <SelectTrigger id="pangkat_golongan" className={inputCls}>
                    <SelectValue placeholder="Pilih" />
                  </SelectTrigger>
                  <SelectContent>
                    {PANGKAT_PRESETS.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3.5 cursor-pointer transition-colors hover:bg-white/10">
              <Checkbox checked={form.is_pptk} onCheckedChange={(v) => update("is_pptk", v === true)} className="mt-0.5 border-white/30 data-[state=checked]:bg-gold-gradient data-[state=checked]:border-transparent" />
              <span className="text-xs leading-snug text-white/80">
                Saya juga menjabat sebagai{" "}
                <b className="text-white">Pejabat Pelaksana Teknis Kegiatan (PPTK)</b>.
              </span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required className={inputCls} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Kata sandi</Label>
                <Input id="password" type="password" value={form.password} onChange={(e) => update("password", e.target.value)} required className={inputCls} />
              </div>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-3 text-[11px] leading-relaxed text-white/60">
              Jenjang & peran sistem akan ditetapkan oleh administrator setelah akun terverifikasi.
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="group w-full h-11 font-semibold border-0 bg-gold-gradient text-white hover:opacity-95 animate-pulse-glow disabled:animate-none"
            >
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
