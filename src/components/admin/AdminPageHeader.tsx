import type { ReactNode } from "react";

type AdminPageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  meta?: ReactNode;
  actions?: ReactNode;
};

export default function AdminPageHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
}: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[var(--tech-radius-card)] border border-border bg-card px-6 py-5 shadow-[var(--tech-shadow-card)] lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? (
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-text-muted)]">
            {eyebrow}
          </div>
        ) : null}
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-[var(--tech-color-text-main)]">{title}</h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-[var(--tech-color-text-muted)]">
              {description}
            </p>
          ) : null}
        </div>
        {meta ? <div className="pt-1">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
