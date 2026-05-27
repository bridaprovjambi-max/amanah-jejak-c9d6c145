import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key",
};

const TaskSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(5000).optional(),
  priority: z.enum(["rendah", "normal", "tinggi"]).optional(),
  deadline: z.string().datetime().optional(),
  assigned_to: z.string().uuid().optional(),
  assigned_to_pokja: z.string().uuid().optional(),
  external_ref: z.string().max(255).optional(),
});

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyKey(rawKey: string) {
  const hash = await sha256Hex(rawKey);
  const { data, error } = await supabaseAdmin
    .from("external_api_keys")
    .select("id, created_by, scopes, revoked_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  return data as { id: string; created_by: string; scopes: string[]; revoked_at: string | null };
}

export const Route = createFileRoute("/api/public/external/tasks")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const apiKey =
          request.headers.get("x-api-key") ||
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
          "";
        if (!apiKey) {
          return Response.json({ error: "missing_api_key" }, { status: 401, headers: CORS });
        }
        const key = await verifyKey(apiKey);
        if (!key) {
          return Response.json({ error: "invalid_or_revoked_key" }, { status: 401, headers: CORS });
        }
        if (!key.scopes.includes("tasks:create")) {
          return Response.json({ error: "insufficient_scope" }, { status: 403, headers: CORS });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }
        const parsed = TaskSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "validation_failed", issues: parsed.error.flatten() },
            { status: 400, headers: CORS },
          );
        }
        const t = parsed.data;
        if (!t.assigned_to && !t.assigned_to_pokja) {
          return Response.json(
            { error: "must_provide_assigned_to_or_assigned_to_pokja" },
            { status: 400, headers: CORS },
          );
        }

        const desc = t.external_ref
          ? `${t.description ?? ""}\n\n[Ref eksternal: ${t.external_ref}]`.trim()
          : t.description ?? null;

        const { data: inserted, error: insertErr } = await supabaseAdmin
          .from("tasks")
          .insert({
            title: t.title,
            description: desc,
            priority: t.priority ?? "normal",
            deadline: t.deadline ?? null,
            assigned_to: t.assigned_to ?? null,
            assigned_to_pokja: t.assigned_to_pokja ?? null,
            assigned_by: key.created_by,
            status: "pending",
          })
          .select("id, title, status, deadline, created_at")
          .single();

        if (insertErr || !inserted) {
          return Response.json(
            { error: "insert_failed", message: insertErr?.message },
            { status: 500, headers: CORS },
          );
        }

        await supabaseAdmin
          .from("external_api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", key.id);

        await supabaseAdmin.from("activity_log").insert({
          user_id: key.created_by,
          action: "external_api.task_created",
          entity_type: "task",
          entity_id: inserted.id,
          details: { api_key_id: key.id, external_ref: t.external_ref ?? null },
        });

        return Response.json({ ok: true, task: inserted }, { status: 201, headers: CORS });
      },
    },
  },
});
