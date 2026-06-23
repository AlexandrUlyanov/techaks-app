import { Skeleton } from "@/components/ui/skeleton";

export default function ProductPageSkeleton() {
  return (
    <div className="min-h-screen bg-background pb-24">
      <section className="py-6 md:py-12">
        <div className="container-main space-y-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(480px,1.08fr)_minmax(420px,0.92fr)] xl:grid-cols-[minmax(560px,1.12fr)_minmax(460px,0.88fr)] xl:gap-14">
            <div className="order-1 lg:sticky lg:top-24">
              <div className="grid gap-4 md:grid-cols-[88px_minmax(0,1fr)]">
                <div className="hidden space-y-3 md:flex md:flex-col">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <Skeleton
                      key={index}
                      className="h-[76px] w-[76px] rounded-2xl bg-[var(--tech-color-surface-muted)]"
                    />
                  ))}
                </div>
                <Skeleton className="min-h-[520px] rounded-[2rem] bg-[var(--tech-color-surface-muted)]" />
              </div>
            </div>

            <div className="order-2 space-y-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-28 rounded-xl bg-[var(--tech-color-surface-muted)]" />
                <Skeleton className="h-4 w-48 rounded-full bg-[var(--tech-color-surface-muted)]" />
                <Skeleton className="h-14 w-full rounded-[1.25rem] bg-[var(--tech-color-surface-muted)]" />
                <Skeleton className="h-14 w-4/5 rounded-[1.25rem] bg-[var(--tech-color-surface-muted)]" />
              </div>

              <div className="space-y-4 rounded-[2rem] bg-[var(--tech-color-surface)] p-5">
                <Skeleton className="h-12 w-40 rounded-full bg-[var(--tech-color-surface-muted)]" />
                <Skeleton className="h-14 rounded-[1.2rem] bg-[var(--tech-color-surface-muted)]" />
                <Skeleton className="h-12 w-48 rounded-[1.2rem] bg-[var(--tech-color-surface-muted)]" />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-24 rounded-[1.4rem] bg-[var(--tech-color-surface-muted)]"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton
                  key={index}
                  className="h-12 w-36 rounded-full bg-[var(--tech-color-surface-muted)]"
                />
              ))}
            </div>
            <div className="rounded-[2rem] bg-[var(--tech-color-surface)] p-6">
              <Skeleton className="h-6 w-44 rounded-full bg-[var(--tech-color-surface-muted)]" />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={index}
                    className="h-24 rounded-[1.4rem] bg-[var(--tech-color-surface-muted)]"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
