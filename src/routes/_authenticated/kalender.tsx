import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { StatusBadge, type TaskStatus } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/kalender")({
  component: KalenderPage,
});

interface CalTask {
  id: string;
  title: string;
  deadline: string;
  status: TaskStatus;
  priority: string;
  assigned_to: string | null;
  assigned_to_pokja: string | null;
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function KalenderPage() {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [tasks, setTasks] = useState<CalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date());

  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("tasks")
      .select("id,title,deadline,status,priority,assigned_to,assigned_to_pokja")
      .not("deadline", "is", null)
      .gte("deadline", gridStart.toISOString())
      .lte("deadline", gridEnd.toISOString())
      .order("deadline", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error(error);
        setTasks((data ?? []) as CalTask[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cursor]);

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [cursor],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalTask[]>();
    for (const t of tasks) {
      const key = format(new Date(t.deadline), "yyyy-MM-dd");
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [tasks]);

  const selectedTasks = selectedDay
    ? tasksByDay.get(format(selectedDay, "yyyy-MM-dd")) ?? []
    : [];

  const statusColor = (s: TaskStatus) => {
    switch (s) {
      case "completed":
        return "bg-emerald-500";
      case "in_progress":
        return "bg-blue-500";
      case "pending":
        return "bg-amber-500";
      case "overdue":
        return "bg-rose-500";
      default:
        return "bg-muted-foreground";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-display font-semibold">
            <CalendarDays className="h-6 w-6 text-primary" />
            Kalender Penugasan
          </h1>
          <p className="text-sm text-muted-foreground">
            Visualisasi tugas berdasarkan deadline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Bulan sebelumnya" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-[160px] text-center font-medium" aria-live="polite">
            {format(cursor, "MMMM yyyy", { locale: localeId })}
          </div>
          <Button variant="outline" size="icon" aria-label="Bulan berikutnya" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setCursor(startOfMonth(new Date())); setSelectedDay(new Date()); }}>
            Hari Ini
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/40 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-2 py-2 text-center">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const isSel = selectedDay && isSameDay(day, selectedDay);
              const hasOverdue = dayTasks.some(
                (t) => t.status !== "completed" && new Date(t.deadline) < new Date(),
              );
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "min-h-[88px] border-b border-r p-1.5 text-left transition hover:bg-muted/50",
                    !inMonth && "bg-muted/20 text-muted-foreground",
                    isSel && "ring-2 ring-inset ring-primary",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(day) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {hasOverdue && (
                      <AlertTriangle className="h-3 w-3 text-rose-500" />
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5">
                    {dayTasks.slice(0, 3).map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center gap-1 truncate text-[10px] leading-tight"
                      >
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusColor(t.status))} />
                        <span className="truncate">{t.title}</span>
                      </div>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayTasks.length - 3} lainnya
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-semibold">
            {selectedDay ? format(selectedDay, "EEEE, d MMMM yyyy", { locale: localeId }) : "Pilih tanggal"}
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Memuat...</p>
          ) : selectedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Tidak ada tugas pada tanggal ini.</p>
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((t) => {
                const overdue = t.status !== "completed" && new Date(t.deadline) < new Date();
                return (
                  <li key={t.id}>
                    <Link
                      to="/tasks/$taskId"
                      params={{ taskId: t.id }}
                      className="block rounded-md border p-3 transition hover:bg-muted/40"
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="font-medium leading-tight">{t.title}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{format(new Date(t.deadline), "HH:mm")}</span>
                        {t.priority !== "normal" && (
                          <span className="rounded bg-muted px-1.5 py-0.5 uppercase">{t.priority}</span>
                        )}
                        {overdue && (
                          <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-medium text-rose-600">
                            Overdue
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-6 space-y-2 border-t pt-4 text-xs">
            <div className="font-medium text-muted-foreground">Legenda Status</div>
            {[
              { s: "pending" as TaskStatus, l: "Pending" },
              { s: "in_progress" as TaskStatus, l: "On Progress" },
              { s: "completed" as TaskStatus, l: "Selesai" },
              { s: "overdue" as TaskStatus, l: "Overdue" },
            ].map((x) => (
              <div key={x.s} className="flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full", statusColor(x.s))} />
                <span>{x.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
