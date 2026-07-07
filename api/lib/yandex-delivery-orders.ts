import { randomUUID } from "node:crypto";

import { TRPCError } from "@trpc/server";
import { asc, eq, isNotNull, sql } from "drizzle-orm";

import { getDb } from "../queries/connection";
import { orderHistory, orderItems, orders, products, stores } from "@db/schema";
import {
  createAndProcessYandexDeliveryOrder,
  getYandexDeliveryOrderInfo,
  mapYandexDeliveryStatusToLocal,
} from "./yandex-delivery-client";
import { getAppSetting, setAppSetting } from "./app-settings";
import { getOrderDbCapabilities } from "./order-compat";

const YANDEX_DELIVERY_SYNC_LOCK_KEY = "yandex_delivery_sync_worker_lock";
const YANDEX_DELIVERY_SYNC_LOCK_TTL_MS = 4 * 60_000;
const YANDEX_DELIVERY_SYNC_MIN_AGE_MS = 2 * 60_000;

type WorkerLockPayload = {
  owner: string;
  startedAt: number;
  expiresAt: number;
};

type DeliveryOrderCore = {
  id: number;
  storeId: number | null;
  totalPrice: number;
  status: string | null;
  paymentStatus: string | null;
  deliveryStatus: string | null;
  deliveryType: string | null;
  deliveryService: string | null;
  deliveryProvider: string | null;
  deliveryProviderOrderId: string | null;
  deliveryProviderOfferId: string | null;
  deliveryProviderStatus: string | null;
  deliveryProviderLastSyncAt: Date | null;
  deliveryProviderError: string | null;
  deliveryProviderRawJson: unknown;
  address: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  customerName: string | null;
  customerComment?: string | null;
  orderNumber: string | null;
};

function parseWorkerLock(raw: string | null) {
  if (!raw) return null;
  try {
    const payload = JSON.parse(raw) as WorkerLockPayload;
    if (!payload?.owner || !payload?.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

async function tryAcquireWorkerLock(settingKey: string, payload: WorkerLockPayload) {
  const db = getDb();
  const rawPayload = JSON.stringify(payload);
  const now = Date.now();

  await db.execute(sql`
    INSERT INTO app_settings (\`key\`, \`value\`, \`updated_at\`)
    VALUES (${settingKey}, ${rawPayload}, NOW())
    ON DUPLICATE KEY UPDATE
      \`value\` = IF(
        \`value\` IS NULL
        OR JSON_EXTRACT(\`value\`, '$.expiresAt') IS NULL
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(\`value\`, '$.expiresAt')) AS UNSIGNED) <= ${now},
        VALUES(\`value\`),
        \`value\`
      ),
      \`updated_at\` = IF(
        \`value\` IS NULL
        OR JSON_EXTRACT(\`value\`, '$.expiresAt') IS NULL
        OR CAST(JSON_UNQUOTE(JSON_EXTRACT(\`value\`, '$.expiresAt')) AS UNSIGNED) <= ${now},
        VALUES(\`updated_at\`),
        \`updated_at\`
      )
  `);

  const current = parseWorkerLock(await getAppSetting(settingKey));
  return current?.owner === payload.owner ? payload : null;
}

async function acquireSyncWorkerLock(ttlMs = YANDEX_DELIVERY_SYNC_LOCK_TTL_MS) {
  const payload: WorkerLockPayload = {
    owner: randomUUID(),
    startedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  };
  return tryAcquireWorkerLock(YANDEX_DELIVERY_SYNC_LOCK_KEY, payload);
}

async function releaseSyncWorkerLock(owner: string | null | undefined) {
  if (!owner) return;
  const current = parseWorkerLock(await getAppSetting(YANDEX_DELIVERY_SYNC_LOCK_KEY));
  if (current?.owner !== owner) return;
  await setAppSetting(YANDEX_DELIVERY_SYNC_LOCK_KEY, null);
}

function legacyDeliveryStatusFromRow(row: {
  status?: string | null;
  deliveryType?: string | null;
}) {
  if (row.deliveryType === "delivery") return "awaiting_processing";
  return "not_required";
}

function withFallbackDeliveryStatus<T extends {
  status?: string | null;
  deliveryType?: string | null;
  deliveryStatus?: string | null;
}>(row: T | undefined) {
  if (!row) return row;
  if (typeof row.deliveryStatus === "string" && row.deliveryStatus.trim().length > 0) {
    return row;
  }
  return {
    ...row,
    deliveryStatus: legacyDeliveryStatusFromRow({
      status: row.status ?? null,
      deliveryType: row.deliveryType ?? null,
    }),
  };
}

async function safeInsertOrderHistory(payload: typeof orderHistory.$inferInsert) {
  try {
    await getDb().insert(orderHistory).values(payload);
  } catch (error) {
    console.error("[yandex-delivery] order history insert skipped", error);
  }
}

export async function assertYandexDeliverySchemaReady(db: ReturnType<typeof getDb>) {
  const capabilities = await getOrderDbCapabilities(db, { forceRefresh: true });
  if (!capabilities.hasOrdersDeliveryProviderMetadata) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Схема заказов ещё не обновлена для Яндекс Доставки. Сначала примените migration 0037.",
    });
  }
  return capabilities;
}

export async function getOrderCoreForYandexDelivery(
  db: ReturnType<typeof getDb>,
  orderId: number,
) {
  const rows = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      totalPrice: orders.totalPrice,
      status: orders.status,
      paymentStatus: orders.paymentStatus,
      deliveryStatus: orders.deliveryStatus,
      deliveryType: orders.deliveryType,
      deliveryService: orders.deliveryService,
      deliveryProvider: orders.deliveryProvider,
      deliveryProviderOrderId: orders.deliveryProviderOrderId,
      deliveryProviderOfferId: orders.deliveryProviderOfferId,
      deliveryProviderStatus: orders.deliveryProviderStatus,
      deliveryProviderLastSyncAt: orders.deliveryProviderLastSyncAt,
      deliveryProviderError: orders.deliveryProviderError,
      deliveryProviderRawJson: orders.deliveryProviderRawJson,
      address: orders.address,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      customerName: orders.customerName,
      customerComment: orders.customerComment,
      orderNumber: orders.orderNumber,
    })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  return withFallbackDeliveryStatus(rows[0]) as DeliveryOrderCore | undefined;
}

export async function resolveDeliveryStore(
  db: ReturnType<typeof getDb>,
  order: { storeId?: number | null },
) {
  const byId =
    typeof order.storeId === "number" && Number.isFinite(order.storeId)
      ? await db
          .select({
            id: stores.id,
            name: stores.name,
            address: stores.address,
          })
          .from(stores)
          .where(eq(stores.id, order.storeId))
          .limit(1)
      : [];

  const fallback = byId[0]
    ? byId[0]
    : (
        await db
          .select({
            id: stores.id,
            name: stores.name,
            address: stores.address,
          })
          .from(stores)
          .orderBy(stores.sortOrder, stores.id)
          .limit(1)
      )[0];

  if (!fallback?.address?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Для Яндекс Доставки не найден магазин-источник с заполненным адресом.",
    });
  }

  return fallback;
}

export async function buildOrderItemSummary(
  db: ReturnType<typeof getDb>,
  orderId: number,
) {
  const itemRows = await db
    .select({
      productName: sql<string>`coalesce(${orderItems.productName}, ${products.name})`,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .leftJoin(products, eq(orderItems.productId, products.id))
    .where(eq(orderItems.orderId, orderId))
    .orderBy(orderItems.id)
    .limit(4);

  if (!itemRows.length) return "Заказ без позиций";

  return itemRows
    .map(item => `${item.productName} x${item.quantity}`)
    .join("; ")
    .slice(0, 900);
}

export async function patchOrderYandexDeliveryState(
  db: ReturnType<typeof getDb>,
  orderId: number,
  patch: Partial<{
    deliveryStatus: string | null;
    deliveryService: string | null;
    deliveryProvider: string | null;
    deliveryProviderOrderId: string | null;
    deliveryProviderOfferId: string | null;
    deliveryProviderStatus: string | null;
    deliveryProviderLastSyncAt: Date | null;
    deliveryProviderError: string | null;
    deliveryProviderRawJson: unknown;
  }>,
) {
  await db
    .update(orders)
    .set({
      ...(typeof patch.deliveryStatus === "string"
        ? { deliveryStatus: patch.deliveryStatus }
        : {}),
      ...(patch.deliveryService !== undefined
        ? { deliveryService: patch.deliveryService }
        : {}),
      ...(patch.deliveryProvider !== undefined
        ? { deliveryProvider: patch.deliveryProvider }
        : {}),
      ...(patch.deliveryProviderOrderId !== undefined
        ? { deliveryProviderOrderId: patch.deliveryProviderOrderId }
        : {}),
      ...(patch.deliveryProviderOfferId !== undefined
        ? { deliveryProviderOfferId: patch.deliveryProviderOfferId }
        : {}),
      ...(patch.deliveryProviderStatus !== undefined
        ? { deliveryProviderStatus: patch.deliveryProviderStatus }
        : {}),
      ...(patch.deliveryProviderLastSyncAt !== undefined
        ? { deliveryProviderLastSyncAt: patch.deliveryProviderLastSyncAt }
        : {}),
      ...(patch.deliveryProviderError !== undefined
        ? { deliveryProviderError: patch.deliveryProviderError }
        : {}),
      ...(patch.deliveryProviderRawJson !== undefined
        ? { deliveryProviderRawJson: patch.deliveryProviderRawJson as any }
        : {}),
      updatedAt: new Date(),
    } as any)
    .where(eq(orders.id, orderId));
}

export async function createYandexDeliveryOrderForOrder(params: {
  db?: ReturnType<typeof getDb>;
  orderId: number;
  actorUserId?: number | null;
  historyActionType?: string;
}) {
  const db = params.db ?? getDb();
  await assertYandexDeliverySchemaReady(db);
  const order = await getOrderCoreForYandexDelivery(db, params.orderId);

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Заказ не найден" });
  }
  if (order.deliveryType !== "delivery") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Яндекс Доставка создаётся только для заказов с доставкой.",
    });
  }
  if (!order.address?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "У заказа не заполнен адрес доставки.",
    });
  }
  if (!order.customerPhone?.trim()) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "У заказа не заполнен телефон клиента.",
    });
  }

  const sourceStore = await resolveDeliveryStore(db, order);
  const itemSummary = await buildOrderItemSummary(db, order.id);

  try {
    const providerResult = await createAndProcessYandexDeliveryOrder({
      sourceAddress: sourceStore.address,
      destinationAddress: order.address,
      customerPhone: order.customerPhone,
      customerName: order.customerName || null,
      customerComment: order.customerComment || null,
      orderNumber: order.orderNumber || `ORDER-${order.id}`,
      itemSummary,
      totalPrice: order.totalPrice,
    });

    const providerStatus =
      providerResult.status?.full ||
      providerResult.status?.simple ||
      "unknown";
    const localDeliveryStatus = mapYandexDeliveryStatusToLocal(providerStatus);

    await patchOrderYandexDeliveryState(db, order.id, {
      deliveryStatus: localDeliveryStatus,
      deliveryService: "yandex_delivery",
      deliveryProvider: "yandex_delivery",
      deliveryProviderOrderId: providerResult.providerOrderId,
      deliveryProviderOfferId: providerResult.providerOfferId,
      deliveryProviderStatus: providerStatus,
      deliveryProviderLastSyncAt: new Date(),
      deliveryProviderError: null,
      deliveryProviderRawJson: providerResult.raw,
    });

    await safeInsertOrderHistory({
      orderId: order.id,
      userId: params.actorUserId ?? null,
      actionType: params.historyActionType || "yandex_delivery_created",
      newValue: {
        provider: "yandex_delivery",
        providerOrderId: providerResult.providerOrderId,
        providerOfferId: providerResult.providerOfferId,
        providerStatus,
        deliveryStatus: localDeliveryStatus,
        sourceStoreId: sourceStore.id,
        sourceStoreName: sourceStore.name,
      } as any,
    });

    return {
      success: true,
      providerOrderId: providerResult.providerOrderId,
      providerOfferId: providerResult.providerOfferId,
      providerStatus,
      deliveryStatus: localDeliveryStatus,
      sourceStore,
    };
  } catch (error: any) {
    const message =
      error instanceof TRPCError
        ? error.message
        : error?.message || "Не удалось создать заявку Яндекс Доставки.";

    await patchOrderYandexDeliveryState(db, order.id, {
      deliveryProvider: "yandex_delivery",
      deliveryProviderError: message,
      deliveryProviderLastSyncAt: new Date(),
    });

    await safeInsertOrderHistory({
      orderId: order.id,
      userId: params.actorUserId ?? null,
      actionType: "yandex_delivery_error",
      comment: message,
      newValue: {
        provider: "yandex_delivery",
        action: "create",
      } as any,
    });
    throw error;
  }
}

export async function refreshYandexDeliveryOrderForOrder(params: {
  db?: ReturnType<typeof getDb>;
  orderId: number;
  actorUserId?: number | null;
  writeHistory?: boolean;
  historyActionType?: string;
}) {
  const db = params.db ?? getDb();
  await assertYandexDeliverySchemaReady(db);
  const order = await getOrderCoreForYandexDelivery(db, params.orderId);

  if (!order) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Заказ не найден" });
  }
  if (!order.deliveryProviderOrderId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "У заказа ещё нет созданной заявки Яндекс Доставки.",
    });
  }

  try {
    const providerInfo = await getYandexDeliveryOrderInfo(order.deliveryProviderOrderId);
    const providerStatus =
      providerInfo?.status?.full ||
      providerInfo?.status?.simple ||
      order.deliveryProviderStatus ||
      "unknown";
    const localDeliveryStatus = mapYandexDeliveryStatusToLocal(providerStatus);

    await patchOrderYandexDeliveryState(db, order.id, {
      deliveryStatus: localDeliveryStatus,
      deliveryService: "yandex_delivery",
      deliveryProvider: "yandex_delivery",
      deliveryProviderStatus: providerStatus,
      deliveryProviderLastSyncAt: new Date(),
      deliveryProviderError: null,
      deliveryProviderRawJson: providerInfo,
    });

    const shouldWriteHistory =
      params.writeHistory ??
      (order.deliveryProviderStatus !== providerStatus ||
        order.deliveryStatus !== localDeliveryStatus);

    if (shouldWriteHistory) {
      await safeInsertOrderHistory({
        orderId: order.id,
        userId: params.actorUserId ?? null,
        actionType: params.historyActionType || "yandex_delivery_refreshed",
        newValue: {
          provider: "yandex_delivery",
          providerOrderId: order.deliveryProviderOrderId,
          providerStatus,
          deliveryStatus: localDeliveryStatus,
        } as any,
      });
    }

    return {
      success: true,
      providerOrderId: order.deliveryProviderOrderId,
      providerStatus,
      deliveryStatus: localDeliveryStatus,
    };
  } catch (error: any) {
    const message =
      error instanceof TRPCError
        ? error.message
        : error?.message || "Не удалось обновить статус Яндекс Доставки.";

    await patchOrderYandexDeliveryState(db, order.id, {
      deliveryProviderError: message,
      deliveryProviderLastSyncAt: new Date(),
    });

    if (params.writeHistory ?? false) {
      await safeInsertOrderHistory({
        orderId: order.id,
        userId: params.actorUserId ?? null,
        actionType: "yandex_delivery_error",
        comment: message,
        newValue: {
          provider: "yandex_delivery",
          action: "refresh",
          providerOrderId: order.deliveryProviderOrderId,
        } as any,
      });
    }

    throw error;
  }
}

function isTerminalProviderStatus(status: string | null | undefined) {
  const normalized = (status || "").trim().toLowerCase();
  return (
    normalized === "delivered" ||
    normalized === "cancelled" ||
    normalized === "failed" ||
    normalized === "returned"
  );
}

function isTerminalLocalStatus(status: string | null | undefined) {
  const normalized = (status || "").trim().toLowerCase();
  return (
    normalized === "delivered" ||
    normalized === "delivery_error" ||
    normalized === "not_required"
  );
}

export async function processYandexDeliveryStatusSync(limit = 10) {
  const db = getDb();
  const lock = await acquireSyncWorkerLock();
  if (!lock) {
    return { skipped: true as const, reason: "worker_locked" as const, processed: 0, success: 0, failed: 0 };
  }

  try {
    await assertYandexDeliverySchemaReady(db);
    const rows = await db
      .select({
        id: orders.id,
        deliveryStatus: orders.deliveryStatus,
        deliveryProviderOrderId: orders.deliveryProviderOrderId,
        deliveryProviderStatus: orders.deliveryProviderStatus,
        deliveryProviderLastSyncAt: orders.deliveryProviderLastSyncAt,
      })
      .from(orders)
      .where(eq(orders.deliveryProvider, "yandex_delivery"))
      .orderBy(asc(orders.deliveryProviderLastSyncAt), asc(orders.id))
      .limit(Math.max(limit * 4, 25));

    const now = Date.now();
    const candidates = rows
      .filter(row => row.deliveryProviderOrderId)
      .filter(
        row =>
          !isTerminalProviderStatus(row.deliveryProviderStatus) &&
          !isTerminalLocalStatus(row.deliveryStatus),
      )
      .filter(row => {
        if (!row.deliveryProviderLastSyncAt) return true;
        return now - row.deliveryProviderLastSyncAt.getTime() >= YANDEX_DELIVERY_SYNC_MIN_AGE_MS;
      })
      .slice(0, limit);

    let success = 0;
    let failed = 0;

    for (const row of candidates) {
      try {
        await refreshYandexDeliveryOrderForOrder({
          db,
          orderId: row.id,
          writeHistory: false,
          historyActionType: "yandex_delivery_auto_refreshed",
        });
        success += 1;
      } catch (error) {
        failed += 1;
        console.error(`[yandex-delivery-sync] failed for order ${row.id}:`, error);
      }
    }

    return {
      skipped: false as const,
      processed: candidates.length,
      success,
      failed,
    };
  } finally {
    await releaseSyncWorkerLock(lock.owner);
  }
}
