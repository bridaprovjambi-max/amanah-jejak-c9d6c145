import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown } from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/hierarki")({
  component: HierarkiPage,
});

interface NodeProps {
  title: string;
  subtitle?: string;
  tone?: "primary" | "secondary" | "accent" | "muted";
  children?: ReactNode;
}

const TONE: Record<NonNullable<NodeProps["tone"]>, string> = {
  primary: "bg-primary text-primary-foreground border-primary",
  secondary: "bg-secondary text-secondary-foreground border-secondary",
  accent: "bg-accent text-accent-foreground border-accent",
  muted: "bg-card text-foreground border-border",
};

function Node({ title, subtitle, tone = "muted", children }: NodeProps) {
  return (
    <div
      className={`rounded-xl border-2 px-4 py-3 shadow-sm text-center min-w-[180px] ${TONE[tone]}`}
    >
      <div className="font-display font-bold leading-tight text-sm lg:text-base">
        {title}
      </div>
      {subtitle && (
        <div className="text-[11px] mt-1 opacity-80 leading-snug">{subtitle}</div>
      )}
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center">
      <div className="h-6 w-px bg-border" />
    </div>
  );
}

function HierarkiPage() {
  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">
          Bagan Hierarki & Alur Penugasan
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Penugasan diberikan dari jenjang di atas ke bawah, dan pelaporan
          pelaksanaan mengalir sebaliknya — dari bawah ke atasannya.
        </p>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-primary" /> Pemberi tugas utama
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-secondary" /> Jenjang penghubung
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-3 w-3 rounded-sm bg-accent" /> Pelaksana
        </span>
        <span className="inline-flex items-center gap-2">
          <ArrowDown className="h-3 w-3" /> Arah penugasan
        </span>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card p-6 lg:p-10 overflow-x-auto">
        <div className="min-w-[720px] flex flex-col items-center gap-0">
          {/* Eselon II */}
          <Node
            tone="primary"
            title="Kepala BRIDA Provinsi Jambi"
            subtitle="Eselon II"
          />

          <Connector />

          {/* Eselon III */}
          <Node
            tone="secondary"
            title="Sekretaris BRIDA Provinsi Jambi"
            subtitle="Eselon III"
          />

          {/* Branch out: Eselon III feeds Kasubbag, Pokja, Jafung */}
          <div className="relative w-full mt-6">
            {/* horizontal line */}
            <div className="absolute top-0 left-[12%] right-[12%] h-px bg-border" />
            {/* vertical line from sekretaris */}
            <div className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-border" />

            <div className="grid grid-cols-3 gap-4 lg:gap-8 pt-0">
              {/* Column 1: Kasubbag → Staf */}
              <div className="flex flex-col items-center">
                <div className="h-6 w-px bg-border" />
                <Node
                  tone="secondary"
                  title="Kasubbag Umum & Kepegawaian"
                  subtitle="Eselon IV"
                />
                <Connector />
                <Node
                  tone="accent"
                  title="Staf / Pelaksana"
                  subtitle="Lapor ke Kasubbag & Sekretaris"
                />
              </div>

              {/* Column 2: Kelompok Kerja & Inovasi */}
              <div className="flex flex-col items-center">
                <div className="h-6 w-px bg-border" />
                <Node
                  tone="accent"
                  title="Kelompok Kerja"
                  subtitle="Lapor ke Sekretaris & Kepala BRIDA"
                />
                <div className="mt-3 grid grid-cols-2 gap-2 w-full">
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center text-[11px] font-medium">
                    Kelompok Kerja Riset
                  </div>
                  <div className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center text-[11px] font-medium">
                    Kelompok Kerja Inovasi
                  </div>
                </div>
              </div>

              {/* Column 3: Jafung */}
              <div className="flex flex-col items-center">
                <div className="h-6 w-px bg-border" />
                <Node
                  tone="accent"
                  title="Rumpun Jabatan Fungsional"
                  subtitle="Lapor ke Sekretaris & Kepala BRIDA"
                />
                <div className="mt-3 grid grid-cols-1 gap-1.5 w-full text-[11px]">
                  {[
                    "Peneliti Madya (lapor ke Kepala)",
                    "Peneliti Muda",
                    "Perencana Muda",
                    "Analis Kebijakan Muda",
                    "Analis Data Ilmiah",
                    "Arsiparis Muda",
                  ].map((p) => (
                    <div
                      key={p}
                      className="rounded-md border border-border bg-muted/40 px-2 py-1 text-left font-medium"
                    >
                      {p}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alur */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-base mb-2">
            Alur Penugasan (atas → bawah)
          </div>
          <ol className="text-sm space-y-1.5 list-decimal pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Kepala BRIDA</span>{" "}
              menugaskan Sekretaris, Pokja, atau Jafung (termasuk Peneliti Madya).
            </li>
            <li>
              <span className="text-foreground font-medium">Sekretaris</span>{" "}
              meneruskan ke Kasubbag, Pokja, atau Jafung.
            </li>
            <li>
              <span className="text-foreground font-medium">Kasubbag</span>{" "}
              menugaskan Staf/Pelaksana.
            </li>
            <li>
              <span className="text-foreground font-medium">Pokja / Jafung</span>{" "}
              mengeksekusi langsung tugas yang diterima.
            </li>
          </ol>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="font-display font-bold text-base mb-2">
            Alur Pelaporan (bawah → atas)
          </div>
          <ol className="text-sm space-y-1.5 list-decimal pl-5 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Staf/Pelaksana</span>{" "}
              melapor ke Kasubbag dan Sekretaris.
            </li>
            <li>
              <span className="text-foreground font-medium">Kasubbag</span>{" "}
              melapor ke Sekretaris.
            </li>
            <li>
              <span className="text-foreground font-medium">
                Pokja & Jafung
              </span>{" "}
              melapor ke Sekretaris dan Kepala BRIDA.
            </li>
            <li>
              <span className="text-foreground font-medium">Sekretaris</span>{" "}
              merangkum dan melapor ke Kepala BRIDA.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
}
