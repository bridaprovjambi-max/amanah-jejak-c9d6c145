import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  Layers,
  History,
  LogOut,
  Menu,
  X,
  Plus,
  Network,
  FileText,
  FolderCog,
  Bell,
  FileDown,
  Trophy,
  CalendarDays,
  KeyRound,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { useAuth, JENJANG_LABEL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import delapanLogo from "@/assets/delapan-logo.webp";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: ("leader" | "admin")[];
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/tasks", label: "Penugasan", icon: ListChecks },
  { to: "/wewenang", label: "Laporan Wewenang", icon: ShieldCheck },
  { to: "/pptk", label: "Laporan PPTK", icon: ClipboardList },
  { to: "/telaah-staf", label: "Telaah Staf", icon: FileText },


  { to: "/kalender", label: "Kalender", icon: CalendarDays },
  { to: "/reports/rekap", label: "Rekap PDF", icon: FileDown, roles: ["leader", "admin"] },
  { to: "/kinerja", label: "Kinerja", icon: Trophy },
  { to: "/hierarki", label: "Bagan Hierarki", icon: Network },
  { to: "/pokja", label: "Kelompok Kerja", icon: Layers },
  { to: "/documents", label: "Dokumen", icon: FileText },
  { to: "/folders", label: "Pengaturan Folder", icon: FolderCog, roles: ["leader", "admin"] },
  { to: "/settings", label: "Notifikasi Telegram", icon: Bell },
  { to: "/users", label: "Pengguna", icon: Users, roles: ["leader", "admin"] },
  { to: "/activity", label: "Riwayat", icon: History, roles: ["leader", "admin"] },
  { to: "/api-keys", label: "Kunci API", icon: KeyRound, roles: ["leader", "admin"] },


];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, hasRole, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  // Close drawer on ESC + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Auto-close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);


  const canSeeAdmin = hasRole(["admin", "kepala", "sekretaris"]);
  const initials = profile?.full_name
    ?.split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="px-6 py-6 border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-white p-1 shadow-gold">
            <img src={delapanLogo} alt="Logo DeLapan" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-xl text-sidebar-foreground tracking-tight">
              DeLapan
            </div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/55">
              Delegasi & Pelaporan
            </div>
          </div>
        </Link>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-5 space-y-0.5">
        {NAV.filter((n) => !n.roles || canSeeAdmin).map((n) => {
          const active = loc.pathname.startsWith(n.to);
          const Icon = n.icon;
          return (
            <Link
              key={n.to}
              to={n.to}
              onClick={() => setOpen(false)}
              className={cn(
                "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium font-ui transition-all",
                active
                  ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-r-full bg-[var(--brand-gold)]" />
              )}
              <Icon className="h-4 w-4 shrink-0" />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-sidebar-accent-foreground text-xs font-semibold font-ui">
            {initials ?? "U"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-sidebar-foreground">
              {profile?.full_name ?? "Pengguna"}
            </div>
            <div className="truncate text-[11px] text-sidebar-foreground/55">
              {profile?.jabatan ?? (profile ? JENJANG_LABEL[profile.jenjang] : "")}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="w-full justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  );


  const isDashboard = loc.pathname === "/dashboard" || loc.pathname === "/";
  const useCosmos = !isDashboard;

  return (
    <div className={cn("min-h-dvh relative", useCosmos ? "bg-cosmos text-white" : "bg-background")}>
      {useCosmos && (
        <>
          <div className="pointer-events-none fixed inset-0 bg-grid-cosmos opacity-50" />
          <div className="pointer-events-none fixed -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.24_290/0.25)] blur-3xl animate-float-orb" />
          <div className="pointer-events-none fixed -bottom-40 -right-32 h-[32rem] w-[32rem] rounded-full bg-[oklch(0.65_0.25_25/0.18)] blur-3xl animate-float-orb" style={{ animationDelay: "1.5s" }} />
        </>
      )}

      {/* Skip-link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        Lompat ke konten
      </a>

      {/* Mobile topbar */}
      <header className={cn(
        "lg:hidden sticky top-0 z-30 flex items-center justify-between border-b px-3 h-14 pt-safe backdrop-blur-md",
        useCosmos ? "border-white/10 bg-[oklch(0.16_0.07_265/0.7)]" : "border-border bg-card/90"
      )}>
        <Link to="/dashboard" className="flex items-center gap-2 min-h-11 px-1" aria-label="Beranda DeLapan">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-white p-0.5 shadow-sm shrink-0">
            <img src={delapanLogo} alt="" className="h-full w-full object-contain" />
          </div>
          <span className="font-display text-lg tracking-tight">DeLapan</span>
        </Link>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            onClick={() => navigate({ to: "/tasks/new" })}
            aria-label="Buat penugasan baru"
            className={cn("h-11 w-11", useCosmos && "bg-vivid-gradient text-white border-0 hover:opacity-95")}
          >
            <Plus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            aria-label="Buka menu navigasi"
            aria-expanded={open}
            aria-controls="mobile-nav-drawer"
            className={cn("h-11 w-11", useCosmos && "text-white hover:bg-white/10 hover:text-white")}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-20 w-64 bg-sidebar-gradient text-sidebar-foreground border-r border-sidebar-border">
        {SidebarContent}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex h-[100dvh]"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi"
        >
          <div
            className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-overlay-in"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="mobile-nav-drawer"
            className="relative flex h-[100dvh] max-h-[100dvh] w-[min(20rem,85vw)] flex-col overflow-hidden bg-sidebar-gradient text-sidebar-foreground shadow-2xl animate-drawer-in pt-safe pb-safe"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 grid h-11 w-11 place-items-center rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-accent-foreground"
              aria-label="Tutup menu"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <main id="main-content" className={cn("lg:pl-64 relative", useCosmos && "theme-cosmos")}>
        <div className="mx-auto max-w-7xl px-4 py-5 lg:px-10 lg:py-10 animate-fade-in-up">
          {children}
        </div>
      </main>
    </div>

  );
}

