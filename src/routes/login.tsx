import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Masuk — DeLapan" },
      { name: "description", content: "Masuk ke akun DeLapan untuk mengelola wewenang dan pelaporan internal BRIDA Jambi." },
      { property: "og:title", content: "Masuk — DeLapan" },
      { property: "og:description", content: "Akses delegasi & pelaporan internal BRIDA Jambi." },
      { property: "og:url", content: "/login" },
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "/login" }],
  }),
});

const schema = z.object({
  email: z.string().trim().email("Email tidak valid").max(255),
  password: z.string().min(6, "Minimal 6 karakter").max(72),
});

function BrandMark({ size = "md" }: { size?: "md" | "lg" }) {
  const dim = size === "lg" ? "h-20 w-20 text-5xl" : "h-12 w-12 text-2xl";
  return (
    <div className={`relative grid ${dim} place-items-center rounded-2xl bg-vivid-gradient font-display font-bold text-white glow-vivid animate-pulse-glow`}>
      <span className="drop-shadow-[0_2px_8px_oklch(0.2_0.1_280/0.6)]">8</span>
      <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-white/30" />
    </div>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Selamat datang!");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="relative min-h-dvh grid lg:grid-cols-[1.05fr_1fr] bg-cosmos text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-grid-cosmos opacity-70" />
        <div className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.24_290/0.35)] blur-3xl animate-float-orb" />
        <div className="absolute -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.65_0.25_25/0.25)] blur-3xl animate-float-orb" style={{ animationDelay: "1.5s" }} />
      </div>

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
            <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.78_0.18_35)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
              Akses Terotentikasi
            </span>
          </div>
          <h2 className="mt-6 font-display text-4xl xl:text-6xl font-bold leading-[1.02] text-balance">
            Akuntabilitas dimulai dari{" "}
            <span className="text-vivid-gradient">pelaporan tepat waktu.</span>
          </h2>
          <p className="mt-7 text-sm leading-relaxed text-white/65 max-w-sm">
            Sistem internal Badan Riset dan Inovasi Daerah Provinsi Jambi —
            delegasi berjenjang, pelaporan terstruktur, transparansi penuh.
          </p>
        </div>

        <div className="relative text-[10px] uppercase tracking-[0.22em] text-white/35 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          © {new Date().getFullYear()} · BRIDA Provinsi Jambi
        </div>
      </aside>

      {/* Form panel */}
      <section className="relative flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-sm panel-glass rounded-3xl p-8 sm:p-10 animate-slide-up">
          <Link to="/" className="lg:hidden mb-8 inline-flex items-center gap-2.5">
            <BrandMark />
            <span className="font-display text-lg font-bold text-white">DeLapan</span>
          </Link>

          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[oklch(0.78_0.18_35)]">
            Selamat datang kembali
          </div>
          <h1 className="mt-2 font-display text-3xl lg:text-4xl font-bold text-white leading-tight">
            Masuk ke akun Anda
          </h1>
          <p className="mt-3 text-sm text-white/60">
            Belum punya akun?{" "}
            <Link to="/signup" className="text-white font-semibold hover:text-vivid-gradient transition-colors underline-offset-4 hover:underline">
              Daftar di sini
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5 stagger">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@brida.jambi.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">Kata sandi</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/20"
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="group w-full h-11 font-semibold border-0 bg-vivid-gradient text-white hover:opacity-95 animate-pulse-glow disabled:animate-none"
            >
              {busy ? "Memproses…" : (
                <>
                  Masuk
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-9 text-center text-[11px] uppercase tracking-[0.18em] text-white/40">
            Sistem internal · Akses terbatas
          </p>
        </div>
      </section>
    </main>
  );
}
