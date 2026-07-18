export const deliveryCustomerStatusValues = [
  "delivery_pending",
  "delivery_searching",
  "courier_assigned",
  "courier_arriving_to_pickup",
  "picked_up",
  "in_transit",
  "arriving_to_customer",
  "delivered",
  "delivery_cancelled",
  "delivery_problem",
] as const;

export type DeliveryCustomerStatus = (typeof deliveryCustomerStatusValues)[number];
export type DeliveryCustomerTone = "neutral" | "progress" | "success" | "warning" | "danger";
export type DeliveryTimelineItem = {
  key: string;
  label: string;
  state: "completed" | "current" | "upcoming";
};
export type DeliveryCustomerView = {
  status: DeliveryCustomerStatus;
  label: string;
  message: string;
  tone: DeliveryCustomerTone;
  isProblem: boolean;
  etaLabel: string | null;
  courier: {
    name: string | null;
    phone: string | null;
    carModel: string | null;
    carNumber: string | null;
  } | null;
  timeline: DeliveryTimelineItem[];
};

function explicitEtaLabel(from?: Date | string | null, to?: Date | string | null) {
  const parse = (value?: Date | string | null) => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const fromDate = parse(from);
  const toDate = parse(to);
  if (!fromDate && !toDate) return null;
  const format = (value: Date) => value.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (fromDate && toDate) return `${format(fromDate)} — ${format(toDate)}`;
  return format((fromDate || toDate)!);
}

function normalizeCourier(value: unknown): DeliveryCustomerView["courier"] {
  const courier = asRecord(value);
  if (!courier) return null;
  const read = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = courier[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return null;
  };
  const result = {
    name: read("name", "courierName"),
    phone: read("phone", "courierPhone"),
    carModel: read("carModel", "car_model"),
    carNumber: read("carNumber", "car_number"),
  };
  return Object.values(result).some(Boolean) ? result : null;
}

const STATUS_ALIASES: Record<string, DeliveryCustomerStatus> = {
  new: "delivery_pending",
  estimating: "delivery_pending",
  ready_for_approval: "delivery_pending",
  accepted: "delivery_pending",
  performer_lookup: "delivery_searching",
  performer_draft: "delivery_searching",
  performer_not_found: "delivery_problem",
  performer_found: "courier_assigned",
  pickup_arrived: "courier_arriving_to_pickup",
  ready_for_pickup_confirmation: "courier_arriving_to_pickup",
  pickuped: "picked_up",
  picked_up: "picked_up",
  delivery: "in_transit",
  delivering: "in_transit",
  in_transit: "in_transit",
  delivery_arrived: "arriving_to_customer",
  ready_for_delivery_confirmation: "arriving_to_customer",
  delivered: "delivered",
  delivered_finish: "delivered",
  cancelled: "delivery_cancelled",
  cancelled_with_payment: "delivery_cancelled",
  cancelled_by_taxi: "delivery_cancelled",
  cancelled_with_items_on_hands: "delivery_cancelled",
  estimating_failed: "delivery_problem",
  failed: "delivery_problem",
  returning: "delivery_problem",
  return_arrived: "delivery_problem",
  ready_for_return_confirmation: "delivery_problem",
  returned: "delivery_problem",
  returned_finish: "delivery_problem",
};

const STATUS_COPY: Record<
  DeliveryCustomerStatus,
  Pick<DeliveryCustomerView, "label" | "message" | "tone" | "isProblem">
> = {
  delivery_pending: { label: "Доставка оформляется", message: "Подготавливаем заявку и передаём её службе доставки.", tone: "neutral", isProblem: false },
  delivery_searching: { label: "Ищем курьера", message: "Служба доставки подбирает курьера для вашего заказа.", tone: "progress", isProblem: false },
  courier_assigned: { label: "Курьер назначен", message: "Курьер получил заявку и скоро направится за заказом.", tone: "progress", isProblem: false },
  courier_arriving_to_pickup: { label: "Курьер едет за заказом", message: "Курьер направляется в магазин или уже ожидает выдачу заказа.", tone: "progress", isProblem: false },
  picked_up: { label: "Заказ передан курьеру", message: "Курьер забрал заказ и готовится доставить его вам.", tone: "progress", isProblem: false },
  in_transit: { label: "Заказ в пути", message: "Курьер везёт заказ по указанному адресу.", tone: "progress", isProblem: false },
  arriving_to_customer: { label: "Курьер прибыл", message: "Курьер прибыл к адресу доставки. Пожалуйста, будьте на связи.", tone: "progress", isProblem: false },
  delivered: { label: "Заказ доставлен", message: "Доставка успешно завершена.", tone: "success", isProblem: false },
  delivery_cancelled: { label: "Доставка отменена", message: "Заявка на доставку отменена. Мы поможем уточнить дальнейшие действия.", tone: "warning", isProblem: true },
  delivery_problem: { label: "Нужно уточнить доставку", message: "Возникла сложность с доставкой. Напишите нам, и менеджер поможет.", tone: "danger", isProblem: true },
};

const TIMELINE_STEPS = [
  { key: "delivery_pending", label: "Заявка оформлена" },
  { key: "courier_assigned", label: "Курьер назначен" },
  { key: "picked_up", label: "Заказ у курьера" },
  { key: "in_transit", label: "В пути" },
  { key: "delivered", label: "Доставлен" },
] as const;

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function normalizeDeliveryCustomerStatus(
  providerStatus: string | null | undefined,
  localStatus?: string | null,
): DeliveryCustomerStatus {
  const provider = normalize(providerStatus);
  if (STATUS_ALIASES[provider]) return STATUS_ALIASES[provider];
  switch (normalize(localStatus)) {
    case "prepared": return "courier_assigned";
    case "handed_to_delivery": return "picked_up";
    case "in_delivery": return "in_transit";
    case "delivered": return "delivered";
    case "delivery_error":
    case "return_in_transit": return "delivery_problem";
    default: return "delivery_pending";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dateLabel(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return `Ожидаемое время: ${date.toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`;
}

function minutesLabel(value: unknown) {
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440) return null;
  return `Ориентировочно ${Math.max(1, Math.round(minutes))} мин.`;
}

export function extractDeliveryEtaLabel(rawPayload: unknown): string | null {
  const root = asRecord(rawPayload);
  if (!root) return null;
  const performer = asRecord(root.performer_info);
  for (const candidate of [root.estimated_delivery_at, root.expected_delivery_at, performer?.estimated_arrival_time, performer?.expected_arrival_time]) {
    const label = dateLabel(candidate);
    if (label) return label;
  }
  for (const candidate of [root.eta, root.eta_minutes, root.duration_minutes, performer?.eta_minutes]) {
    const label = minutesLabel(candidate);
    if (label) return label;
  }
  return null;
}

function buildTimeline(status: DeliveryCustomerStatus): DeliveryTimelineItem[] {
  const activeStepByStatus: Record<DeliveryCustomerStatus, number> = {
    delivery_pending: 0,
    delivery_searching: 0,
    courier_assigned: 1,
    courier_arriving_to_pickup: 1,
    picked_up: 2,
    in_transit: 3,
    arriving_to_customer: 3,
    delivered: 4,
    delivery_cancelled: 0,
    delivery_problem: 0,
  };
  const activeStep = activeStepByStatus[status];
  return TIMELINE_STEPS.map((step, index) => ({
    ...step,
    state: index < activeStep
      ? "completed" as const
      : index === activeStep
        ? "current" as const
        : "upcoming" as const,
  }));
}

export function buildDeliveryCustomerView(input: {
  providerStatus?: string | null;
  localStatus?: string | null;
  rawPayload?: unknown;
  etaFrom?: Date | string | null;
  etaTo?: Date | string | null;
  courier?: unknown;
}): DeliveryCustomerView {
  const status = normalizeDeliveryCustomerStatus(input.providerStatus, input.localStatus);
  return {
    status,
    ...STATUS_COPY[status],
    etaLabel:
      explicitEtaLabel(input.etaFrom, input.etaTo) ||
      extractDeliveryEtaLabel(input.rawPayload),
    courier: normalizeCourier(input.courier),
    timeline: buildTimeline(status),
  };
}
