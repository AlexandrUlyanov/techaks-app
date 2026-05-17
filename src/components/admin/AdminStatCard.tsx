import type { LucideIcon } from "lucide-react";

type AdminStatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "accent" | "success" | "warning" | "danger";
};

const toneStyles: Record<
  NonNullable<AdminStatCardProps["tone"]>,
  { shell: string; icon: string; value: string }
> = {
  default: {
    shell: "border-gray-200 bg-white",
    icon: "bg-gray-100 text-gray-500",
    value: "text-[#15171A]",
  },
  accent: {
    shell: "border-[#05C3D4]/20 bg-[#F7FEFF]",
    icon: "bg-[#05C3D4]/15 text-[#0099A8]",
    value: "text-[#0099A8]",
  },
  success: {
    shell: "border-emerald-200 bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-700",
    value: "text-emerald-800",
  },
  warning: {
    shell: "border-amber-200 bg-amber-50",
    icon: "bg-amber-100 text-amber-700",
    value: "text-amber-800",
  },
  danger: {
    shell: "border-rose-200 bg-rose-50",
    icon: "bg-rose-100 text-rose-700",
    value: "text-rose-800",
  },
};

export default function AdminStatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: AdminStatCardProps) {
  const style = toneStyles[tone];

  return (
    <div className={`rounded-2xl border px-4 py-4 shadow-sm ${style.shell}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-gray-400">
            {label}
          </div>
          <div className={`text-xl font-black ${style.value}`}>{value}</div>
          {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
        </div>
        {Icon ? (
          <div
            className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${style.icon}`}
          >
            <Icon size={18} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
