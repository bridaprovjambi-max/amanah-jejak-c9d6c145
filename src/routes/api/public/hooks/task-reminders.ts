import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

interface TaskRow {
  id: string;
  title: string;
  deadline: string | null;
  status: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
  assigned_by: string;
  reminder_sent_h3: boolean;
  reminder_sent_h1: boolean;
  reminder_sent_overdue: boolean;
}

interface ProfileLite {
  id: string;
  full_name: string | null;
  telegram_chat_id: string | null;
  pokja_id: string | null;
}

async function sendTg(chatId: string, text: string) {
  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY;
  if (!LOVABLE_API_KEY || !TELEGRAM_API_KEY) return false;
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
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[task-reminders] tg send error", e);
    return false;
  }
}

export const Route = createFileRoute("/api/public/hooks/task-reminders")({
  server: {
    handlers: {
      POST: async () => {
        const now = new Date();
        const in3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        // Ambil semua tugas aktif dengan deadline dalam ≤3 hari atau sudah lewat
        const { data: tasks, error } = await supabaseAdmin
          .from("tasks")
          .select(
            "id, title, deadline, status, assigned_to, assigned_to_pokja, assigned_by, reminder_sent_h3, reminder_sent_h1, reminder_sent_overdue",
          )
          .neq("status", "completed")
          .not("deadline", "is", null)
          .lte("deadline", in3.toISOString());

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = (tasks ?? []) as TaskRow[];
        if (rows.length === 0) {
          return Response.json({ ok: true, processed: 0, sent: 0 });
        }

        // Kumpulkan target user ids
        const directIds = new Set<string>();
        const pokjaIds = new Set<string>();
        rows.forEach((t) => {
          if (t.assigned_to) directIds.add(t.assigned_to);
          if (t.assigned_to_pokja) pokjaIds.add(t.assigned_to_pokja);
        });

        // Resolve pokja members
        let pokjaMembers: ProfileLite[] = [];
        if (pokjaIds.size > 0) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, telegram_chat_id, pokja_id")
            .in("pokja_id", Array.from(pokjaIds));
          pokjaMembers = (data ?? []) as ProfileLite[];
        }

        let directProfiles: ProfileLite[] = [];
        if (directIds.size > 0) {
          const { data } = await supabaseAdmin
            .from("profiles")
            .select("id, full_name, telegram_chat_id, pokja_id")
            .in("id", Array.from(directIds));
          directProfiles = (data ?? []) as ProfileLite[];
        }

        const profileMap = new Map<string, ProfileLite>();
        [...directProfiles, ...pokjaMembers].forEach((p) =>
          profileMap.set(p.id, p),
        );

        let sent = 0;
        const updates: Array<{ id: string; patch: Partial<TaskRow> }> = [];

        for (const t of rows) {
          if (!t.deadline) continue;
          const deadline = new Date(t.deadline);
          const msLeft = deadline.getTime() - now.getTime();
          const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

          let label: "overdue" | "h1" | "h3" | null = null;
          if (msLeft < 0 && !t.reminder_sent_overdue) label = "overdue";
          else if (daysLeft <= 1 && msLeft >= 0 && !t.reminder_sent_h1) label = "h1";
          else if (daysLeft <= 3 && daysLeft > 1 && !t.reminder_sent_h3) label = "h3";
          if (!label) continue;

          // Recipient chat ids
          const targets: ProfileLite[] = [];
          if (t.assigned_to) {
            const p = profileMap.get(t.assigned_to);
            if (p) targets.push(p);
          }
          if (t.assigned_to_pokja) {
            pokjaMembers
              .filter((m) => m.pokja_id === t.assigned_to_pokja)
              .forEach((m) => targets.push(m));
          }
          const chatIds = Array.from(
            new Set(
              targets
                .map((p) => p.telegram_chat_id)
                .filter((c): c is string => !!c && c.trim().length > 0),
            ),
          );

          const deadlineStr = deadline.toLocaleDateString("id-ID", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const header =
            label === "overdue"
              ? "⚠️ <b>Penugasan TERLAMBAT</b>"
              : label === "h1"
              ? "⏰ <b>Pengingat: Tenggat 1 hari lagi</b>"
              : "🔔 <b>Pengingat: Tenggat 3 hari lagi</b>";
          const text = `${header}\n\n<b>${t.title}</b>\nTenggat: ${deadlineStr}`;

          for (const chatId of chatIds) {
            if (await sendTg(chatId, text)) sent++;
          }

          const patch: Partial<TaskRow> = {};
          if (label === "overdue") patch.reminder_sent_overdue = true;
          if (label === "h1") patch.reminder_sent_h1 = true;
          if (label === "h3") patch.reminder_sent_h3 = true;
          updates.push({ id: t.id, patch });
        }

        // Apply flag updates
        for (const u of updates) {
          await supabaseAdmin.from("tasks").update(u.patch).eq("id", u.id);
        }

        return Response.json({
          ok: true,
          processed: rows.length,
          reminders: updates.length,
          sent,
        });
      },
    },
  },
});
