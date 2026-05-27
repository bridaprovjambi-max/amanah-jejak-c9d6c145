import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const inputSchema = z.object({ documentId: z.string().uuid() });

type KeyPoint = { text: string };
type Entities = {
  authors?: string[];
  institutions?: string[];
  year?: string | null;
  topics?: string[];
  methodology?: string | null;
  location?: string | null;
};

async function extractText(
  bytes: Uint8Array,
  mime: string | null,
  fileName: string,
): Promise<string> {
  const lower = (mime ?? "").toLowerCase();
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";

  // PDF
  if (lower.includes("pdf") || ext === "pdf") {
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await pdfExtract(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n\n") : String(text ?? "");
  }

  // Plain text / markdown / csv
  if (
    lower.startsWith("text/") ||
    ["txt", "md", "csv", "json", "html", "xml"].includes(ext)
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  throw new Error(
    `Format file belum didukung untuk analisis AI (${mime ?? ext || "unknown"}). Saat ini mendukung PDF dan teks.`,
  );
}

export const analyzeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase: userClient } = context;

    // 1. Verify the user can see this document (RLS-enforced client)
    const { data: doc, error: docErr } = await userClient
      .from("documents")
      .select("id, title, description, file_path, file_name, mime_type, file_size")
      .eq("id", data.documentId)
      .maybeSingle();

    if (docErr) throw new Error(docErr.message);
    if (!doc) throw new Error("Dokumen tidak ditemukan atau Anda tidak memiliki akses.");

    if (doc.file_size > 20 * 1024 * 1024) {
      throw new Error("File terlalu besar untuk dianalisis (maksimal 20MB).");
    }

    // Mark as running
    await supabaseAdmin
      .from("documents")
      .update({ ai_status: "running", ai_error: null })
      .eq("id", doc.id);

    try {
      // 2. Download file via admin client (private bucket)
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from("documents")
        .download(doc.file_path);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "Gagal mengunduh file");

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const text = await extractText(bytes, doc.mime_type, doc.file_name);
      const trimmed = text.replace(/\s+/g, " ").trim();
      if (!trimmed) {
        throw new Error("Tidak ada teks yang bisa diekstrak dari dokumen ini.");
      }

      // Cap input to keep cost predictable (~60k chars ≈ first 30-40 PDF pages)
      const MAX_CHARS = 60_000;
      const corpus = trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed;

      // 3. Call Lovable AI Gateway with structured tool calling
      const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY tidak terkonfigurasi");

      const systemPrompt = `Anda adalah asisten analisis dokumen riset di BRIDA (Badan Riset dan Inovasi Daerah). Berikan analisis yang akurat, padat, dan profesional dalam Bahasa Indonesia formal. Ekstraksi entitas harus berdasar isi dokumen — jangan mengarang.`;

      const userPrompt = `Analisis dokumen riset berikut.

Judul: ${doc.title}
${doc.description ? `Deskripsi: ${doc.description}\n` : ""}
Isi dokumen:
"""
${corpus}
"""

Hasilkan analisis terstruktur via tool call \`save_document_analysis\`.`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "save_document_analysis",
                description:
                  "Simpan hasil analisis dokumen riset (ringkasan, poin kunci, entitas).",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description:
                        "Ringkasan eksekutif 3-5 kalimat Bahasa Indonesia formal.",
                    },
                    key_points: {
                      type: "array",
                      description: "5-8 poin kunci/temuan utama, masing-masing 1 kalimat.",
                      items: {
                        type: "object",
                        properties: { text: { type: "string" } },
                        required: ["text"],
                        additionalProperties: false,
                      },
                    },
                    entities: {
                      type: "object",
                      properties: {
                        authors: { type: "array", items: { type: "string" } },
                        institutions: { type: "array", items: { type: "string" } },
                        year: { type: "string" },
                        topics: { type: "array", items: { type: "string" } },
                        methodology: { type: "string" },
                        location: { type: "string" },
                      },
                      additionalProperties: false,
                    },
                  },
                  required: ["summary", "key_points", "entities"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "save_document_analysis" },
          },
        }),
      });

      if (!aiRes.ok) {
        const t = await aiRes.text();
        if (aiRes.status === 429)
          throw new Error("Batas penggunaan AI tercapai, coba lagi sebentar.");
        if (aiRes.status === 402)
          throw new Error(
            "Kredit Lovable AI habis. Tambah kredit di Settings → Workspace → Usage.",
          );
        throw new Error(`AI gateway error [${aiRes.status}]: ${t.slice(0, 200)}`);
      }

      const aiJson = await aiRes.json();
      const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
      const argsStr = toolCall?.function?.arguments;
      if (!argsStr) throw new Error("AI tidak mengembalikan hasil terstruktur.");
      const parsed = JSON.parse(argsStr) as {
        summary: string;
        key_points: KeyPoint[];
        entities: Entities;
      };

      // 4. Persist
      const { error: upErr } = await supabaseAdmin
        .from("documents")
        .update({
          ai_summary: parsed.summary,
          ai_key_points: parsed.key_points,
          ai_entities: parsed.entities,
          ai_status: "done",
          ai_error: null,
          ai_analyzed_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      if (upErr) throw new Error(upErr.message);

      return { ok: true as const };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Gagal menganalisis dokumen";
      await supabaseAdmin
        .from("documents")
        .update({ ai_status: "error", ai_error: message })
        .eq("id", doc.id);
      throw new Error(message);
    }
  });
