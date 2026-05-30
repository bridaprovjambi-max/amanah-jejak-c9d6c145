import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, ShieldCheck, Lock, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import delapanLogo from "@/assets/delapan-logo.webp";

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
    <main className="min-h-dvh grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* Brand panel — institutional navy with gold accents */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-hero-navy text-white p-12 xl:p-16">
        <div className="absolute inset-0 bg-grid-soft opacity-60 pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-[oklch(0.45_0.12_250)]/30 blur-3xl pointer-events-none" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-3">
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
        </div>

        <div className="relative max-w-md">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
              Akses Terotentikasi
            </span>
          </div>
          <h2 className="font-display text-4xl xl:text-5xl font-bold leading-[1.05] text-balance">
            Akuntabilitas dimulai dari{" "}
            <span className="text-brand-gradient">pelaporan tepat waktu.</span>
          </h2>
          <div className="divider-gold mt-8 h-px w-24" />
          <p className="mt-6 text-sm leading-relaxed text-white/70">
            Sistem internal Badan Riset dan Inovasi Daerah Provinsi Jambi —
            delegasi berjenjang, pelaporan terstruktur, transparansi penuh.
          </p>
        </div>

        <div className="relative text-[10px] uppercase tracking-[0.22em] text-white/40">
          © {new Date().getFullYear()} · BRIDA Provinsi Jambi
        </div>
      </aside>

      {/* Form panel */}
      <section className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-sm">
          <Link to="/" className="lg:hidden mb-10 inline-flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-white p-0.5 ring-brand">
              <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
            </div>
            <span className="font-display text-lg font-bold text-primary">DeLapan</span>
          </Link>

          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[oklch(0.55_0.08_215)]">
            Selamat datang kembali
          </div>
          <h1 className="mt-2 font-display text-3xl lg:text-4xl font-bold text-primary leading-tight">
            Masuk ke akun Anda
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/signup" className="text-primary font-semibold hover:text-accent transition-colors underline-offset-4 hover:underline">
              Daftar di sini
            </Link>
          </p>

          <form onSubmit={onSubmit} className="mt-9 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nama@brida.jambi.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kata sandi</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 h-11"
                />
              </div>
            </div>
            <Button type="submit" className="group w-full h-11 font-semibold shadow-elegant" disabled={busy}>
              {busy ? "Memproses…" : (
                <>
                  Masuk
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-10 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
            Sistem internal · Akses terbatas
          </p>
        </div>
      </section>
    </main>
  );
}
