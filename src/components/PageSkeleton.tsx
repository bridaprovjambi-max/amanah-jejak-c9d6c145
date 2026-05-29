import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  rows?: number;
  withHeader?: boolean;
  className?: string;
}

export function PageSkeleton({ rows = 4, withHeader = true, className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)} aria-busy="true" aria-live="polite">
      {withHeader ? (
        <div className="space-y-2 border-b border-border/60 pb-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      ) : null}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
            <Skeleton className="mb-2 h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
      <span className="sr-only">Memuat konten…</span>
    </div>
  );
}
