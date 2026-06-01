import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn<T> = {
  header: string;
  /** width hint for PDF (in mm). Optional. */
  width?: number;
  accessor: (row: T) => string | number | null | undefined;
};

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function safeFileBase(name: string) {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function todayStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}`;
}

export function exportToCSV<T>(opts: {
  filenameBase: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const { columns, rows, filenameBase } = opts;
  const header = columns.map((c) => csvCell(c.header)).join(",");
  const body = rows
    .map((r) => columns.map((c) => csvCell(c.accessor(r))).join(","))
    .join("\r\n");
  // BOM agar Excel mengenali UTF-8 (penting untuk karakter Indonesia).
  const blob = new Blob(["\uFEFF" + header + "\r\n" + body], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${safeFileBase(filenameBase)}-${todayStamp()}.csv`);
}

export function exportToPDF<T>(opts: {
  filenameBase: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
}) {
  const { title, subtitle, columns, rows, filenameBase } = opts;
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  const ts = new Date().toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const meta = `${subtitle ? subtitle + " · " : ""}${rows.length} baris · Diekspor ${ts}`;
  doc.text(meta, 14, 20);
  doc.setTextColor(0);

  const columnStyles: Record<number, { cellWidth?: number }> = {};
  columns.forEach((c, i) => {
    if (c.width) columnStyles[i] = { cellWidth: c.width };
  });

  autoTable(doc, {
    startY: 25,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) =>
      columns.map((c) => {
        const v = c.accessor(r);
        return v === null || v === undefined ? "" : String(v);
      }),
    ),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [37, 37, 64], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [246, 246, 250] },
    margin: { left: 10, right: 10 },
    tableWidth: pageWidth - 20,
    columnStyles,
    didDrawPage: (data) => {
      const str = `Halaman ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        str,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 6,
        { align: "right" },
      );
      doc.setTextColor(0);
      // ESLint
      void data;
    },
  });

  doc.save(`${safeFileBase(filenameBase)}-${todayStamp()}.pdf`);
}
