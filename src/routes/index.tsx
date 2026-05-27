import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Network, ClipboardList, BarChart3, Lock, Activity, MapPin } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import bridaLogo from "@/assets/brida-logo.svg";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-primary p-1.5">
              <img src={bridaLogo} alt="Logo BRIDA" className="h-full w-full object-contain" />
            </div>
            <div className="leading-tight">
              <div className="font-display text-base font-bold text-primary tracking-tight">D'LaPin</div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                BRIDA Jambi
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login">
              <Button variant="ghost" size="sm" className="font-medium">Masuk</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="font-medium">Daftar</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero — institutional deep navy */}
      <section className="relative overflow-hidden bg-hero-navy text-white">
        <div className="absolute inset-0 bg-grid-soft opacity-60 pointer-events-none" />
        <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-20 lg:px-8 lg:pt-24 lg:pb-28">
          <div className="max-w-3xl">
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 backdrop-blur-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" />
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
                Internal BRIDA · Akses Terkendali
              </span>
            </div>

            <h1 className="text-balance font-display text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-6xl">
              D'LaPin: Delegasi dan Pelaporan{" "}
              <span className="text-accent">Internal BRIDA</span> Provinsi Jambi
            </h1>

            <p className="mt-6 max-w-2xl font-sans text-base leading-relaxed text-white/75 lg:text-lg">
              Satu tempat untuk Kepala BRIDA, Sekretaris, Kasubbag, dan Kelompok Kerja Riset
              mendelegasikan tugas, melaporkan capaian, dan memantau progres pelaksanaannya
              secara terstruktur dan transparan.
            </p>

            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup">
                <Button
                  size="lg"
                  className="group bg-accent text-primary hover:bg-accent/90 font-semibold w-full sm:w-auto"
                >
                  Mulai sekarang
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white font-medium w-full sm:w-auto"
                >
                  Sudah punya akun
                </Button>
              </Link>
            </div>
          </div>

          <div className="divider-teal mt-16 h-px w-full" />

          {/* Institutional stat strip */}
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { icon: MapPin, label: "Lokasi", value: "Provinsi Jambi" },
              { icon: Activity, label: "Status Sistem", value: "Operasional Penuh" },
              { icon: Lock, label: "Keamanan", value: "Akses Terotentikasi" },
            ].map((s) => (
              <div key={s.label} className="flex items-start gap-3 border-l-2 border-accent/40 pl-4">
                <s.icon className="mt-0.5 h-4 w-4 text-accent" />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                    {s.label}
                  </div>
                  <div className="mt-0.5 text-sm font-medium text-white">{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quote strip */}
      <div className="border-y border-border bg-secondary/40">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-5 lg:px-8">
          <div className="h-10 w-1 rounded-full bg-[oklch(0.55_0.08_215)]" />
          <p className="font-sans text-sm italic text-muted-foreground">
            Mendukung tata kelola riset dan inovasi daerah yang terstruktur, akuntabel, dan transparan.
          </p>
        </div>
      </div>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
        <div className="mb-10 max-w-2xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[oklch(0.55_0.08_215)]">
            Kapabilitas Platform
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-primary lg:text-4xl">
            Dirancang untuk koordinasi institusi riset.
          </h2>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg bg-border md:grid-cols-3">
          {[
            {
              icon: Network,
              title: "Struktur berjenjang",
              desc: "Eselon II → III → IV, hingga Kelompok Kerja Riset. Wewenang mengalir terstruktur.",
            },
            {
              icon: ClipboardList,
              title: "Pelaporan dua arah",
              desc: "Pelaksana melaporkan progres dengan persentase capaian langsung ke atasan.",
            },
            {
              icon: BarChart3,
              title: "Dashboard pemantauan",
              desc: "Pimpinan melihat status seluruh penugasan dalam satu pandangan.",
            },
          ].map((f) => (
            <div key={f.title} className="group bg-card p-7 transition-colors hover:bg-secondary/40">
              <div className="grid h-11 w-11 place-items-center rounded-md bg-primary text-accent">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-primary">{f.title}</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-primary text-primary-foreground/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-white/10 p-1">
              <img src={bridaLogo} alt="" className="h-full w-full object-contain" />
            </div>
            <div className="text-xs">
              <div className="font-display font-bold text-white">D'LaPin · BRIDA Provinsi Jambi</div>
              <div className="text-white/50">Badan Riset dan Inovasi Daerah</div>
            </div>
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">
            © {new Date().getFullYear()} · Sistem Internal
          </div>
        </div>
      </footer>
    </div>
  );
}
