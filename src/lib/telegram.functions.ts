import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

const inputSchema = z.object({
  // Either explicit user ids or a pokja id (we'll expand to members)
  userIds: z.array(z.string().uuid()).optional(),
  pokjaId: z.string().uuid().optional(),
  message: z.string().min(1).max(3500),
});

export const sendTelegramNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Resolve target chat IDs
    let targetIds: string[] = data.userIds ?? [];
    if (data.pokjaId) {
      const { data: members } = await supabase
        .from("profiles")
        .select("id")
        .eq("pokja_id", data.pokjaId);
      targetIds = targetIds.concat((members ?? []).map((m) => m.id));
    }
    if (targetIds.length === 0) return { sent: 0, skipped: 0, reason: "no_targets" };

    const { data: profs } = await supabase
      .from("profiles")
      .select("id, telegram_chat_id")
      .in("id", targetIds);

    const chatIds = (profs ?? [])
      .map((p: { telegram_chat_id: string | null }) => p.telegram_chat_id)
      .filter((c): c is string => !!c && c.trim().length > 0);

    if (chatIds.length === 0) return { sent: 0, skipped: targetIds.length, reason: "no_chat_ids" };

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
    if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) {
      console.warn("[telegram] connector not configured — skipping send");
      return { sent: 0, skipped: chatIds.length, reason: "connector_missing" };
    }

    let sent = 0;
    for (const chatId of chatIds) {
      try {
        const res = await fetch(`${GATEWAY_URL}/sendMessage`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TELEGRAM_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: data.message,
            parse_mode: "HTML",
            disable_web_page_preview: true,
          }),
        });
        if (res.ok) sent++;
        else console.error(`[telegram] ${res.status}`, await res.text());
      } catch (e) {
        console.error("[telegram] send error", e);
      }
    }
    return { sent, skipped: chatIds.length - sent };
  });
