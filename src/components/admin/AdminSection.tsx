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
  default: "border-gray-200 bg-white",
  accent: "border-[#05C3D4]/20 bg-[#F7FEFF]",
  subtle: "border-gray-100 bg-gray-50/70",
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
      className={`overflow-hidden rounded-2xl border shadow-sm ${toneClasses[tone]}`}
    >
      <div className="flex flex-col gap-3 border-b border-black/5 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-black text-[#15171A]">{title}</h2>
          {description ? (
            <p className="max-w-3xl text-sm leading-6 text-gray-500">
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
