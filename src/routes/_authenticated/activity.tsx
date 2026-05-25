import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/activity")({
  component: ActivityPage,
});

interface LogRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  create_task: "Membuat penugasan",
  create_report: "Mengirim laporan",
};

function ActivityPage() {
  const { hasRole, loading: authLoading } = useAuth();
  const allowed = hasRole(["kepala", "sekretaris", "admin"]);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) return;
    (async () => {
      const [{ data: l }, { data: p }] = await Promise.all([
        supabase
          .from("activity_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200),
        supabase.from("profiles").select("id, full_name"),
      ]);
      setRows((l as LogRow[]) ?? []);
      const u: Record<string, string> = {};
      (p ?? []).forEach((x: { id: string; full_name: string }) => (u[x.id] = x.full_name));
      setUsers(u);
      setLoading(false);
    })();
  }, [allowed]);

  if (authLoading) return null;
  if (!allowed) return <Navigate to="/dashboard" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold">Riwayat Aktivitas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catatan seluruh aktivitas penting dalam sistem (200 terakhir).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Memuat…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 py-16 text-center">
          <History className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-start gap-4 px-5 py-4">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary-soft text-primary text-xs font-semibold">
                  {(users[r.user_id ?? ""] ?? "?").slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium">{users[r.user_id ?? ""] ?? "Sistem"}</span>{" "}
                    <span className="text-muted-foreground">
                      {ACTION_LABEL[r.action] ?? r.action}
                    </span>
                    {r.details && (r.details as { title?: string }).title && (
                      <> — &ldquo;{(r.details as { title: string }).title}&rdquo;</>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(r.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
