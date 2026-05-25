import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Network, ClipboardList, BarChart3 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/dashboard" />;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground font-bold">
              B
            </div>
            <div>
              <div className="font-display text-base font-bold">Delegasi & Pelaporan Internal</div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                BRIDA
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Masuk</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm">Daftar</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="bg-gradient-hero text-primary-foreground">
        <div className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur">
              <ShieldCheck className="h-3.5 w-3.5" />
              Internal BRIDA · Akses Terkendali
            </div>
            <h1 className="text-balance font-display text-4xl font-extrabold leading-tight lg:text-6xl">
              Delegasi dan Pelaporan Internal BRIDA
            </h1>
            <p className="mt-5 max-w-2xl text-base text-white/80 lg:text-lg">
              Satu tempat untuk Kepala BRIDA, Sekretaris, Kasubbag, dan Kelompok Kerja Riset
              mendelegasikan tugas, melaporkan capaian, dan memantau progres pelaksanaannya.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/signup">
                <Button size="lg" variant="secondary" className="font-semibold">
                  Mulai sekarang <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                >
                  Sudah punya akun
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 lg:px-8 lg:py-20">
        <div className="grid gap-6 md:grid-cols-3">
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
            <div key={f.title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} BRIDA · Delegasi dan Pelaporan Internal — Monitoring Wewenang & Pelaporan
      </footer>
    </div>
  );
}
