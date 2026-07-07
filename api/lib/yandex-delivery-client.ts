import { TRPCError } from "@trpc/server";
import { getYandexDeliveryRuntimeSettings } from "./yandex-delivery-settings";

type CreateClaimInput = {
  sourceAddress: string;
  destinationAddress: string;
  customerPhone: string;
  customerName?: string | null;
  customerComment?: string | null;
  orderNumber: string;
  itemSummary?: string | null;
  totalPrice?: number | null;
};

type YandexDeliveryStatusPayload = {
  simple: string | null;
  full: string | null;
  description: string | null;
};

type RoutePointAddress = {
  fullname: string;
  coordinates?: [number, number];
};

type RoutePointWithAddress = {
  id?: number;
  point_id?: number;
  visit_order?: number;
  type?: string;
  address?: RoutePointAddress;
  fullname?: string;
  coordinates?: [number, number];
  contact?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  external_order_id?: string;
  external_order_cost?: {
    value: string;
    currency: string;
  };
};

type ClaimInfoPayload = {
  id?: string;
  version?: number;
  status?: string;
  route_points?: RoutePointWithAddress[];
  items?: unknown[];
  performer_info?: Record<string, unknown> | null;
  available_cancel_state?: string | null;
  [key: string]: unknown;
};

type CancelInfoPayload = {
  cancel_state?: "free" | "paid" | "unavailable" | null;
  price?: unknown;
  price_with_vat?: unknown;
  [key: string]: unknown;
};

type DeliveryOfferPayload = {
  offers?: unknown[];
  [key: string]: unknown;
};

const DEFAULT_PICKUP_COORDINATES: [number, number] = [45.0183, 53.1959];
const DEFAULT_DESTINATION_COORDINATES: [number, number] = [44.920956, 53.222379];

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function normalizeBearerToken(token: string) {
  const normalized = token.trim();
  return /^bearer\s+/i.test(normalized) ? normalized : `Bearer ${normalized}`;
}

function ensureNonEmpty(value: string | null | undefined, message: string) {
  const normalized = (value || "").trim();
  if (!normalized) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }
  return normalized;
}

function toMoneyString(value: number | null | undefined) {
  const normalized = Number.isFinite(value) ? Number(value) : 0;
  return normalized.toFixed(2);
}

function buildStatusPayload(
  status: string | null | undefined,
  description?: string | null,
) : YandexDeliveryStatusPayload {
  const normalized = (status || "").trim() || null;
  return {
    simple: normalized,
    full: normalized,
    description: description?.trim() || null,
  };
}

function extractStatusValue(
  input:
    | string
    | { simple?: string | null; full?: string | null; description?: string | null }
    | null
    | undefined,
) {
  if (!input) return "";
  if (typeof input === "string") return input.trim().toLowerCase();
  return ((input.full || input.simple || "").trim().toLowerCase());
}

export function mapYandexDeliveryStatusToLocal(
  status:
    | string
    | { simple?: string | null; full?: string | null; description?: string | null }
    | null
    | undefined,
) {
  switch (extractStatusValue(status)) {
    case "new":
    case "estimating":
    case "ready_for_approval":
    case "accepted":
    case "performer_lookup":
    case "performer_draft":
    case "performer_not_found":
      return "awaiting_processing";
    case "performer_found":
    case "pickup_arrived":
    case "ready_for_pickup_confirmation":
      return "prepared";
    case "pickuped":
      return "handed_to_delivery";
    case "delivery_arrived":
    case "ready_for_delivery_confirmation":
      return "in_delivery";
    case "delivered":
    case "delivered_finish":
      return "delivered";
    case "returning":
    case "return_arrived":
    case "ready_for_return_confirmation":
    case "returned":
    case "returned_finish":
    case "failed":
    case "estimating_failed":
    case "cancelled":
    case "cancelled_with_payment":
    case "cancelled_by_taxi":
    case "cancelled_with_items_on_hands":
      return "delivery_error";
    default:
      return "awaiting_processing";
  }
}

async function readResponsePayload<T = Record<string, unknown>>(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { raw: text } as T;
  }
}

async function yandexDeliveryRequest<TPayload = Record<string, unknown>>(
  path: string,
  init: RequestInit = {},
) {
  const settings = await getYandexDeliveryRuntimeSettings();
  if (!settings.enabled) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Яндекс Доставка отключена в настройках.",
    });
  }
  if (!settings.accessToken.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Токен Яндекс Доставки не настроен.",
    });
  }
  if (!settings.selectedCorpClientId.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Не указан ID корпоративного клиента Яндекс Доставки. Заполните его в настройках.",
    });
  }

  const response = await fetch(`${normalizeBaseUrl(settings.apiBaseUrl)}${path}`, {
    ...init,
    headers: {
      Authorization: normalizeBearerToken(settings.accessToken),
      Accept: "application/json",
      "Accept-Language": "ru",
      "Content-Type": "application/json",
      "X-YaTaxi-Selected-Corp-Client-Id": settings.selectedCorpClientId.trim(),
      ...(init.headers || {}),
    },
  });

  const payload = await readResponsePayload<TPayload & { message?: string; code?: string }>(response);
  if (!response.ok) {
    const message =
      typeof payload?.message === "string"
        ? payload.message
        : typeof (payload as any)?.raw === "string"
          ? (payload as any).raw
          : `Яндекс Доставка вернула HTTP ${response.status}`;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message,
    });
  }

  return {
    payload: payload as TPayload,
    settings,
  };
}

function buildOfferRoutePoint(
  id: number,
  fullname: string,
  coordinates: [number, number],
) {
  return {
    id,
    fullname,
    coordinates,
  };
}

function buildClaimRoutePoint(params: {
  pointId: number;
  visitOrder: number;
  type: "source" | "destination";
  fullname: string;
  coordinates: [number, number];
  contactName: string;
  contactPhone: string;
  externalOrderId?: string;
  externalOrderCost?: number | null;
}) {
  return {
    point_id: params.pointId,
    visit_order: params.visitOrder,
    type: params.type,
    contact: {
      name: params.contactName,
      phone: params.contactPhone,
    },
    address: {
      fullname: params.fullname,
      coordinates: params.coordinates,
    },
    ...(params.externalOrderId
      ? {
          external_order_id: params.externalOrderId,
        }
      : {}),
    ...(typeof params.externalOrderCost === "number"
      ? {
          external_order_cost: {
            value: toMoneyString(params.externalOrderCost),
            currency: "RUB",
          },
        }
      : {}),
  };
}

async function getClaimInfoInternal(claimId: string) {
  const normalizedClaimId = ensureNonEmpty(
    claimId,
    "Не указан claim ID Яндекс Доставки.",
  );
  const result = await yandexDeliveryRequest<ClaimInfoPayload>(
    `/b2b/cargo/integration/v2/claims/info?claim_id=${encodeURIComponent(normalizedClaimId)}`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  return result.payload;
}

async function acceptClaimIfNeeded(claimId: string) {
  const info = await getClaimInfoInternal(claimId);
  if (info.status !== "ready_for_approval") {
    return {
      accepted: false,
      info,
      raw: null,
    };
  }

  const version = info.version;
  if (typeof version !== "number") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Яндекс Доставка не вернула version для подтверждения заявки.",
    });
  }

  const acceptResult = await yandexDeliveryRequest<ClaimInfoPayload>(
    `/b2b/cargo/integration/v2/claims/accept?claim_id=${encodeURIComponent(claimId)}`,
    {
      method: "POST",
      body: JSON.stringify({ version }),
    },
  );

  return {
    accepted: true,
    info: acceptResult.payload,
    raw: acceptResult.payload,
  };
}

export async function calculateYandexDeliveryOffers(params: {
  sourceAddress: string;
  destinationAddress: string;
}) {
  const sourceAddress = ensureNonEmpty(
    params.sourceAddress,
    "Не указан адрес отправления для расчёта доставки.",
  );
  const destinationAddress = ensureNonEmpty(
    params.destinationAddress,
    "Не указан адрес назначения для расчёта доставки.",
  );

  const result = await yandexDeliveryRequest<DeliveryOfferPayload>(
    "/b2b/cargo/integration/v2/offers/calculate",
    {
      method: "POST",
      body: JSON.stringify({
        route_points: [
          buildOfferRoutePoint(1, sourceAddress, DEFAULT_PICKUP_COORDINATES),
          buildOfferRoutePoint(2, destinationAddress, DEFAULT_DESTINATION_COORDINATES),
        ],
        requirements: {
          taxi_classes: ["express"],
        },
      }),
    },
  );

  return result.payload;
}

export async function createAndProcessYandexDeliveryOrder(input: CreateClaimInput) {
  const sourceAddress = ensureNonEmpty(
    input.sourceAddress,
    "Для Яндекс Доставки нужен адрес отправления.",
  );
  const destinationAddress = ensureNonEmpty(
    input.destinationAddress,
    "Для Яндекс Доставки нужен адрес назначения.",
  );
  const customerPhone = ensureNonEmpty(
    input.customerPhone,
    "Для Яндекс Доставки нужен телефон клиента.",
  );
  const orderNumber = ensureNonEmpty(
    input.orderNumber,
    "Для Яндекс Доставки нужен номер заказа.",
  );

  const itemTitle = (input.itemSummary || "").trim() || `Заказ ${orderNumber}`;
  const customerName = (input.customerName || "").trim() || "Получатель";

  const claimBody = {
    items: [
      {
        extra_id: orderNumber,
        pickup_point: 1,
        droppof_point: 2,
        title: itemTitle.slice(0, 128),
        quantity: 1,
        cost_currency: "RUB",
        cost_value: toMoneyString(input.totalPrice ?? 0),
      },
    ],
    route_points: [
      buildClaimRoutePoint({
        pointId: 1,
        visitOrder: 1,
        type: "source",
        fullname: sourceAddress,
        coordinates: DEFAULT_PICKUP_COORDINATES,
        contactName: "ТЕХАКС",
        contactPhone: customerPhone,
      }),
      buildClaimRoutePoint({
        pointId: 2,
        visitOrder: 2,
        type: "destination",
        fullname: destinationAddress,
        coordinates: DEFAULT_DESTINATION_COORDINATES,
        contactName: customerName,
        contactPhone: customerPhone,
        externalOrderId: orderNumber,
        externalOrderCost: input.totalPrice ?? 0,
      }),
    ],
    emergency_contact: {
      name: customerName,
      phone: customerPhone,
    },
    client_requirements: {
      taxi_class: "express",
    },
    comment: (input.customerComment || "").trim() || itemTitle,
    skip_client_notify: false,
    skip_emergency_notify: false,
  };

  const requestId = `techaks-order-${orderNumber}`;
  const createResult = await yandexDeliveryRequest<ClaimInfoPayload>(
    `/b2b/cargo/integration/v2/claims/create?request_id=${encodeURIComponent(requestId)}`,
    {
      method: "POST",
      body: JSON.stringify(claimBody),
    },
  );

  const claimId = ensureNonEmpty(
    createResult.payload?.id,
    "Яндекс Доставка не вернула claim ID. Заявка не создана.",
  );

  const acceptResult = await acceptClaimIfNeeded(claimId);
  const finalInfo = acceptResult.info || (await getClaimInfoInternal(claimId));
  const status = buildStatusPayload(finalInfo.status, null);

  return {
    providerOrderId: claimId,
    providerOfferId: requestId,
    status,
    raw: {
      create: createResult.payload,
      accept: acceptResult.raw,
      info: finalInfo,
    },
  };
}

export async function getYandexDeliveryOrderInfo(providerOrderId: string) {
  const payload = await getClaimInfoInternal(providerOrderId);
  return {
    providerOrderId,
    version: typeof payload.version === "number" ? payload.version : null,
    status: buildStatusPayload(payload.status, null),
    raw: payload,
  };
}

export async function cancelYandexDeliveryOrder(providerOrderId: string) {
  const info = await getClaimInfoInternal(providerOrderId);
  const version = info.version;
  if (typeof version !== "number") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Яндекс Доставка не вернула version для отмены заявки.",
    });
  }

  const cancelInfoResult = await yandexDeliveryRequest<CancelInfoPayload>(
    `/b2b/cargo/integration/v2/claims/cancel-info?claim_id=${encodeURIComponent(providerOrderId)}`,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );

  const cancelState = cancelInfoResult.payload?.cancel_state;
  if (!cancelState || cancelState === "unavailable") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Эту заявку уже нельзя отменить через API. Нужна отмена через поддержку Яндекс Доставки.",
    });
  }

  const cancelResult = await yandexDeliveryRequest<ClaimInfoPayload>(
    `/b2b/cargo/integration/v2/claims/cancel?claim_id=${encodeURIComponent(providerOrderId)}`,
    {
      method: "POST",
      body: JSON.stringify({
        version,
        cancel_state: cancelState,
      }),
    },
  );

  return {
    providerOrderId,
    version: typeof cancelResult.payload?.version === "number" ? cancelResult.payload.version : version,
    status: buildStatusPayload(cancelResult.payload?.status || "cancelled", null),
    raw: {
      cancelInfo: cancelInfoResult.payload,
      cancel: cancelResult.payload,
    },
  };
}
