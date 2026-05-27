import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { sendTelegramNotification } from "@/lib/telegram.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Trash2, AtSign } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge, type TaskStatus } from "@/components/StatusBadge";

interface ProfileLite {
  id: string;
  full_name: string;
}

interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  mentioned_user_ids: string[];
  created_at: string;
}

interface StatusEvent {
  id: string;
  task_id: string;
  changed_by: string | null;
  from_status: TaskStatus | null;
  to_status: TaskStatus;
  created_at: string;
}

interface Props {
  taskId: string;
  taskTitle: string;
  profiles: ProfileLite[];
}

/** Parse @mentions by matching against known profile names (case-insensitive, first/full name segments).
 *  Names with spaces may be referenced via underscores: e.g. @Budi_Santoso. */
function parseMentions(text: string, profiles: ProfileLite[]): string[] {
  const tokens = Array.from(text.matchAll(/@([A-Za-z0-9_.\-]+)/g)).map((m) =>
    m[1].replace(/_/g, " ").toLowerCase().trim(),
  );
  if (tokens.length === 0) return [];
  const ids = new Set<string>();
  for (const t of tokens) {
    const hit = profiles.find((p) => {
      const full = p.full_name.toLowerCase();
      if (full === t) return true;
      if (full.startsWith(t + " ")) return true;
      // also allow first-name match
      const first = full.split(" ")[0];
      return first === t;
    });
    if (hit) ids.add(hit.id);
  }
  return Array.from(ids);
}

function renderContent(text: string) {
  const parts = text.split(/(@[A-Za-z0-9_.\-]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="font-medium text-primary">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

const statusLabel = (s: TaskStatus | null) =>
  !s ? "—" : s === "completed" ? "Selesai" : s === "in_progress" ? "Berjalan" : s === "pending" ? "Menunggu" : "Overdue";

export function TaskComments({ taskId, taskTitle, profiles }: Props) {
  const { user, profile } = useAuth();
  const notify = useServerFn(sendTelegramNotification);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<StatusEvent[]>([]);
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const profileMap = profiles.reduce<Record<string, string>>((acc, p) => {
    acc[p.id] = p.full_name;
    return acc;
  }, {});

  const load = async () => {
    const [{ data: c }, { data: h }] = await Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_status_history").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
    ]);
    setComments((c as Comment[]) ?? []);
    setHistory((h as StatusEvent[]) ?? []);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`task_comments_${taskId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_comments", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_status_history", filter: `task_id=eq.${taskId}` },
        () => load(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const onChange = (val: string) => {
    setContent(val);
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? val.length;
    const upto = val.slice(0, pos);
    const m = upto.match(/@([A-Za-z0-9_.\-]*)$/);
    if (m) {
      setMentionQuery(m[1].toLowerCase());
      setShowMentions(true);
    } else {
      setShowMentions(false);
    }
  };

  const insertMention = (p: ProfileLite) => {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? content.length;
    const before = content.slice(0, pos).replace(/@([A-Za-z0-9_.\-]*)$/, "");
    const after = content.slice(pos);
    const token = "@" + p.full_name.replace(/\s+/g, "_") + " ";
    const next = before + token + after;
    setContent(next);
    setShowMentions(false);
    requestAnimationFrame(() => {
      el.focus();
      const cursor = (before + token).length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  const filteredMentions = profiles
    .filter((p) => p.full_name.toLowerCase().includes(mentionQuery))
    .slice(0, 6);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (text.length < 1) return;
    setBusy(true);
    const mentions = parseMentions(text, profiles);
    const { data: row, error } = await supabase
      .from("task_comments")
      .insert({
        task_id: taskId,
        author_id: user!.id,
        content: text,
        mentioned_user_ids: mentions,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      setBusy(false);
      return;
    }
    setContent("");
    setComments((prev) => [...prev, row as Comment]);

    // Telegram notify mentioned users (excluding the author)
    const recipients = mentions.filter((id) => id !== user!.id);
    if (recipients.length > 0) {
      const msg =
        `<b>💬 Anda disebut dalam komentar</b>\n` +
        `Tugas: <b>${taskTitle}</b>\n` +
        `Oleh: ${profile?.full_name ?? "—"}\n\n` +
        text.slice(0, 1500);
      notify({ data: { userIds: recipients, message: msg } }).catch((err) =>
        console.error("notify error", err),
      );
    }
    setBusy(false);
  };

  const remove = async (c: Comment) => {
    if (!confirm("Hapus komentar ini?")) return;
    const { error } = await supabase.from("task_comments").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  };

  // Merge comments + status events into one timeline
  type TimelineItem =
    | { kind: "comment"; at: string; data: Comment }
    | { kind: "status"; at: string; data: StatusEvent };
  const timeline: TimelineItem[] = [
    ...comments.map<TimelineItem>((c) => ({ kind: "comment", at: c.created_at, data: c })),
    ...history.map<TimelineItem>((h) => ({ kind: "status", at: h.created_at, data: h })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Diskusi & Riwayat</h2>
        <span className="text-xs text-muted-foreground">{comments.length} komentar</span>
      </div>

      {timeline.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Belum ada diskusi. Mulai percakapan di bawah.
        </p>
      ) : (
        <ol className="space-y-3">
          {timeline.map((item) => {
            if (item.kind === "status") {
              const h = item.data;
              const who = h.changed_by ? profileMap[h.changed_by] ?? "Pengguna" : "Sistem";
              return (
                <li
                  key={`s-${h.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs"
                >
                  <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString("id-ID")}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-medium">{who}</span>
                  <span className="text-muted-foreground">mengubah status</span>
                  {h.from_status && (
                    <>
                      <StatusBadge status={h.from_status} />
                      <span className="text-muted-foreground">→</span>
                    </>
                  )}
                  <StatusBadge status={h.to_status} />
                  {!h.from_status && <span className="text-muted-foreground">(awal: {statusLabel(h.to_status)})</span>}
                </li>
              );
            }
            const c = item.data;
            const author = profileMap[c.author_id] ?? "Pengguna";
            const canDelete = user?.id === c.author_id;
            return (
              <li key={`c-${c.id}`} className="rounded-xl border border-border bg-background/60 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="grid h-7 w-7 place-items-center rounded-full bg-primary-soft text-primary text-[10px] font-semibold">
                      {author.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{author}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(c.created_at).toLocaleString("id-ID")}
                      </div>
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(c)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Hapus komentar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm whitespace-pre-wrap break-words">
                  {renderContent(c.content)}
                </p>
              </li>
            );
          })}
        </ol>
      )}

      <form onSubmit={submit} className="space-y-2 relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder="Tulis komentar… gunakan @ untuk menyebut rekan kerja"
          maxLength={2000}
        />
        {showMentions && filteredMentions.length > 0 && (
          <div className="absolute z-10 left-0 right-0 -top-2 -translate-y-full max-w-xs rounded-lg border border-border bg-popover shadow-lg p-1">
            {filteredMentions.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => insertMention(p)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left hover:bg-muted"
              >
                <AtSign className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{p.full_name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            Tag rekan dengan <code className="rounded bg-muted px-1">@Nama</code> — mereka akan dapat notifikasi Telegram.
          </p>
          <Button type="submit" size="sm" disabled={busy || content.trim().length === 0}>
            <Send className="mr-2 h-3.5 w-3.5" /> {busy ? "Mengirim…" : "Kirim"}
          </Button>
        </div>
      </form>
    </div>
  );
}
