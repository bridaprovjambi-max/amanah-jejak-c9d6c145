import jsPDF from "jspdf";

interface DocLike {
  id: string;
  title: string;
  file_name: string;
  folder: string;
  created_at: string;
  ai_summary: string | null;
  ai_key_points: { text: string }[] | null;
  ai_entities: {
    authors?: string[];
    institutions?: string[];
    year?: string;
    topics?: string[];
    methodology?: string;
    location?: string;
  } | null;
  ai_analyzed_at: string | null;
  ai_status: string;
}

interface RelatedDocInfo {
  title: string;
  file_name: string;
}

function safeFilename(s: string) {
  return s.replace(/[^a-z0-9\-_]+/gi, "_").slice(0, 80) || "dokumen";
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(v: string) {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function exportAnalysisCSV(doc: DocLike) {
  const ent = doc.ai_entities ?? {};
  const rows: [string, string][] = [
    ["Judul", doc.title],
    ["Berkas", doc.file_name],
    ["Folder", doc.folder],
    ["Tanggal upload", new Date(doc.created_at).toLocaleString("id-ID")],
    [
      "Tanggal analisis",
      doc.ai_analyzed_at ? new Date(doc.ai_analyzed_at).toLocaleString("id-ID") : "-",
    ],
    ["Ringkasan", doc.ai_summary ?? ""],
    [
      "Poin Kunci",
      (doc.ai_key_points ?? []).map((k, i) => `${i + 1}. ${k.text}`).join(" | "),
    ],
    ["Penulis", (ent.authors ?? []).join("; ")],
    ["Lembaga", (ent.institutions ?? []).join("; ")],
    ["Topik", (ent.topics ?? []).join("; ")],
    ["Tahun", ent.year ?? ""],
    ["Lokasi", ent.location ?? ""],
    ["Metodologi", ent.methodology ?? ""],
  ];
  const csv =
    "Field,Value\n" +
    rows.map(([k, v]) => `${csvEscape(k)},${csvEscape(v)}`).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `analisis-${safeFilename(doc.title)}.csv`);
}

export function exportAnalysisPDF(doc: DocLike) {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const ensureSpace = (h: number) => {
    if (y + h > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
  };

  const writeWrapped = (text: string, size: number, opts: { bold?: boolean; color?: [number, number, number] } = {}) => {
    pdf.setFont("helvetica", opts.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(opts.color ?? [30, 30, 40]));
    const lines = pdf.splitTextToSize(text, maxWidth);
    const lineHeight = size * 1.35;
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, margin, y);
      y += lineHeight;
    }
  };

  const sectionLabel = (label: string) => {
    y += 6;
    ensureSpace(20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(100, 110, 130);
    pdf.text(label.toUpperCase(), margin, y);
    y += 4;
    pdf.setDrawColor(220, 225, 235);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 12;
  };

  // Header band
  pdf.setFillColor(15, 30, 70);
  pdf.rect(0, 0, pageWidth, 70, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("DeLapan · BRIDA Provinsi Jambi", margin, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(200, 215, 235);
  pdf.text("Hasil Analisis AI Dokumen", margin, 48);
  y = 100;

  // Title
  writeWrapped(doc.title, 18, { bold: true, color: [15, 30, 70] });
  y += 4;
  writeWrapped(
    `${doc.file_name} · Folder: ${doc.folder} · Diunggah: ${new Date(doc.created_at).toLocaleString("id-ID")}`,
    9,
    { color: [110, 120, 140] },
  );
  if (doc.ai_analyzed_at) {
    writeWrapped(
      `Analisis: ${new Date(doc.ai_analyzed_at).toLocaleString("id-ID")}`,
      9,
      { color: [110, 120, 140] },
    );
  }

  if (doc.ai_summary) {
    sectionLabel("Ringkasan");
    writeWrapped(doc.ai_summary, 11);
  }

  if (doc.ai_key_points && doc.ai_key_points.length > 0) {
    sectionLabel("Poin Kunci");
    doc.ai_key_points.forEach((kp, i) => {
      writeWrapped(`${i + 1}. ${kp.text}`, 11);
    });
  }

  const ent = doc.ai_entities ?? {};
  const hasEntities =
    (ent.authors?.length ?? 0) > 0 ||
    (ent.institutions?.length ?? 0) > 0 ||
    (ent.topics?.length ?? 0) > 0 ||
    !!ent.year ||
    !!ent.location ||
    !!ent.methodology;

  if (hasEntities) {
    sectionLabel("Entitas & Metadata");
    const field = (label: string, value: string) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(70, 80, 110);
      ensureSpace(14);
      pdf.text(label, margin, y);
      y += 12;
      writeWrapped(value, 10);
      y += 2;
    };
    if (ent.authors?.length) field("Penulis", ent.authors.join(", "));
    if (ent.institutions?.length) field("Lembaga", ent.institutions.join(", "));
    if (ent.topics?.length) field("Topik", ent.topics.join(", "));
    if (ent.year) field("Tahun", ent.year);
    if (ent.location) field("Lokasi", ent.location);
    if (ent.methodology) field("Metodologi", ent.methodology);
  }

  // Footer with page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 150, 170);
    pdf.text(
      `Dihasilkan ${new Date().toLocaleString("id-ID")}  ·  Hal. ${i}/${pageCount}`,
      margin,
      pageHeight - 24,
    );
  }

  pdf.save(`analisis-${safeFilename(doc.title)}.pdf`);
}
