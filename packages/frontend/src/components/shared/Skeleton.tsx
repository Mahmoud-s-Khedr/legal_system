interface SkeletonProps {
  className?: string;
}

/** Shimmer placeholder used while data loads. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-shimmer rounded-2xl bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%] ${className}`}
    />
  );
}

/** Pre-composed skeleton that matches a StatCard. */
export function StatCardSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-card">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-10 w-16" />
    </section>
  );
}

/** Pre-composed skeleton that matches a list item card. */
export function ListItemSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-32" />
    </div>
  );
}

/** Pre-composed skeleton that matches a SectionCard with its title. */
export function SectionCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <Skeleton className="mb-4 h-5 w-40" />
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton className="h-16 w-full" key={i} />
        ))}
      </div>
    </section>
  );
}
