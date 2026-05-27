import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Loader2, FileText } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { generateRekapPdf } from "@/lib/rekap.functions";

export const Route = createFileRoute("/_authenticated/reports/rekap")({
  component: RekapPage,
});

interface PokjaRow {
  id: string;
  name: string;
}

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function RekapPage() {
  const generate = useServerFn(generateRekapPdf);
  const [pokjaList, setPokjaList] = useState<PokjaRow[]>([]);
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [pokjaId, setPokjaId] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "pending" | "in_progress" | "completed" | "overdue">("all");
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ count: number; stats: Record<string, number> } | null>(null);

  useEffect(() => {
    supabase
      .from("pokja")
      .select("id, name")
      .order("name")
      .then(({ data }) => setPokjaList((data as PokjaRow[]) ?? []));
  }, []);

  const periodLabel = useMemo(() => {
    const s = new Date(startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const e = new Date(endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    return `${s} – ${e}`;
  }, [startDate, endDate]);

  const onGenerate = async () => {
    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Tanggal mulai harus sebelum tanggal akhir");
      return;
    }
    setLoading(true);
    try {
      const res = await generate({
        data: {
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate + "T23:59:59").toISOString(),
          pokjaId: pokjaId === "all" ? undefined : pokjaId,
          status,
        },
      });
      // Trigger download
      const byteChars = atob(res.base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      setLastResult({ count: res.count, stats: res.stats });
      toast.success(`Rekap PDF dihasilkan (${res.count} penugasan)`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal membuat rekap PDF");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-primary">
          Rekap & Laporan Berkala
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cetak rekap penugasan dalam format PDF berdasarkan periode dan filter.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 lg:p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2 text-primary">
          <FileText className="h-4 w-4" />
          <h2 className="font-display font-bold">Parameter Rekap</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">Tanggal mulai</Label>
            <Input
              id="start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">Tanggal akhir</Label>
            <Input
              id="end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pokja</Label>
            <Select value={pokjaId} onValueChange={setPokjaId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua pokja</SelectItem>
                {pokjaList.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="pending">Menunggu</SelectItem>
                <SelectItem value="in_progress">Berjalan</SelectItem>
                <SelectItem value="completed">Selesai</SelectItem>
                <SelectItem value="overdue">Terlambat</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Periode: <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
          <Button onClick={onGenerate} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Membuat PDF…
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" /> Unduh Rekap PDF
              </>
            )}
          </Button>
        </div>
      </div>

      {lastResult && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h3 className="font-display font-bold text-primary mb-3">Hasil Rekap Terakhir</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {lastResult.count} penugasan ditemukan pada periode {periodLabel}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries({
              Total: lastResult.stats.total,
              Menunggu: lastResult.stats.pending,
              Berjalan: lastResult.stats.inProgress,
              Selesai: lastResult.stats.completed,
              Terlambat: lastResult.stats.overdue,
            }).map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="text-xl font-bold text-primary mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
