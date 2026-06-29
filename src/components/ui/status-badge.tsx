import { AlertCircle, CheckCircle2, Clock3, PackageCheck, RefreshCw, XCircle } from "lucide-react";
import { Badge } from "./badge";

const STATUS_STYLES = {
  new: {
    label: "Новый с сайта",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]",
    icon: Clock3,
  },
  processing: {
    label: "Оплачен / В обработке",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-info)_12%,white)] text-[var(--tech-color-info)]",
    icon: RefreshCw,
  },
  confirmed: {
    label: "Подтверждён",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-success)_14%,white)] text-[var(--tech-color-success)]",
    icon: CheckCircle2,
  },
  awaiting_payment: {
    label: "Ожидает оплаты",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-warning)_16%,white)] text-[var(--tech-color-warning)]",
    icon: Clock3,
  },
  paid: {
    label: "Оплачен",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-success)_14%,white)] text-[var(--tech-color-success)]",
    icon: PackageCheck,
  },
  cancelled: {
    label: "Отменён",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-danger)_14%,white)] text-[var(--tech-color-danger)]",
    icon: XCircle,
  },
  synced: {
    label: "Синхронизировано",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-success)_14%,white)] text-[var(--tech-color-success)]",
    icon: CheckCircle2,
  },
  sync_error: {
    label: "Ошибка синхронизации",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-danger)_14%,white)] text-[var(--tech-color-danger)]",
    icon: AlertCircle,
  },
  reserved: {
    label: "Зарезервировано",
    className:
      "border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]",
    icon: PackageCheck,
  },
} as const;

type StatusBadgeKey = keyof typeof STATUS_STYLES;

export function StatusBadge({
  status,
  label,
}: {
  status: StatusBadgeKey;
  label?: string;
}) {
  const config = STATUS_STYLES[status];
  const Icon = config.icon;

  return (
    <Badge className={config.className}>
      <Icon size={12} />
      {label ?? config.label}
    </Badge>
  );
}
