import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

export function RouteProgressBar() {
  const location = useLocation();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressTimersRef = useRef<number[]>([]);
  const locationSignatureRef = useRef(location.pathname);
  const navigationStartedRef = useRef(false);

  const clearProgressTimers = useCallback(() => {
    progressTimersRef.current.forEach(timerId => window.clearTimeout(timerId));
    progressTimersRef.current = [];
  }, []);

  const scheduleTimer = useCallback((callback: () => void, delay: number) => {
    const timerId = window.setTimeout(callback, delay);
    progressTimersRef.current.push(timerId);
  }, []);

  const startProgress = useCallback(() => {
    if (prefersReducedMotion) return;

    clearProgressTimers();
    navigationStartedRef.current = true;
    setVisible(true);
    setProgress(12);

    requestAnimationFrame(() => setProgress(42));
    scheduleTimer(() => setProgress(68), 150);
    scheduleTimer(() => setProgress(84), 520);
  }, [clearProgressTimers, prefersReducedMotion, scheduleTimer]);

  const finishProgress = useCallback(() => {
    if (prefersReducedMotion) return;

    clearProgressTimers();
    setVisible(true);
    setProgress(100);
    scheduleTimer(() => {
      setVisible(false);
      setProgress(0);
      navigationStartedRef.current = false;
    }, 260);
  }, [clearProgressTimers, prefersReducedMotion, scheduleTimer]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const handleDocumentClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;

      const currentPath = window.location.pathname;
      const nextPath = destination.pathname;
      if (currentPath === nextPath) return;

      startProgress();
    };

    const handlePopState = () => startProgress();

    document.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("popstate", handlePopState);
    };
  }, [prefersReducedMotion, startProgress]);

  useEffect(() => {
    const nextSignature = location.pathname;
    if (locationSignatureRef.current === nextSignature) return;

    locationSignatureRef.current = nextSignature;
    if (!navigationStartedRef.current) {
      startProgress();
    }
    finishProgress();
  }, [finishProgress, location.pathname, startProgress]);

  if (prefersReducedMotion || !visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[120] h-[3px] overflow-hidden">
      <div
        className="route-progress-bar h-full rounded-r-full bg-[#05C3D4]"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </div>
  );
}

export function PublicRouteFallback() {
  return (
    <div className="container-main py-8 md:py-10">
      <div className="space-y-8">
        <div className="space-y-4">
          <Skeleton className="h-4 w-24 rounded-full bg-[#05C3D4]/10" />
          <Skeleton className="h-12 w-full max-w-[28rem] rounded-[1.75rem] bg-[var(--tech-color-surface-muted)]" />
          <Skeleton className="h-5 w-full max-w-[42rem] rounded-full bg-[var(--tech-color-surface-muted)]" />
        </div>

        <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3 rounded-[1.75rem] bg-[var(--tech-color-surface)]/70 p-4">
            <Skeleton className="h-12 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-12 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-12 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="h-12 rounded-full bg-[var(--tech-color-surface-muted)]" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-[2rem] bg-[var(--tech-color-surface)]/82 p-4"
              >
                <Skeleton className="h-52 rounded-[1.5rem] bg-[var(--tech-color-surface-muted)]" />
                <div className="mt-5 space-y-3">
                  <Skeleton className="h-6 w-4/5 rounded-full bg-[var(--tech-color-surface-muted)]" />
                  <Skeleton className="h-4 w-2/5 rounded-full bg-[var(--tech-color-surface-muted)]" />
                  <Skeleton className="h-4 w-3/5 rounded-full bg-[var(--tech-color-surface-muted)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminRouteFallback() {
  return (
    <div className="space-y-6 p-6 md:p-8">
      <div className="rounded-[var(--tech-radius-card)] bg-card p-6">
        <Skeleton className="h-8 w-64 rounded-xl bg-[var(--tech-color-surface-muted)]" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl rounded-full bg-[var(--tech-color-surface-muted)]" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div
            key={index}
            className="rounded-[var(--tech-radius-card)] bg-card p-5"
          >
            <Skeleton className="h-5 w-28 rounded-full bg-[var(--tech-color-surface-muted)]" />
            <Skeleton className="mt-4 h-20 rounded-[1.25rem] bg-[var(--tech-color-surface-muted)]" />
          </div>
        ))}
      </div>

      <div className="rounded-[var(--tech-radius-card)] bg-card p-5">
        <Skeleton className="h-12 rounded-[1.25rem] bg-[var(--tech-color-surface-muted)]" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-14 rounded-[1rem] bg-[var(--tech-color-surface-muted)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
