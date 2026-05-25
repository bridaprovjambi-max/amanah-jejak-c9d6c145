import { cn } from "@/lib/utils";

export type TaskStatus = "pending" | "in_progress" | "completed" | "overdue";

const STATUS: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: "Menunggu", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "Berjalan", cls: "bg-primary-soft text-primary" },
  completed: { label: "Selesai", cls: "bg-success/15 text-success" },
  overdue: { label: "Terlambat", cls: "bg-destructive/15 text-destructive" },
};

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    priority === "tinggi"
      ? "bg-destructive/10 text-destructive border-destructive/20"
      : priority === "rendah"
      ? "bg-muted text-muted-foreground border-border"
      : "bg-warning/10 text-warning-foreground border-warning/30";
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide", cls)}>
      {priority}
    </span>
  );
}
