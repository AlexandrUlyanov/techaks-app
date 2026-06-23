import { Skeleton } from "@/components/ui/skeleton";
import ProductCardSkeleton from "@/components/loading/ProductCardSkeleton";

export default function CatalogListingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr]">
      <div className="hidden lg:block">
        <div className="sticky top-[var(--header-height,96px)] space-y-5">
          <Skeleton className="h-10 w-20 rounded-full bg-[var(--tech-color-surface-muted)]" />
          <div className="space-y-4">
            <Skeleton className="h-16 rounded-[1.35rem] bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-24 rounded-[1.35rem] bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-24 rounded-[1.35rem] bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-24 rounded-[1.35rem] bg-[var(--tech-color-surface-muted)]" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-3 py-1 md:py-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-5 w-52 rounded-full bg-[var(--tech-color-surface-muted)]" />
              <Skeleton className="h-4 w-28 rounded-full bg-[var(--tech-color-surface-muted)]" />
            </div>
            <div className="hidden items-center gap-3 md:flex">
              <Skeleton className="h-11 w-[220px] rounded-full bg-[var(--tech-color-surface-muted)]" />
              <Skeleton className="h-11 w-[88px] rounded-full bg-[var(--tech-color-surface-muted)]" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-8 w-36 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-8 w-44 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-8 w-28 rounded-full bg-[var(--tech-color-surface-muted)]" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <ProductCardSkeleton key={index} compact />
          ))}
        </div>
      </div>
    </div>
  );
}
