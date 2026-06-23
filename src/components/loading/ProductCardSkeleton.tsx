import { Skeleton } from "@/components/ui/skeleton";

type ProductCardSkeletonProps = {
  compact?: boolean;
};

export default function ProductCardSkeleton({
  compact = false,
}: ProductCardSkeletonProps) {
  return (
    <div className="overflow-hidden rounded-[2rem] bg-[var(--tech-color-surface)]">
      <div className="p-4">
        <Skeleton className="h-56 rounded-[1.5rem] bg-[var(--tech-color-surface-muted)]" />
        <div className="mt-5 space-y-3">
          <Skeleton className="h-4 w-20 rounded-full bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-6 w-full rounded-full bg-[var(--tech-color-surface-muted)]" />
          {!compact ? (
            <Skeleton className="h-6 w-4/5 rounded-full bg-[var(--tech-color-surface-muted)]" />
          ) : null}
          <Skeleton className="h-4 w-24 rounded-full bg-[var(--tech-color-surface-muted)]" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 pb-4">
        <Skeleton className="h-10 w-28 rounded-full bg-[var(--tech-color-surface-muted)]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-11 w-11 rounded-full bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-11 w-11 rounded-full bg-[var(--tech-color-surface-muted)]" />
        </div>
      </div>
    </div>
  );
}
