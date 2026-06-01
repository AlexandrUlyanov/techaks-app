import { and, asc, desc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import {
  moyskladSyncJobs,
  moyskladWebhookEvents,
  orderItems,
  orderHistory,
  orders,
  products,
  productVariants,
  stores,
  syncLogs,
  users,
} from "@db/schema";
import { getAppSettings, setAppSetting } from "./app-settings";
import { env } from "./env";
import { getMoyskladClient, MoyskladApiError } from "./moysklad-client";

const ORDER_SYNC_SETTINGS_KEYS = [
  "moysklad_orders_sync_enabled",
  "moysklad_order_organization_href",
  "moysklad_order_store_href",
  "moysklad_order_sales_channel_href",
  "moysklad_order_create_counterparties",
  "moysklad_order_status_mapping_json",
] as const;

const LOCAL_ORDER_STATUSES = [
  "new",
  "pending",
  "waiting_call",
  "confirmed",
  "awaiting_payment",
  "paid",
  "processing",
  "confirmed_by_customer",
  "ready_for_pickup",
  "assembling",
  "assembled",
  "awaiting_dispatch",
  "shipped",
  "handed_to_delivery",
  "in_delivery",
  "delivered",
  "completed",
  "cancelled",
  "returned",
  "return_requested",
  "problem",
] as const;

const JOB_STATUS_PENDING = "pending";
const JOB_STATUS_PROCESSING = "processing";
const JOB_STATUS_SUCCESS = "success";
const JOB_STATUS_ERROR = "error";
const JOB_LOCK_STALE_MS = 15 * 60_000;
const MAX_JOB_ATTEMPTS = 6;

type JobAction =
  | "create"
  | "update"
  | "cancel"
  | "payment"
  | "status_update"
  | "webhook_process";

type JobEntityType = "order" | "payment" | "status" | "webhook";

type OrderStatusMapping = Record<string, string>;

type LoadedOrder = {
  id: number;
  orderNumber: string | null;
  status: string;
  deliveryType: string;
  address: string | null;
  paymentType: string;
  paymentStatus: string;
  source: string;
  storeId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerComment: string | null;
  deliveryComment: string | null;
  createdAt: Date;
  moyskladSyncStatus: string;
  moyskladOrderId: string | null;
  moyskladOrderHref: string | null;
  moyskladExternalCode: string | null;
  moyskladPaymentInId: string | null;
  moyskladPaymentInHref: string | null;
  moyskladPaymentExternalCode: string | null;
  totalPrice: number;
  paidAmount: number;
  paidAt: Date | null;
  paymentMethod: string | null;
  paymentId: string | null;
  items: Array<{
    productId: number;
    variantId: number | null;
    variantName: string | null;
    article: string | null;
    productName: string | null;
    quantity: number;
    price: number;
    discount: number;
    total: number;
    msId: string | null;
    msType: "product" | "variant";
  }>;
};

type OrderSyncSettings = {
  enabled: boolean;
  organizationHref: string | null;
  storeHref: string | null;
  salesChannelHref: string | null;
  createCounterparties: boolean;
  reserveOnOrder: boolean;
  defaultCounterpartyHref: string | null;
  webhookTokenConfigured: boolean;
  statusMapping: OrderStatusMapping;
};

type ClaimedJobRow = {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  attempts: number;
  payload_snapshot: Record<string, unknown> | null;
};

type MetadataState = {
  name: string;
  href: string;
};

type MetadataLoadResult = {
  states: MetadataState[];
  organization: { name: string; href: string } | null;
  store: { name: string; href: string } | null;
  salesChannels: Array<{ name: string; href: string }>;
  errors: {
    states: string | null;
    organization: string | null;
    store: string | null;
    salesChannels: string | null;
  };
};

function parseBoolean(value: string | null | undefined, fallback: boolean) {
  if (value == null) return fallback;
  return value.trim().toLowerCase() === "true";
}

function parseJsonRecord(value: string | null | undefined): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([key, val]) =>
        typeof val === "string" && val.trim()
          ? [[key, val.trim()]]
          : []
      )
    );
  } catch {
    return {};
  }
}

function getOrderExternalCode(orderId: number) {
  return `techaks-order-${orderId}`;
}

function getPaymentExternalCode(orderId: number) {
  return `techaks-payment-${orderId}`;
}

function buildProductHref(msId: string) {
  return `https://api.moysklad.ru/api/remap/1.2/entity/product/${msId}`;
}

function buildVariantHref(msId: string) {
  return `https://api.moysklad.ru/api/remap/1.2/entity/variant/${msId}`;
}

function toMoyskladApiPath(href: string) {
  const normalizedHref = href.trim();
  if (!normalizedHref) return "";
  const apiPrefix = "https://api.moysklad.ru/api/remap/1.2";
  if (normalizedHref.startsWith(apiPrefix)) {
    return normalizedHref.slice(apiPrefix.length) || "";
  }
  try {
    const url = new URL(normalizedHref);
    return `${url.pathname}${url.search}`;
  } catch {
    return normalizedHref;
  }
}

function toMoyskladMoment(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function sanitizePhoneForSearch(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return digits || value.trim();
}

async function writeOrderSyncLog(
  status: "success" | "error" | "running",
  message: string,
  details?: Record<string, unknown>
) {
  const db = getDb();
  await db.insert(syncLogs).values({
    type: "moysklad_order_sync",
    status,
    message,
    details: details ?? null,
  });
}

export async function getMoyskladOrderWebhookToken() {
  const envToken = env.moyskladWebhookToken.trim();
  if (envToken) return envToken;

  const settings = await getAppSettings(["moysklad_webhook_secret"]);
  return settings.moysklad_webhook_secret?.trim() || "";
}

export async function getMoyskladOrderSyncSettings(): Promise<OrderSyncSettings> {
  const settings = await getAppSettings([...ORDER_SYNC_SETTINGS_KEYS]);
  return {
    enabled: parseBoolean(settings.moysklad_orders_sync_enabled, true),
    organizationHref: settings.moysklad_order_organization_href?.trim() || null,
    storeHref: settings.moysklad_order_store_href?.trim() || null,
    salesChannelHref: settings.moysklad_order_sales_channel_href?.trim() || null,
    createCounterparties: parseBoolean(settings.moysklad_order_create_counterparties, true),
    reserveOnOrder: env.moyskladReserveOnOrder,
    defaultCounterpartyHref: env.moyskladDefaultCounterpartyHref?.trim() || null,
    webhookTokenConfigured: Boolean(await getMoyskladOrderWebhookToken()),
    statusMapping: parseJsonRecord(settings.moysklad_order_status_mapping_json),
  };
}

export async function saveMoyskladOrderSyncSettings(input: {
  enabled: boolean;
  organizationHref: string;
  storeHref: string;
  salesChannelHref: string;
  createCounterparties: boolean;
  statusMapping: OrderStatusMapping;
}) {
  await Promise.all([
    setAppSetting("moysklad_orders_sync_enabled", input.enabled ? "true" : "false"),
    setAppSetting("moysklad_order_organization_href", input.organizationHref.trim() || null),
    setAppSetting("moysklad_order_store_href", input.storeHref.trim() || null),
    setAppSetting(
      "moysklad_order_sales_channel_href",
      input.salesChannelHref.trim() || null
    ),
    setAppSetting(
      "moysklad_order_create_counterparties",
      input.createCounterparties ? "true" : "false"
    ),
    setAppSetting(
      "moysklad_order_status_mapping_json",
      JSON.stringify(input.statusMapping ?? {})
    ),
  ]);
}

export async function getCustomerOrderStates() {
  const client = await getMoyskladClient();
  const data = await client.get<{
    states?: Array<{ name?: string; meta?: { href?: string } }>;
  }>(
    "/entity/customerorder/metadata"
  );
  return (data.states ?? [])
    .map(row => ({
      name: row.name?.trim() || "",
      href: row.meta?.href?.trim() || "",
    }))
    .filter(row => row.name && row.href);
}

export async function getDefaultOrganization() {
  const client = await getMoyskladClient();
  const data = await client.get<{ rows?: Array<{ name?: string; meta?: { href?: string } }> }>(
    "/entity/organization",
    { limit: 50 }
  );
  return (data.rows ?? [])
    .map(row => ({
      name: row.name?.trim() || "",
      href: row.meta?.href?.trim() || "",
    }))
    .filter(row => row.href)[0] ?? null;
}

export async function getDefaultStore() {
  const client = await getMoyskladClient();
  const data = await client.get<{ rows?: Array<{ name?: string; meta?: { href?: string } }> }>(
    "/entity/store",
    { limit: 50 }
  );
  return (data.rows ?? [])
    .map(row => ({
      name: row.name?.trim() || "",
      href: row.meta?.href?.trim() || "",
    }))
    .filter(row => row.href)[0] ?? null;
}

export async function getSalesChannel() {
  const client = await getMoyskladClient();
  const data = await client.get<{ rows?: Array<{ name?: string; meta?: { href?: string } }> }>(
    "/entity/saleschannel",
    { limit: 50 }
  );
  return (data.rows ?? [])
    .map(row => ({
      name: row.name?.trim() || "",
      href: row.meta?.href?.trim() || "",
    }))
    .filter(row => row.href);
}

function getErrorText(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Неизвестная ошибка";
}

export async function loadMoyskladMetadata(): Promise<MetadataLoadResult> {
  const [statesResult, organizationResult, storeResult, salesChannelsResult] =
    await Promise.allSettled([
      getCustomerOrderStates(),
      getDefaultOrganization(),
      getDefaultStore(),
      getSalesChannel(),
    ]);

  return {
    states: statesResult.status === "fulfilled" ? statesResult.value : [],
    organization:
      organizationResult.status === "fulfilled" ? organizationResult.value : null,
    store: storeResult.status === "fulfilled" ? storeResult.value : null,
    salesChannels:
      salesChannelsResult.status === "fulfilled" ? salesChannelsResult.value : [],
    errors: {
      states:
        statesResult.status === "rejected"
          ? getErrorText(statesResult.reason)
          : null,
      organization:
        organizationResult.status === "rejected"
          ? getErrorText(organizationResult.reason)
          : null,
      store:
        storeResult.status === "rejected"
          ? getErrorText(storeResult.reason)
          : null,
      salesChannels:
        salesChannelsResult.status === "rejected"
          ? getErrorText(salesChannelsResult.reason)
          : null,
    },
  };
}

export async function validateMoyskladConfig() {
  const settings = await getMoyskladOrderSyncSettings();
  const tokenConfigured = Boolean(env.moyskladToken.trim() || (await getAppSettings(["moysklad_token"])).moysklad_token?.trim());

  if (!tokenConfigured) {
    return {
      ok: false,
      tokenOk: false,
      organizationOk: false,
      storeOk: false,
      customerOrderOk: false,
      salesChannelOk: !settings.salesChannelHref,
      message: "Не настроен токен МойСклад.",
      states: [] as MetadataState[],
    };
  }

  try {
    const metadata = await loadMoyskladMetadata();
    const customerOrderOk = metadata.states.length > 0;
    const organizationDetected = Boolean(metadata.organization?.href);
    const storeDetected = Boolean(metadata.store?.href);
    const organizationSelected = Boolean(settings.organizationHref);
    const storeSelected = Boolean(settings.storeHref);
    const organizationOk = organizationSelected || organizationDetected;
    const storeOk = storeSelected || storeDetected;
    const salesChannelOk = !settings.salesChannelHref
      ? true
      : metadata.salesChannels.some(channel => channel.href === settings.salesChannelHref);

    const messages = [
      customerOrderOk
        ? null
        : metadata.errors.states || "Не удалось получить metadata customerorder.",
      organizationDetected
        ? null
        : metadata.errors.organization || "Organization не найдена по API.",
      storeDetected ? null : metadata.errors.store || "Store не найден по API.",
    ].filter(Boolean);

    return {
      ok: tokenConfigured && customerOrderOk,
      tokenOk: tokenConfigured,
      organizationOk,
      storeOk,
      organizationDetected,
      storeDetected,
      organizationSelected,
      storeSelected,
      customerOrderOk,
      salesChannelOk,
      message:
        messages.length > 0
          ? messages.join(" ")
          : "Подключение к МойСклад доступно.",
      states: metadata.states,
      defaults: metadata,
    };
  } catch (error) {
    return {
      ok: false,
      tokenOk: tokenConfigured,
      organizationOk: false,
      storeOk: false,
      organizationDetected: false,
      storeDetected: false,
      organizationSelected: false,
      storeSelected: false,
      customerOrderOk: false,
      salesChannelOk: false,
      message: error instanceof Error ? error.message : "Ошибка проверки МойСклад",
      states: [] as MetadataState[],
    };
  }
}

export async function enqueueMoyskladSyncJob(input: {
  entityType: JobEntityType;
  entityId: number;
  action: JobAction;
  payloadSnapshot?: Record<string, unknown> | null;
}) {
  const db = getDb();
  const [existing] = await db
    .select({ id: moyskladSyncJobs.id, status: moyskladSyncJobs.status })
    .from(moyskladSyncJobs)
    .where(
      and(
        eq(moyskladSyncJobs.entityType, input.entityType),
        eq(moyskladSyncJobs.entityId, input.entityId),
        eq(moyskladSyncJobs.action, input.action),
        inArray(moyskladSyncJobs.status, [JOB_STATUS_PENDING, JOB_STATUS_PROCESSING])
      )
    )
    .orderBy(desc(moyskladSyncJobs.createdAt))
    .limit(1);

  if (existing) {
    return { queued: false, jobId: existing.id };
  }

  const result = await db.insert(moyskladSyncJobs).values({
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    status: JOB_STATUS_PENDING,
    attempts: 0,
    nextRunAt: new Date(),
    lockedAt: null,
    lastError: null,
    payloadSnapshot: input.payloadSnapshot ?? null,
    updatedAt: new Date(),
  });

  return { queued: true, jobId: Number(result[0].insertId) };
}

async function markOrderSyncState(input: {
  orderId: number;
  status: string;
  moyskladOrderId?: string | null;
  moyskladOrderHref?: string | null;
  moyskladExternalCode?: string | null;
  lastError?: string | null;
  syncedAt?: Date | null;
}) {
  const db = getDb();
  await db
    .update(orders)
    .set({
      moyskladSyncStatus: input.status,
      moyskladOrderId: input.moyskladOrderId,
      moyskladOrderHref: input.moyskladOrderHref,
      moyskladExternalCode: input.moyskladExternalCode,
      moyskladLastError: input.lastError ?? null,
      moyskladSyncedAt: input.syncedAt ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, input.orderId));
}

async function markPaymentSyncState(input: {
  orderId: number;
  moyskladPaymentInId?: string | null;
  moyskladPaymentInHref?: string | null;
  moyskladPaymentExternalCode?: string | null;
  lastError?: string | null;
}) {
  const db = getDb();
  await db
    .update(orders)
    .set({
      moyskladPaymentInId: input.moyskladPaymentInId,
      moyskladPaymentInHref: input.moyskladPaymentInHref,
      moyskladPaymentExternalCode: input.moyskladPaymentExternalCode,
      moyskladLastError: input.lastError ?? null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, input.orderId));
}

async function loadOrderForSync(db: ReturnType<typeof getDb>, orderId: number): Promise<LoadedOrder> {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      deliveryType: orders.deliveryType,
      address: orders.address,
      paymentType: orders.paymentType,
      paymentStatus: orders.paymentStatus,
      source: orders.source,
      storeId: orders.storeId,
      customerName: sql<string | null>`coalesce(${orders.customerName}, ${users.fullName})`,
      customerPhone: sql<string | null>`coalesce(${orders.customerPhone}, ${users.phone})`,
      customerEmail: sql<string | null>`coalesce(${orders.customerEmail}, ${users.email})`,
      customerComment: orders.customerComment,
      deliveryComment: orders.deliveryComment,
      createdAt: orders.createdAt,
      moyskladSyncStatus: orders.moyskladSyncStatus,
      moyskladOrderId: orders.moyskladOrderId,
      moyskladOrderHref: orders.moyskladOrderHref,
      moyskladExternalCode: orders.moyskladExternalCode,
      moyskladPaymentInId: orders.moyskladPaymentInId,
      moyskladPaymentInHref: orders.moyskladPaymentInHref,
      moyskladPaymentExternalCode: orders.moyskladPaymentExternalCode,
      totalPrice: orders.totalPrice,
      paidAmount: orders.paidAmount,
      paidAt: orders.paidAt,
      paymentMethod: orders.paymentMethod,
      paymentId: orders.paymentId,
    })
    .from(orders)
    .leftJoin(users, eq(orders.userId, users.id))
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    throw new Error(`Заказ #${orderId} не найден.`);
  }

  const items = await db
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      variantName: orderItems.variantName,
      article: orderItems.article,
      productName: sql<string | null>`coalesce(${orderItems.productName}, ${products.name})`,
      quantity: orderItems.quantity,
      price: orderItems.price,
      discount: orderItems.discount,
      total: orderItems.total,
      msId: sql<string | null>`coalesce(${productVariants.msId}, ${products.msId})`,
      msType: sql<"product" | "variant">`case when ${productVariants.msId} is not null then 'variant' else 'product' end`,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .leftJoin(productVariants, eq(orderItems.variantId, productVariants.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.id));

  return {
    ...order,
    items,
  };
}

async function ensureCounterparty(order: LoadedOrder, settings: OrderSyncSettings) {
  if (!settings.createCounterparties) {
    if (!settings.defaultCounterpartyHref) {
      throw new Error("Не настроен fallback-контрагент MOYSKLAD_DEFAULT_COUNTERPARTY_HREF.");
    }
    return settings.defaultCounterpartyHref;
  }

  const client = await getMoyskladClient();
  const email = order.customerEmail?.trim().toLowerCase() || "";
  const phone = order.customerPhone?.trim() || "";

  const searchFilters = [];
  if (phone) {
    searchFilters.push(`phone=${sanitizePhoneForSearch(phone)}`);
  }
  if (email) {
    searchFilters.push(`email=${email}`);
  }

  for (const filter of searchFilters) {
    const data = await client.get<{
      rows?: Array<{ meta?: { href?: string } }>;
    }>("/entity/counterparty", {
      filter,
      limit: 1,
    });
    const href = data.rows?.[0]?.meta?.href?.trim();
    if (href) return href;
  }

  if (!phone && !email) {
    if (!settings.defaultCounterpartyHref) {
      throw new Error("У заказа нет телефона/email и fallback-контрагент не настроен.");
    }
    return settings.defaultCounterpartyHref;
  }

  const created = await client.post<{ meta?: { href?: string } }>("/entity/counterparty", {
    name: order.customerName?.trim() || `Клиент заказа #${order.id}`,
    phone: phone || undefined,
    email: email || undefined,
    description: `Создано из интернет-магазина Techaks для заказа #${order.id}`,
  });

  const href = created.meta?.href?.trim();
  if (!href) {
    throw new Error("МойСклад не вернул href созданного контрагента.");
  }
  return href;
}

function buildCustomerOrderDescription(order: LoadedOrder) {
  return [
    "Интернет-магазин Techaks",
    `Заказ сайта: #${order.id}`,
    `Клиент: ${order.customerName?.trim() || "Не указан"}`,
    `Телефон: ${order.customerPhone?.trim() || "Не указан"}`,
    `Email: ${order.customerEmail?.trim() || "Не указан"}`,
    `Доставка: ${order.deliveryType === "delivery" ? "Доставка" : "Самовывоз"}`,
    `Оплата: ${order.paymentType}`,
    `Комментарий: ${order.customerComment?.trim() || order.deliveryComment?.trim() || "—"}`,
  ].join("\n");
}

function buildCustomerOrderPositions(order: LoadedOrder, reserveOnOrder: boolean) {
  return order.items.map(item => {
    if (!item.msId) {
      throw new Error(`Товар ${item.productName || `#${item.productId}`} не связан с МойСклад`);
    }
    return {
      quantity: item.quantity,
      price: Number(item.price) * 100,
      discount: Number(item.discount ?? 0) * 100,
      vatEnabled: false,
      reserve: reserveOnOrder ? item.quantity : 0,
      assortment: {
        meta: {
          href: item.msType === "variant" ? buildVariantHref(item.msId) : buildProductHref(item.msId),
          type: item.msType,
          mediaType: "application/json",
        },
      },
    };
  });
}

function buildCustomerOrderPayload(args: {
  order: LoadedOrder;
  settings: OrderSyncSettings;
  counterpartyHref: string;
  stateHref?: string | null;
  onlyStatus?: boolean;
}) {
  const { order, settings, counterpartyHref, stateHref, onlyStatus } = args;
  const humanOrderNumber =
    order.orderNumber?.trim() || `TA-${order.id}`;
  const payload: Record<string, unknown> = {
    name: humanOrderNumber,
    organization: {
      meta: {
        href: settings.organizationHref,
        type: "organization",
        mediaType: "application/json",
      },
    },
    agent: {
      meta: {
        href: counterpartyHref,
        type: "counterparty",
        mediaType: "application/json",
      },
    },
    store: {
      meta: {
        href: settings.storeHref,
        type: "store",
        mediaType: "application/json",
      },
    },
    externalCode: getOrderExternalCode(order.id),
    moment: toMoyskladMoment(order.createdAt),
    shipmentAddress: order.address?.trim() || undefined,
    description: buildCustomerOrderDescription(order),
  };

  if (settings.salesChannelHref) {
    payload.salesChannel = {
      meta: {
        href: settings.salesChannelHref,
        type: "saleschannel",
        mediaType: "application/json",
      },
    };
  }

  if (stateHref) {
    payload.state = {
      meta: {
        href: stateHref,
        type: "state",
        mediaType: "application/json",
      },
    };
  }

  if (!onlyStatus) {
    payload.positions = {
      rows: buildCustomerOrderPositions(order, settings.reserveOnOrder),
    };
  }

  return payload;
}

async function findExistingCustomerOrderByExternalCode(externalCode: string) {
  const client = await getMoyskladClient();
  const data = await client.get<{
    rows?: Array<{ id?: string; meta?: { href?: string } }>;
  }>("/entity/customerorder", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  });

  const row = data.rows?.[0];
  return row?.id && row.meta?.href
    ? {
        id: row.id,
        href: row.meta.href,
      }
    : null;
}

async function findExistingPaymentInByExternalCode(externalCode: string) {
  const client = await getMoyskladClient();
  const data = await client.get<{
    rows?: Array<{ id?: string; meta?: { href?: string } }>;
  }>("/entity/paymentin", {
    filter: `externalCode=${externalCode}`,
    limit: 1,
  });

  const row = data.rows?.[0];
  return row?.id && row.meta?.href
    ? {
        id: row.id,
        href: row.meta.href,
      }
    : null;
}

function buildPaymentInPayload(args: {
  order: LoadedOrder;
  settings: OrderSyncSettings;
  counterpartyHref: string;
  orderHref: string;
  externalCode: string;
}) {
  const { order, settings, counterpartyHref, orderHref, externalCode } = args;
  const amount = Math.max(0, Number(order.paidAmount || order.totalPrice || 0));
  if (amount <= 0) {
    throw new Error(`У заказа #${order.id} нет суммы оплаты для МойСклад.`);
  }

  const orderNumber = order.orderNumber?.trim() || `TA-${order.id}`;
  const paymentLabel = order.paymentMethod || order.paymentType || "yookassa";
  const yookassaSuffix = order.paymentId ? `, YooKassa payment ${order.paymentId}` : "";

  return {
    name: `Оплата ${orderNumber}`,
    externalCode,
    organization: {
      meta: {
        href: settings.organizationHref,
        type: "organization",
        mediaType: "application/json",
      },
    },
    agent: {
      meta: {
        href: counterpartyHref,
        type: "counterparty",
        mediaType: "application/json",
      },
    },
    sum: amount * 100,
    moment: toMoyskladMoment(order.paidAt || new Date()),
    paymentPurpose: `Оплата заказа ${orderNumber} через ${paymentLabel}${yookassaSuffix}`,
    operations: [
      {
        meta: {
          href: orderHref,
          type: "customerorder",
          mediaType: "application/json",
        },
      },
    ],
  };
}

async function syncOrderToMoysklad(orderId: number, action: JobAction) {
  const db = getDb();
  const settings = await getMoyskladOrderSyncSettings();
  if (!settings.enabled) {
    await markOrderSyncState({
      orderId,
      status: JOB_STATUS_PENDING,
      lastError: "Синхронизация заказов с МойСклад выключена в настройках.",
    });
    return { skipped: true };
  }

  if (!settings.organizationHref || !settings.storeHref) {
    throw new Error("Не настроены organization/store для синхронизации заказов с МойСклад.");
  }

  const order = await loadOrderForSync(db, orderId);
  const externalCode = order.moyskladExternalCode?.trim() || getOrderExternalCode(order.id);
  const mappedStateHref = settings.statusMapping[order.status] ?? null;

  const counterpartyHref = await ensureCounterparty(order, settings);
  const client = await getMoyskladClient();

  let existingOrderId = order.moyskladOrderId?.trim() || null;
  let existingOrderHref = order.moyskladOrderHref?.trim() || null;

  if (!existingOrderId || !existingOrderHref) {
    const existing = await findExistingCustomerOrderByExternalCode(externalCode);
    if (existing) {
      existingOrderId = existing.id;
      existingOrderHref = existing.href;
      await markOrderSyncState({
        orderId,
        status: JOB_STATUS_PENDING,
        moyskladOrderId: existing.id,
        moyskladOrderHref: existing.href,
        moyskladExternalCode: externalCode,
        lastError: null,
      });
    }
  }

  if (action === "status_update" && existingOrderId) {
    const payload = buildCustomerOrderPayload({
      order,
      settings,
      counterpartyHref,
      stateHref: mappedStateHref,
      onlyStatus: true,
    });
    await client.put(`/entity/customerorder/${existingOrderId}`, payload);
    await markOrderSyncState({
      orderId,
      status: JOB_STATUS_SUCCESS,
      moyskladOrderId: existingOrderId,
      moyskladOrderHref: existingOrderHref,
      moyskladExternalCode: externalCode,
      lastError: null,
      syncedAt: new Date(),
    });
    return { created: false, updated: true };
  }

  const payload = buildCustomerOrderPayload({
    order,
    settings,
    counterpartyHref,
    stateHref: mappedStateHref,
  });

  if (existingOrderId) {
    const updated = await client.put<{ id?: string; meta?: { href?: string } }>(
      `/entity/customerorder/${existingOrderId}`,
      payload
    );

    await markOrderSyncState({
      orderId,
      status: JOB_STATUS_SUCCESS,
      moyskladOrderId: updated.id || existingOrderId,
      moyskladOrderHref: updated.meta?.href || existingOrderHref,
      moyskladExternalCode: externalCode,
      lastError: null,
      syncedAt: new Date(),
    });

    return { created: false, updated: true };
  }

  const created = await client.post<{ id?: string; meta?: { href?: string } }>(
    "/entity/customerorder",
    payload
  );

  if (!created.id || !created.meta?.href) {
    throw new Error("МойСклад не вернул id/href созданного customerorder.");
  }

  await markOrderSyncState({
    orderId,
    status: JOB_STATUS_SUCCESS,
    moyskladOrderId: created.id,
    moyskladOrderHref: created.meta.href,
    moyskladExternalCode: externalCode,
    lastError: null,
    syncedAt: new Date(),
  });

  return { created: true, updated: false };
}

async function syncOrderPaymentToMoysklad(orderId: number) {
  const db = getDb();
  const settings = await getMoyskladOrderSyncSettings();
  if (!settings.enabled) {
    await markPaymentSyncState({
      orderId,
      lastError: "Синхронизация заказов с МойСклад выключена в настройках.",
    });
    return { skipped: true };
  }

  if (!settings.organizationHref || !settings.storeHref) {
    throw new Error("Не настроены organization/store для синхронизации оплаты с МойСклад.");
  }

  let order = await loadOrderForSync(db, orderId);
  if (order.paymentStatus !== "paid") {
    return { skipped: true, reason: "payment_not_paid" };
  }

  const paymentExternalCode =
    order.moyskladPaymentExternalCode?.trim() || getPaymentExternalCode(order.id);

  if (order.moyskladPaymentInId && order.moyskladPaymentInHref) {
    return { created: false, existing: true };
  }

  const existingPayment = await findExistingPaymentInByExternalCode(paymentExternalCode);
  if (existingPayment) {
    await markPaymentSyncState({
      orderId,
      moyskladPaymentInId: existingPayment.id,
      moyskladPaymentInHref: existingPayment.href,
      moyskladPaymentExternalCode: paymentExternalCode,
      lastError: null,
    });
    return { created: false, existing: true };
  }

  let orderHref = order.moyskladOrderHref?.trim() || null;
  if (!orderHref) {
    await syncOrderToMoysklad(orderId, "create");
    order = await loadOrderForSync(db, orderId);
    orderHref = order.moyskladOrderHref?.trim() || null;
  }

  if (!orderHref) {
    throw new Error(`Заказ #${orderId} не синхронизирован с МойСклад, оплату создать нельзя.`);
  }

  const counterpartyHref = await ensureCounterparty(order, settings);
  const client = await getMoyskladClient();
  const payload = buildPaymentInPayload({
    order,
    settings,
    counterpartyHref,
    orderHref,
    externalCode: paymentExternalCode,
  });

  const created = await client.post<{ id?: string; meta?: { href?: string } }>(
    "/entity/paymentin",
    payload
  );

  if (!created.id || !created.meta?.href) {
    throw new Error("МойСклад не вернул id/href созданного paymentin.");
  }

  await markPaymentSyncState({
    orderId,
    moyskladPaymentInId: created.id,
    moyskladPaymentInHref: created.meta.href,
    moyskladPaymentExternalCode: paymentExternalCode,
    lastError: null,
  });

  return { created: true, existing: false };
}

function getRetryDelayMs(attempts: number, error: unknown) {
  const nextAttempt = attempts + 1;
  if (error instanceof MoyskladApiError && error.status === 429) {
    return Math.min(60 * 60_000, nextAttempt * 5 * 60_000);
  }
  if (error instanceof MoyskladApiError && error.retriable) {
    return Math.min(60 * 60_000, nextAttempt * 2 * 60_000);
  }
  if (
    error instanceof Error &&
    /timeout|etimedout|econnreset|socket hang up|network/i.test(error.message)
  ) {
    return Math.min(60 * 60_000, nextAttempt * 2 * 60_000);
  }
  return 0;
}

async function failJob(jobId: number, orderId: number | null, error: unknown, attempts: number) {
  const db = getDb();
  const message = error instanceof Error ? error.message : "Ошибка синхронизации";
  const retryDelayMs = getRetryDelayMs(attempts, error);
  const shouldRetry = retryDelayMs > 0 && attempts + 1 < MAX_JOB_ATTEMPTS;
  const nextRunAt = shouldRetry
    ? new Date(Date.now() + retryDelayMs)
    : new Date(Date.now() + 365 * 24 * 60 * 60_000);

  await db
    .update(moyskladSyncJobs)
    .set({
      status: JOB_STATUS_ERROR,
      attempts: attempts + 1,
      lastError: message,
      nextRunAt,
      lockedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(moyskladSyncJobs.id, jobId));

  if (orderId) {
    await markOrderSyncState({
      orderId,
      status: JOB_STATUS_ERROR,
      lastError: message,
    });
  }

  await writeOrderSyncLog("error", `Ошибка sync job #${jobId}: ${message}`, {
    jobId,
    orderId,
    nextRunAt: nextRunAt.toISOString(),
    retriable: shouldRetry,
  });
}

async function completeJob(jobId: number) {
  const db = getDb();
  await db
    .update(moyskladSyncJobs)
    .set({
      status: JOB_STATUS_SUCCESS,
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(moyskladSyncJobs.id, jobId));
}

async function claimNextMoyskladSyncJob(db: ReturnType<typeof getDb>) {
  return db.transaction(async tx => {
    const now = new Date();
    const staleBefore = new Date(Date.now() - JOB_LOCK_STALE_MS);
    const claimResult = await tx.execute(sql`
      SELECT *
      FROM ${moyskladSyncJobs}
      WHERE (${moyskladSyncJobs.status} = ${JOB_STATUS_PENDING}
          OR ${moyskladSyncJobs.status} = ${JOB_STATUS_ERROR})
        AND ${moyskladSyncJobs.nextRunAt} <= ${now}
        AND (${moyskladSyncJobs.lockedAt} IS NULL OR ${moyskladSyncJobs.lockedAt} < ${staleBefore})
      ORDER BY ${moyskladSyncJobs.createdAt} ASC
      LIMIT 1
      FOR UPDATE
    `);

    const claimResultWithRows = claimResult as unknown as
      | ClaimedJobRow[]
      | { 0?: ClaimedJobRow[] };
    const rows = Array.isArray((claimResultWithRows as { 0?: ClaimedJobRow[] })?.[0])
      ? ((claimResultWithRows as { 0?: ClaimedJobRow[] })[0] ?? [])
      : (claimResultWithRows as ClaimedJobRow[]);
    const job = rows?.[0];
    if (!job?.id) return null;

    await tx
      .update(moyskladSyncJobs)
      .set({
        status: JOB_STATUS_PROCESSING,
        lockedAt: now,
        updatedAt: now,
      })
      .where(eq(moyskladSyncJobs.id, Number(job.id)));

    return {
      id: Number(job.id),
      entityType: String(job.entity_type),
      entityId: Number(job.entity_id),
      action: String(job.action) as JobAction,
      attempts: Number(job.attempts ?? 0),
      payloadSnapshot: (job.payload_snapshot ?? null) as Record<string, unknown> | null,
    };
  });
}

async function processWebhookEvent(eventId: number) {
  const db = getDb();
  const [event] = await db
    .select()
    .from(moyskladWebhookEvents)
    .where(eq(moyskladWebhookEvents.id, eventId))
    .limit(1);

  if (!event) {
    throw new Error(`Webhook event #${eventId} не найден.`);
  }

  const payload = event.payload as
    | { events?: Array<Record<string, unknown>> }
    | Array<Record<string, unknown>>
    | Record<string, unknown>;

  const events = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.events)
      ? payload.events
      : [payload as Record<string, unknown>];

  const settings = await getMoyskladOrderSyncSettings();
  const reverseMapping = new Map<string, string>(
    Object.entries(settings.statusMapping)
      .filter(([, href]) => href)
      .map(([localStatus, href]) => [href, localStatus])
  );
  const client = reverseMapping.size > 0 ? await getMoyskladClient() : null;

  for (const item of events) {
    const eventMetaHref =
      (item.meta as { href?: string } | undefined)?.href?.trim() ||
      (item.customerOrder as { meta?: { href?: string } } | undefined)?.meta?.href?.trim() ||
      null;
    const eventType =
      String(item.entityType || item.meta?.type || item.type || "").toLowerCase();

    if (eventType && eventType !== "customerorder") continue;
    if (!eventMetaHref) continue;

    const [order] = await db
      .select({
        id: orders.id,
        status: orders.status,
      })
      .from(orders)
      .where(eq(orders.moyskladOrderHref, eventMetaHref))
      .limit(1);

    if (!order) continue;

    let stateHref =
      (item.state as { meta?: { href?: string } } | undefined)?.meta?.href?.trim() || null;
    if (!stateHref && client) {
      const path = toMoyskladApiPath(eventMetaHref);
      if (path) {
        const remoteOrder = await client.get<{
          state?: { meta?: { href?: string } };
        }>(path);
        stateHref = remoteOrder.state?.meta?.href?.trim() || null;
      }
    }
    const nextLocalStatus = stateHref ? reverseMapping.get(stateHref) : null;
    if (!nextLocalStatus || nextLocalStatus === order.status) continue;

    await db
      .update(orders)
      .set({
        status: nextLocalStatus,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, order.id));

    await db.insert(orderHistory).values({
      orderId: order.id,
      userId: null,
      actionType: "status_changed_from_moysklad",
      oldValue: { status: order.status },
      newValue: { status: nextLocalStatus, source: "moysklad" },
      comment: "Статус заказа обновлён из webhook МойСклад.",
    });
  }

  await db
    .update(moyskladWebhookEvents)
    .set({
      status: JOB_STATUS_SUCCESS,
      processedAt: new Date(),
      lastError: null,
    })
    .where(eq(moyskladWebhookEvents.id, eventId));
}

export async function processMoyskladOrderSyncJobs(limit = 5) {
  const db = getDb();
  let processed = 0;
  let success = 0;
  let failed = 0;

  while (processed < limit) {
    const job = await claimNextMoyskladSyncJob(db);
    if (!job) break;
    processed += 1;

    try {
      if (job.entityType === "webhook" && job.action === "webhook_process") {
        await processWebhookEvent(job.entityId);
        await completeJob(job.id);
        success += 1;
        continue;
      }

      if (job.entityType === "payment" && job.action === "payment") {
        await syncOrderPaymentToMoysklad(job.entityId);
        await completeJob(job.id);
        success += 1;
        continue;
      }

      if (job.entityType !== "order" && job.entityType !== "status") {
        throw new Error(`Неподдерживаемый тип sync job: ${job.entityType}`);
      }

      await syncOrderToMoysklad(job.entityId, job.action);
      await completeJob(job.id);
      success += 1;
    } catch (error) {
      failed += 1;
      await failJob(job.id, job.entityType === "webhook" ? null : job.entityId, error, job.attempts);
    }
  }

  return { processed, success, failed };
}

export async function retryMoyskladSyncJob(jobId: number) {
  const db = getDb();
  await db
    .update(moyskladSyncJobs)
    .set({
      status: JOB_STATUS_PENDING,
      nextRunAt: new Date(),
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(moyskladSyncJobs.id, jobId));
  return { success: true };
}

export async function syncOrderToMoyskladManually(orderId: number) {
  await enqueueMoyskladSyncJob({
    entityType: "order",
    entityId: orderId,
    action: "create",
    payloadSnapshot: { source: "manual" },
  });
  return { success: true };
}

export async function getMoyskladOrderSyncQueue(limit = 100) {
  const db = getDb();
  return db
    .select({
      id: moyskladSyncJobs.id,
      entityType: moyskladSyncJobs.entityType,
      entityId: moyskladSyncJobs.entityId,
      action: moyskladSyncJobs.action,
      status: moyskladSyncJobs.status,
      attempts: moyskladSyncJobs.attempts,
      nextRunAt: moyskladSyncJobs.nextRunAt,
      lockedAt: moyskladSyncJobs.lockedAt,
      lastError: moyskladSyncJobs.lastError,
      payloadSnapshot: moyskladSyncJobs.payloadSnapshot,
      createdAt: moyskladSyncJobs.createdAt,
      updatedAt: moyskladSyncJobs.updatedAt,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      storeName: stores.name,
    })
    .from(moyskladSyncJobs)
    .leftJoin(orders, and(
      eq(moyskladSyncJobs.entityType, "order"),
      eq(moyskladSyncJobs.entityId, orders.id)
    ))
    .leftJoin(stores, eq(orders.storeId, stores.id))
    .orderBy(desc(moyskladSyncJobs.createdAt))
    .limit(limit);
}

export async function getMoyskladOrderSyncOverview() {
  const db = getDb();
  const settings = await getMoyskladOrderSyncSettings();
  const config = await validateMoyskladConfig();

  const [queueCounts] = await db
    .select({
      pending: sql<number>`SUM(CASE WHEN ${moyskladSyncJobs.status} = 'pending' THEN 1 ELSE 0 END)`,
      processing: sql<number>`SUM(CASE WHEN ${moyskladSyncJobs.status} = 'processing' THEN 1 ELSE 0 END)`,
      errors: sql<number>`SUM(CASE WHEN ${moyskladSyncJobs.status} = 'error' THEN 1 ELSE 0 END)`,
      success: sql<number>`SUM(CASE WHEN ${moyskladSyncJobs.status} = 'success' THEN 1 ELSE 0 END)`,
    })
    .from(moyskladSyncJobs);

  const recentOrders = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      moyskladSyncStatus: orders.moyskladSyncStatus,
      moyskladSyncedAt: orders.moyskladSyncedAt,
      moyskladLastError: orders.moyskladLastError,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .where(or(
      isNotNull(orders.moyskladOrderId),
      inArray(orders.moyskladSyncStatus, ["pending", "error", "processing"])
    ))
    .orderBy(desc(orders.createdAt))
    .limit(20);

  const recentLogs = await db
    .select()
    .from(syncLogs)
    .where(eq(syncLogs.type, "moysklad_order_sync"))
    .orderBy(desc(syncLogs.createdAt))
    .limit(20);

  return {
    settings,
    config,
    queueCounts: {
      pending: Number(queueCounts?.pending ?? 0),
      processing: Number(queueCounts?.processing ?? 0),
      errors: Number(queueCounts?.errors ?? 0),
      success: Number(queueCounts?.success ?? 0),
    },
    recentOrders,
    recentLogs,
    localStatuses: [...LOCAL_ORDER_STATUSES],
  };
}

export async function getOrderMoyskladSyncLog(orderId: number) {
  const db = getDb();
  const order = await loadOrderForSync(db, orderId);
  const jobs = await db
    .select()
    .from(moyskladSyncJobs)
    .where(
      and(
        eq(moyskladSyncJobs.entityType, "order"),
        eq(moyskladSyncJobs.entityId, orderId)
      )
    )
    .orderBy(desc(moyskladSyncJobs.createdAt));

  const history = await db
    .select()
    .from(orderHistory)
    .where(eq(orderHistory.orderId, orderId))
    .orderBy(desc(orderHistory.createdAt))
    .limit(50);

  return { order, jobs, history };
}

export async function ingestMoyskladOrderWebhook(requestId: string, payload: unknown) {
  const db = getDb();
  const result = await db
    .insert(moyskladWebhookEvents)
    .values({
      requestId,
      payload: payload as Record<string, unknown>,
      status: JOB_STATUS_PENDING,
    })
    .onDuplicateKeyUpdate({
      set: {
        requestId,
      },
    });

  const insertMeta =
    (Array.isArray(result) ? result[0] : result) as { insertId?: number } | undefined;
  const insertId = Number(insertMeta?.insertId ?? 0);
  if (insertId > 0) {
    await enqueueMoyskladSyncJob({
      entityType: "webhook",
      entityId: insertId,
      action: "webhook_process",
      payloadSnapshot: { requestId },
    });
  }

  return {
    inserted: insertId > 0,
    webhookEventId: insertId || null,
  };
}
