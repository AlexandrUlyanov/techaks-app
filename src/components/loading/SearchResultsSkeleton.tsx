import { Skeleton } from "@/components/ui/skeleton";
import ProductCardSkeleton from "@/components/loading/ProductCardSkeleton";

export default function SearchResultsSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="hidden lg:block">
        <div className="space-y-4 rounded-[var(--tech-radius-card)] bg-card p-5">
          <Skeleton className="h-5 w-32 rounded-full bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-12 rounded-[1rem] bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-12 rounded-[1rem] bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-20 rounded-[1rem] bg-[var(--tech-color-surface-muted)]" />
        </div>
      </div>

      <div className="space-y-8">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-11 w-32 rounded-xl bg-[var(--tech-color-surface-muted)] lg:hidden" />
          <Skeleton className="ml-auto h-11 w-56 rounded-xl bg-[var(--tech-color-surface-muted)]" />
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-[var(--tech-radius-card)] bg-card p-5">
            <Skeleton className="mb-4 h-4 w-40 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-16 rounded-xl bg-[var(--tech-color-surface-muted)]"
                />
              ))}
            </div>
          </div>

          <div className="rounded-[var(--tech-radius-card)] bg-card p-5">
            <Skeleton className="mb-4 h-4 w-36 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-16 rounded-xl bg-[var(--tech-color-surface-muted)]"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <ProductCardSkeleton key={index} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
