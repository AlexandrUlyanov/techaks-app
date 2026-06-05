import type { ReactNode } from "react";

type AdminSectionProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  tone?: "default" | "accent" | "subtle";
  contentClassName?: string;
};

const toneClasses: Record<NonNullable<AdminSectionProps["tone"]>, string> = {
  default: "border-border bg-card",
  accent:
    "border-[color:color-mix(in_srgb,var(--tech-color-primary)_24%,transparent)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_6%,white)] dark:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_9%,rgba(17,24,39,0.98))]",
  subtle: "border-border/70 bg-[var(--tech-color-surface-muted)]",
};

export default function AdminSection({
  title,
  description,
  actions,
  children,
  tone = "default",
  contentClassName = "px-6 py-6",
}: AdminSectionProps) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--tech-radius-card)] border shadow-[var(--tech-shadow-card)] ${toneClasses[tone]}`}
    >
      <div className="flex flex-col gap-3 border-b border-border/70 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-black text-foreground">{title}</h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
      <div className={contentClassName}>{children}</div>
    </section>
  );
}
