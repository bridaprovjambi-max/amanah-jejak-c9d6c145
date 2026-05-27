import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const inputSchema = z.object({
  startDate: z.string(), // ISO
  endDate: z.string(),
  pokjaId: z.string().uuid().optional(),
  status: z.enum(["all", "pending", "in_progress", "completed", "overdue"]).default("all"),
});

interface TaskRekap {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  created_at: string;
  assigned_by: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
}

export const generateRekapPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let query = supabase
      .from("tasks")
      .select("*")
      .gte("created_at", data.startDate)
      .lte("created_at", data.endDate)
      .order("created_at", { ascending: false });

    if (data.pokjaId) query = query.eq("assigned_to_pokja", data.pokjaId);

    const { data: rawTasks, error } = await query;
    if (error) throw new Error(error.message);
    let tasks = (rawTasks ?? []) as TaskRekap[];

    if (data.status !== "all") {
      const now = new Date();
      if (data.status === "overdue") {
        tasks = tasks.filter(
          (t) => t.status !== "completed" && t.deadline && new Date(t.deadline) < now,
        );
      } else {
        tasks = tasks.filter((t) => t.status === data.status);
      }
    }

    // Resolve names
    const userIds = Array.from(
      new Set(
        tasks.flatMap((t) =>
          [t.assigned_by, t.assigned_to].filter((x): x is string => !!x),
        ),
      ),
    );
    const pokjaIds = Array.from(
      new Set(tasks.map((t) => t.assigned_to_pokja).filter((x): x is string => !!x)),
    );
    const [{ data: profs }, { data: pks }] = await Promise.all([
      userIds.length
        ? supabase.from("profiles").select("id, full_name").in("id", userIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string }> }),
      pokjaIds.length
        ? supabase.from("pokja").select("id, name").in("id", pokjaIds)
        : Promise.resolve({ data: [] as Array<{ id: string; name: string }> }),
    ]);
    const userMap = new Map((profs ?? []).map((p) => [p.id, p.full_name]));
    const pokjaMap = new Map((pks ?? []).map((p) => [p.id, p.name]));

    // Counts
    const stats = {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === "pending").length,
      inProgress: tasks.filter((t) => t.status === "in_progress").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      overdue: tasks.filter(
        (t) =>
          t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date(),
      ).length,
    };

    // Build PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.08, 0.13, 0.32);
    const gray = rgb(0.4, 0.4, 0.45);
    const border = rgb(0.85, 0.85, 0.9);

    let page = pdf.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    const margin = 40;
    let y = height - margin;

    const draw = (text: string, x: number, yPos: number, opts: { size?: number; b?: boolean; color?: ReturnType<typeof rgb> } = {}) => {
      page.drawText(text, {
        x,
        y: yPos,
        size: opts.size ?? 9,
        font: opts.b ? bold : font,
        color: opts.color ?? rgb(0.15, 0.15, 0.2),
      });
    };

    // Header
    draw("BADAN RISET DAN INOVASI DAERAH", margin, y, { size: 13, b: true, color: navy });
    y -= 16;
    draw("Rekap Penugasan", margin, y, { size: 10, color: gray });
    y -= 22;

    const startStr = new Date(data.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const endStr = new Date(data.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    draw(`Periode: ${startStr} – ${endStr}`, margin, y, { size: 9 });
    y -= 12;
    if (data.pokjaId) {
      draw(`Pokja: ${pokjaMap.get(data.pokjaId) ?? "—"}`, margin, y, { size: 9 });
      y -= 12;
    }
    draw(`Dicetak: ${new Date().toLocaleString("id-ID")}`, margin, y, { size: 9, color: gray });
    y -= 20;

    // Stats summary
    page.drawRectangle({ x: margin, y: y - 50, width: width - margin * 2, height: 50, borderColor: border, borderWidth: 0.5 });
    const statBoxes = [
      { label: "Total", value: stats.total },
      { label: "Menunggu", value: stats.pending },
      { label: "Berjalan", value: stats.inProgress },
      { label: "Selesai", value: stats.completed },
      { label: "Terlambat", value: stats.overdue },
    ];
    const boxW = (width - margin * 2) / statBoxes.length;
    statBoxes.forEach((s, i) => {
      const cx = margin + boxW * i + boxW / 2;
      draw(s.label, cx - font.widthOfTextAtSize(s.label, 8) / 2, y - 18, { size: 8, color: gray });
      const vStr = String(s.value);
      draw(vStr, cx - bold.widthOfTextAtSize(vStr, 14) / 2, y - 38, { size: 14, b: true, color: navy });
    });
    y -= 64;

    // Table header
    const cols = [
      { label: "No", w: 24 },
      { label: "Judul Penugasan", w: 180 },
      { label: "Penerima", w: 110 },
      { label: "Tenggat", w: 70 },
      { label: "Prioritas", w: 55 },
      { label: "Status", w: 76 },
    ];
    const rowH = 18;

    const drawTableHeader = () => {
      page.drawRectangle({ x: margin, y: y - rowH, width: width - margin * 2, height: rowH, color: rgb(0.94, 0.95, 0.98) });
      let cx = margin + 4;
      cols.forEach((c) => {
        draw(c.label, cx, y - 12, { size: 8, b: true, color: navy });
        cx += c.w;
      });
      y -= rowH;
    };
    drawTableHeader();

    const labelStatus = (s: string, t: TaskRekap) => {
      const overdue = t.status !== "completed" && t.deadline && new Date(t.deadline) < new Date();
      if (overdue) return "Terlambat";
      return s === "pending" ? "Menunggu" : s === "in_progress" ? "Berjalan" : s === "completed" ? "Selesai" : s;
    };

    if (tasks.length === 0) {
      draw("(Tidak ada data pada periode ini)", margin + 4, y - 12, { size: 9, color: gray });
      y -= rowH;
    } else {
      tasks.forEach((t, idx) => {
        if (y < margin + 40) {
          page = pdf.addPage([595.28, 841.89]);
          y = height - margin;
          drawTableHeader();
        }
        page.drawLine({
          start: { x: margin, y: y - rowH },
          end: { x: width - margin, y: y - rowH },
          color: border,
          thickness: 0.4,
        });
        let cx = margin + 4;
        const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);
        const recipient = t.assigned_to
          ? userMap.get(t.assigned_to) ?? "—"
          : t.assigned_to_pokja
          ? `Pokja ${pokjaMap.get(t.assigned_to_pokja) ?? "—"}`
          : "—";
        const deadline = t.deadline
          ? new Date(t.deadline).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "2-digit" })
          : "—";
        const cells = [
          String(idx + 1),
          truncate(t.title, 42),
          truncate(recipient, 22),
          deadline,
          t.priority,
          labelStatus(t.status, t),
        ];
        cells.forEach((val, i) => {
          draw(val, cx, y - 12, { size: 8 });
          cx += cols[i].w;
        });
        y -= rowH;
      });
    }

    // Footer
    const pages = pdf.getPages();
    pages.forEach((p, i) => {
      const txt = `Halaman ${i + 1} dari ${pages.length} — DeLapan · BRIDA`;
      p.drawText(txt, {
        x: margin,
        y: 20,
        size: 7,
        font,
        color: gray,
      });
    });

    const bytes = await pdf.save();
    // Convert to base64
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);

    return {
      filename: `rekap-penugasan-${data.startDate.slice(0, 10)}_${data.endDate.slice(0, 10)}.pdf`,
      base64,
      stats,
      count: tasks.length,
    };
  });
