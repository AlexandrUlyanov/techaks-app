import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AdminCard({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]",
        className
      )}
    >
      {title ? (
        <div className="mb-4 space-y-1">
          <h3 className="text-base font-black text-[var(--tech-color-text-main)]">
            {title}
          </h3>
          {description ? (
            <p className="text-sm text-[var(--tech-color-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
