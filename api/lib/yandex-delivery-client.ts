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

export type YandexDeliveryQuote = {
  available: boolean;
  price: number | null;
  currency: string;
  etaMinutes: number | null;
  etaLabel: string | null;
  offerId: string | null;
  message: string | null;
  raw: DeliveryOfferPayload | null;
};

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

function normalizeYandexRouteFullname(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  const hasRussia = /росси/i.test(normalized);
  const hasPenza = /пенз/i.test(normalized);

  if (hasRussia) {
    return normalized;
  }

  if (hasPenza) {
    return `Россия, ${normalized}`;
  }

  return `Россия, Пенза, ${normalized}`;
}

function buildYandexRouteFullnameCandidates(value: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) return [];

  const candidates = [
    normalizeYandexRouteFullname(normalized),
    /пенз/i.test(normalized) ? `Россия, ${normalized}` : `Пенза, ${normalized}`,
    `Россия, Пензенская область, г. Пенза, ${normalized}`,
    normalized,
  ];

  return Array.from(
    new Set(
      candidates
        .map(candidate => candidate.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  );
}

function toMoneyString(value: number | null | undefined) {
  const normalized = Number.isFinite(value) ? Number(value) : 0;
  return normalized.toFixed(2);
}

function pickFirstObject(value: unknown[]): Record<string, any> | null {
  for (const item of value) {
    if (item && typeof item === "object") {
      return item as Record<string, any>;
    }
  }
  return null;
}

function readNumericCandidate(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    return Number.isFinite(normalized) ? normalized : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readNumericCandidate(record.amount) ??
      readNumericCandidate(record.value) ??
      readNumericCandidate(record.price) ??
      readNumericCandidate(record.price_with_vat) ??
      readNumericCandidate(record.total_price) ??
      readNumericCandidate(record.total_price_with_vat) ??
      readNumericCandidate(record.base_price) ??
      readNumericCandidate(record.final_price) ??
      readNumericCandidate(record.cost) ??
      readNumericCandidate(record.total) ??
      readNumericCandidate(record.sum) ??
      readNumericCandidate(record.pricing) ??
      readNumericCandidate(record.billing) ??
      readNumericCandidate(record.billing_details)
    );
  }
  return null;
}

function readStringCandidate(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return null;
}

function readEtaMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readEtaMinutes(record.minutes) ??
      readEtaMinutes(record.value) ??
      readEtaMinutes(record.amount)
    );
  }
  if (typeof value === "string") {
    const match = value.match(/(\d+)/);
    if (match) {
      return Math.max(0, Number.parseInt(match[1]!, 10));
    }
  }
  return null;
}

function buildEtaLabel(minutes: number | null) {
  if (!minutes || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} ч ${restMinutes} мин` : `${hours} ч`;
}

function normalizeDeliveryOfferQuote(
  payload: DeliveryOfferPayload,
): YandexDeliveryQuote {
  const offers = Array.isArray(payload?.offers) ? payload.offers : [];
  const firstOffer = pickFirstObject(offers);

  if (!firstOffer) {
    return {
      available: false,
      price: null,
      currency: "RUB",
      etaMinutes: null,
      etaLabel: null,
      offerId: null,
      message: "Подходящий курьерский тариф сейчас не найден.",
      raw: payload,
    };
  }

  const price =
    readNumericCandidate(firstOffer.price) ??
    readNumericCandidate(firstOffer.cost) ??
    readNumericCandidate(firstOffer.total_price) ??
    readNumericCandidate(firstOffer.final_price) ??
    readNumericCandidate(firstOffer.price_with_vat) ??
    readNumericCandidate(firstOffer.pricing) ??
    readNumericCandidate(firstOffer.billing) ??
    readNumericCandidate(firstOffer.billing_details);
  const currency =
    readStringCandidate((firstOffer.price as any)?.currency) ??
    readStringCandidate((firstOffer.cost as any)?.currency) ??
    "RUB";
  const etaMinutes =
    readEtaMinutes(firstOffer.eta) ??
    readEtaMinutes(firstOffer.duration) ??
    readEtaMinutes(firstOffer.time);
  const offerId =
    readStringCandidate(firstOffer.offer_id) ??
    readStringCandidate(firstOffer.id) ??
    null;

  return {
    available: price !== null,
    price: price !== null ? Math.max(0, Math.round(price)) : null,
    currency,
    etaMinutes,
    etaLabel: buildEtaLabel(etaMinutes),
    offerId,
    message:
      price !== null
        ? null
        : "Сервис доставки вернул тариф без стоимости. Повторите расчёт позже.",
    raw: payload,
  };
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
  if (
    settings.useSelectedCorpClientId &&
    !settings.selectedCorpClientId.trim()
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Включена отправка Corp Client ID, но сам ID не заполнен в настройках.",
    });
  }

  const response = await fetch(`${normalizeBaseUrl(settings.apiBaseUrl)}${path}`, {
    ...init,
    headers: {
      Authorization: normalizeBearerToken(settings.accessToken),
      Accept: "application/json",
      "Accept-Language": "ru",
      "Content-Type": "application/json",
      ...(settings.useSelectedCorpClientId && settings.selectedCorpClientId.trim()
        ? {
            "X-YaTaxi-Selected-Corp-Client-Id":
              settings.selectedCorpClientId.trim(),
          }
        : {}),
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
  coordinates?: [number, number],
) {
  return {
    id,
    fullname,
    ...(coordinates
      ? {
          coordinates,
        }
      : {}),
  };
}

function buildOfferItems(title: string) {
  return [
    {
      quantity: 1,
      pickup_point: 1,
      dropoff_point: 2,
      title: title.slice(0, 128),
    },
  ];
}

function buildClaimRoutePoint(params: {
  pointId: number;
  visitOrder: number;
  type: "source" | "destination";
  fullname: string;
  coordinates?: [number, number];
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
      ...(params.coordinates
        ? {
            coordinates: params.coordinates,
          }
        : {}),
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
  destinationCoordinates?: [number, number] | null;
}) {
  const sourceAddress = ensureNonEmpty(
    params.sourceAddress,
    "Не указан адрес отправления для расчёта доставки.",
  );
  const destinationAddress = ensureNonEmpty(
    params.destinationAddress,
    "Не указан адрес назначения для расчёта доставки.",
  );

  const sourceCandidates = buildYandexRouteFullnameCandidates(sourceAddress);
  const destinationCandidates = buildYandexRouteFullnameCandidates(destinationAddress);
  const limitedSourceCandidates = (
    sourceCandidates.length > 0
      ? sourceCandidates
      : [normalizeYandexRouteFullname(sourceAddress)]
  ).slice(0, 4);
  const limitedDestinationCandidates = (
    destinationCandidates.length > 0
      ? destinationCandidates
      : [normalizeYandexRouteFullname(destinationAddress)]
  ).slice(0, 4);

  let bestUnavailableQuote: YandexDeliveryQuote | null = null;
  let lastError: unknown = null;

  for (const sourceCandidate of limitedSourceCandidates) {
    for (const destinationCandidate of limitedDestinationCandidates) {
      try {
        const result = await yandexDeliveryRequest<DeliveryOfferPayload>(
          "/b2b/cargo/integration/v2/offers/calculate",
          {
            method: "POST",
            body: JSON.stringify({
              route_points: [
                buildOfferRoutePoint(1, sourceCandidate),
                buildOfferRoutePoint(
                  2,
                  destinationCandidate,
                  params.destinationCoordinates ?? undefined,
                ),
              ],
              items: buildOfferItems(`Доставка заказа в ТЕХАКС`),
              requirements: {
                taxi_classes: ["express"],
              },
            }),
          },
        );

        const normalizedQuote = normalizeDeliveryOfferQuote(result.payload);
        if (normalizedQuote.available && normalizedQuote.price !== null) {
          return normalizedQuote;
        }

        if (!bestUnavailableQuote) {
          bestUnavailableQuote = normalizedQuote;
        }
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (bestUnavailableQuote) {
    return bestUnavailableQuote;
  }

  if (lastError) {
    throw lastError;
  }

  return {
    available: false,
    price: null,
    currency: "RUB",
    etaMinutes: null,
    etaLabel: null,
    offerId: null,
    message: "Подходящий курьерский тариф сейчас не найден.",
    raw: null,
  };
}

export async function createAndProcessYandexDeliveryOrder(input: CreateClaimInput) {
  const sourceAddress = normalizeYandexRouteFullname(ensureNonEmpty(
    input.sourceAddress,
    "Для Яндекс Доставки нужен адрес отправления.",
  ));
  const destinationAddress = normalizeYandexRouteFullname(ensureNonEmpty(
    input.destinationAddress,
    "Для Яндекс Доставки нужен адрес назначения.",
  ));
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
        dropoff_point: 2,
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
        contactName: "ТЕХАКС",
        contactPhone: customerPhone,
      }),
      buildClaimRoutePoint({
        pointId: 2,
        visitOrder: 2,
        type: "destination",
        fullname: destinationAddress,
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
