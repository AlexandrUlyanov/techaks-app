import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems, orderComments, orderHistory, products, productReviewRequests, stores, productReservations, productStocks, productVariantStocks, productVariants, categories, productReviews, syncRuns, moyskladSyncJobs } from "@db/schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { env } from "../lib/env";
import { sendOrderNotificationEmail, sendReviewRequestEmail } from "../lib/mail";
import { isProductVisibleOnSite } from "@contracts/product-visibility";
import { ensureReviewRequestRowsForOrder } from "../lib/product-reviews";
import {
  assertReservableProductSelection,
  assertStoreExists,
  assertValidReservationPhone,
  backfillUserPhoneIfMissing,
  DEFAULT_RESERVATION_DURATION_MINUTES,
  expireDueReservations,
  findExistingActiveReservation,
  getAvailableStock,
  getProductReservationSummary,
  getProductStoreAvailability,
  getReservationDurationMinutes,
  getReservationExpiryDate,
  RESERVATION_STATUS_ACTIVE,
  RESERVATION_STATUS_CANCELLED,
  RESERVATION_STATUS_CONVERTED,
  RESERVATION_STATUS_EXPIRED,
} from "../lib/product-reservations";
import { normalizePhone } from "@contracts/phone";
import { enqueueMoyskladSyncJob } from "../lib/moysklad-order-sync";
import {
  buildOrdersCsv,
  buildOrdersExportTable,
  buildLegacyOrderWhereSql,
  buildModernOrderWhere,
  canUseModernOrderDeliverySchema,
  canUseModernOrderDetailsSchema,
  canUseModernOrderInsertSchema,
  canUseModernOrderPaymentSchema,
  canUseRichOrdersSchema,
  getOrderDbCapabilities,
  legacyDeliveryStatusFromRow,
  mapLegacyListOrderRow,
  mapLegacyOrderDetailsRow,
  mapLegacyOrderItemRow,
  rowsFromExecute,
} from "../lib/order-compat";
import {
  createYooKassaPaymentForOrder,
  refreshYooKassaPaymentForOrder,
} from "../lib/yookassa";
import { extractReceiptMeta } from "../lib/order-receipts";
import {
  calculateYandexDeliveryOffers,
  cancelYandexDeliveryOrder as cancelYandexDeliveryProviderOrder,
  mapYandexDeliveryStatusToLocal,
} from "../lib/yandex-delivery-client";
import {
  searchPenzaDeliveryAddresses,
  validatePenzaDeliveryAddress,
} from "../lib/delivery-address-geocode";
import {
  assertYandexDeliverySchemaReady,
  buildOrderItemSummary,
  createYandexDeliveryOrderForOrder,
  getOrderCoreForYandexDelivery,
  patchOrderYandexDeliveryState,
  refreshYandexDeliveryOrderForOrder,
  resolveDeliveryStore,
} from "../lib/yandex-delivery-orders";
import {
  attachLoyaltyToOrder,
  enqueueLoyaltySyncJob,
  getUserLoyaltyState,
  listUserBonusTransactions,
  previewBonusWriteoff,
  syncOrderLoyaltyFromMoysklad,
  refreshUserLoyaltyState,
} from "../lib/moysklad-loyalty";

const PUBLIC_SITE_URL = env.isProduction ? "https://techaks.ru" : "http://localhost:5173";
const ACCOUNT_ORDERS_URL = `${PUBLIC_SITE_URL}/account`;
const PLACEHOLDER_EMAIL_DOMAIN = "@placeholder.techaks.ru";

function normalizeDeliveryAddressPart(value: string | null | undefined) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function isLikelyValidDeliveryStreetInput(value: string) {
  const street = normalizeDeliveryAddressPart(value);
  if (street.length < 4 || street.length > 80) return false;
  if (!/[A-Za-zА-Яа-яЁё]/.test(street)) return false;
  if (/^\d+$/.test(street)) return false;
  return true;
}

function isLikelyValidDeliveryHouseInput(value: string) {
  const house = normalizeDeliveryAddressPart(value);
  if (!house) return false;
  return /^\d{1,4}[A-Za-zА-Яа-яЁё]?(?:[\/-]\d{1,4}[A-Za-zА-Яа-яЁё]?)?(?:\s?(?:к|корп|корпус|стр|строение)\.?\s?\d{1,3}[A-Za-zА-Яа-яЁё]?)?$/i.test(
    house,
  );
}

function buildStructuredDeliveryAddress(params: {
  street: string;
  house: string;
  apartment?: string | null;
}) {
  const street = normalizeDeliveryAddressPart(params.street);
  const house = normalizeDeliveryAddressPart(params.house);
  const apartment = normalizeDeliveryAddressPart(params.apartment ?? "");
  const base = [street, house].filter(Boolean).join(", ");
  if (!base) return "";
  return apartment ? `${base}, кв./офис ${apartment}` : base;
}

function buildPlaceholderEmail(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return `${digits || "guest"}${PLACEHOLDER_EMAIL_DOMAIN}`;
}

function isPlaceholderEmail(email?: string | null) {
  return Boolean(email && email.toLowerCase().endsWith(PLACEHOLDER_EMAIL_DOMAIN));
}

type AccountOrderViewer = {
  id: number;
  phone: string | null;
  email: string | null;
};

async function resolveAccountViewerContext(
  db: ReturnType<typeof getDb>,
  user: AccountOrderViewer
) {
  const phoneForLookup = (user.phone || "").trim();
  const emailForLookup = user.email?.trim().toLowerCase() || null;
  const relatedUserIds = new Set<number>([user.id]);
  const userIdentityConditions = [];

  if (phoneForLookup) {
    userIdentityConditions.push(eq(users.phone, phoneForLookup));
  }
  if (emailForLookup) {
    userIdentityConditions.push(eq(users.email, emailForLookup));
  }

  if (userIdentityConditions.length > 0) {
    const relatedUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(
        userIdentityConditions.length === 1
          ? userIdentityConditions[0]
          : or(...userIdentityConditions)
      );
    for (const relatedUser of relatedUsers) {
      relatedUserIds.add(relatedUser.id);
    }
  }

  return {
    phoneForLookup,
    emailForLookup,
    relatedUserIds,
  };
}

function buildAccountOrderLookupConditions(
  relatedUserIds: Set<number>,
  phoneForLookup: string,
  emailForLookup: string | null,
  capabilities: Awaited<ReturnType<typeof getOrderDbCapabilities>>
) {
  const relatedUserIdList = Array.from(relatedUserIds);
  const orderLookupConditions =
    relatedUserIdList.length > 1
      ? [inArray(orders.userId, relatedUserIdList)]
      : [eq(orders.userId, relatedUserIdList[0])];

  if (phoneForLookup && capabilities.hasOrdersCustomerFields) {
    orderLookupConditions.push(eq(orders.customerPhone, phoneForLookup));
  }
  if (emailForLookup && capabilities.hasOrdersCustomerFields) {
    orderLookupConditions.push(eq(orders.customerEmail, emailForLookup));
  }

  return orderLookupConditions;
}

async function canViewerAccessOrder(
  db: ReturnType<typeof getDb>,
  orderId: number,
  viewer: AccountOrderViewer,
  capabilities: Awaited<ReturnType<typeof getOrderDbCapabilities>>
) {
  const { phoneForLookup, emailForLookup, relatedUserIds } =
    await resolveAccountViewerContext(db, viewer);

  if (capabilities.detected && !canUseRichOrdersSchema(capabilities)) {
    const legacyConditions = Array.from(relatedUserIds).map(
      relatedUserId => sql`user_id = ${relatedUserId}`
    );
    if (phoneForLookup && capabilities.hasOrdersCustomerFields) {
      legacyConditions.push(sql`customer_phone = ${phoneForLookup}`);
    }
    if (emailForLookup && capabilities.hasOrdersCustomerFields) {
      legacyConditions.push(sql`customer_email = ${emailForLookup}`);
    }

    const raw = await db.execute<any[]>(sql`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
        AND (${sql.join(legacyConditions, sql` OR `)})
      LIMIT 1
    `);
    return rowsFromExecute<any>(raw).length > 0;
  }

  const orderLookupConditions = buildAccountOrderLookupConditions(
    relatedUserIds,
    phoneForLookup,
    emailForLookup,
    capabilities
  );

  const result = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.id, orderId),
        orderLookupConditions.length === 1
          ? orderLookupConditions[0]
          : or(...orderLookupConditions)
      )
    )
    .limit(1);

  return result.length > 0;
}

const ORDER_STATUS_FLOW: Record<string, string[]> = {
  pending: ["confirmed", "awaiting_payment", "processing", "cancelled", "problem"],
  waiting_call: ["confirmed", "processing", "cancelled", "problem"],
  awaiting_payment: ["paid", "processing", "cancelled", "problem"],
  paid: ["processing", "confirmed_by_customer", "ready_for_pickup", "cancelled", "problem"],
  processing: ["confirmed_by_customer", "ready_for_pickup", "assembling", "cancelled", "problem"],
  confirmed: ["processing", "ready_for_pickup", "cancelled", "problem"],
  confirmed_by_customer: ["ready_for_pickup", "assembling", "cancelled", "problem"],
  ready_for_pickup: ["assembling", "assembled", "awaiting_dispatch", "cancelled", "problem"],
  assembling: ["assembled", "cancelled", "problem"],
  assembled: ["awaiting_dispatch", "handed_to_delivery", "cancelled", "problem"],
  awaiting_dispatch: ["handed_to_delivery", "in_delivery", "cancelled", "problem"],
  shipped: ["in_delivery", "delivered", "problem"],
  handed_to_delivery: ["in_delivery", "delivered", "problem"],
  in_delivery: ["delivered", "problem"],
  delivered: ["completed", "return_requested", "problem"],
  completed: ["return_requested"],
  cancelled: [],
  return_requested: ["cancelled", "problem"],
  problem: ["processing", "cancelled", "completed"],
};

const PAYMENT_STATUS_FLOW: Record<string, string[]> = {
  unpaid: ["awaiting_payment", "paid", "payment_error", "partially_paid", "refund"],
  awaiting_payment: ["paid", "payment_error", "partially_paid", "refund"],
  partially_paid: ["paid", "refund", "partial_refund", "payment_error"],
  paid: ["refund", "partial_refund"],
  payment_error: ["awaiting_payment", "paid", "cancelled"],
  refund: [],
  partial_refund: ["refund"],
};

const DELIVERY_STATUS_FLOW: Record<string, string[]> = {
  not_required: [],
  awaiting_processing: ["prepared", "handed_to_delivery", "in_delivery", "delivery_error"],
  prepared: ["handed_to_delivery", "in_delivery", "delivery_error"],
  handed_to_delivery: ["in_delivery", "delivered", "delivery_error"],
  in_delivery: ["delivered", "return_in_transit", "delivery_error"],
  delivered: ["return_in_transit"],
  return_in_transit: ["delivery_error"],
  delivery_error: ["awaiting_processing", "prepared", "handed_to_delivery"],
};

function ensureTransition(
  flow: Record<string, string[]>,
  fromStatus: string,
  toStatus: string,
  kind: "заказа" | "оплаты" | "доставки"
) {
  if (fromStatus === toStatus) return;
  const next = flow[fromStatus] ?? [];
  if (!next.includes(toStatus)) {
    throw new Error(
      `Недопустимый переход статуса ${kind}: "${fromStatus}" → "${toStatus}"`
    );
  }
}

function ensureOrderOperationAllowedByRole(
  role: string | undefined,
  operation:
    | "update_status"
    | "update_details"
    | "update_payment"
    | "update_delivery"
    | "update_item"
    | "remove_item"
    | "add_comment",
  payload?: { nextStatus?: string }
) {
  const safeRole = role ?? "customer";
  if (safeRole === "super_admin" || safeRole === "admin") return;

  if (safeRole === "warehouse") {
    if (operation === "update_status") {
      const allowed = ["ready_for_pickup", "assembling", "assembled", "problem"];
      if (!payload?.nextStatus || !allowed.includes(payload.nextStatus)) {
        throw new Error("Роль склада не может установить этот статус заказа");
      }
      return;
    }
    if (operation === "add_comment") return;
    throw new Error("Роль склада не имеет прав на это действие");
  }

  if (safeRole === "manager") {
    if (
      operation === "update_status" ||
      operation === "update_details" ||
      operation === "update_delivery" ||
      operation === "add_comment"
    ) {
      return;
    }
    throw new Error("Менеджеру недоступно это действие");
  }

  throw new Error("Недостаточно прав для операции с заказом");
}

async function safeInsertOrderHistory(db: ReturnType<typeof getDb>, payload: any) {
  try {
    await db.insert(orderHistory).values(payload);
  } catch (err) {
    console.error("order history insert skipped (legacy schema)", err);
  }
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

async function sendReviewInvitationsForCompletedOrder(
  db: ReturnType<typeof getDb>,
  orderId: number
) {
  const inserted = await ensureReviewRequestRowsForOrder(db, orderId);
  if (inserted.length === 0) return { created: 0, sent: 0 };

  const requestLookup = new Map(
    inserted.map(item => [`${item.orderId}:${item.productId}:${item.userId}`, item] as const)
  );

  const rows = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      userId: users.id,
      customerName: users.fullName,
      customerEmail: users.email,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .innerJoin(products, eq(orderItems.productId, products.id))
    .innerJoin(users, eq(orders.userId, users.id))
    .where(eq(orderItems.orderId, orderId));

  let sent = 0;
  for (const row of rows) {
    if (!requestLookup.has(`${row.orderId}:${row.productId}:${row.userId}`)) continue;
    await sendReviewRequestEmail({
      email: row.customerEmail,
      customerName: row.customerName,
      orderNumber: row.orderNumber,
      productName: row.productName,
      reviewUrl: `${PUBLIC_SITE_URL}/product/${row.productSlug}#reviews`,
    }).catch(err => {
      console.error("review invitation email failed", err);
    });
    await db
      .update(productReviewRequests)
      .set({
        initialSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(productReviewRequests.orderId, row.orderId),
          eq(productReviewRequests.productId, row.productId)
        )
      );
    sent += 1;
  }

  return { created: inserted.length, sent };
}

async function loadOrdersForExport(
  db: ReturnType<typeof getDb>,
  input:
    | {
        search?: string;
        statuses?: string[];
        paymentStatuses?: string[];
        deliveryTypes?: string[];
        dateFrom?: Date;
        dateTo?: Date;
      }
    | undefined
) {
  const capabilities = await getOrderDbCapabilities(db);
  if (canUseRichOrdersSchema(capabilities)) {
    const rows = await db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        createdAt: orders.createdAt,
        customerName: sql<string>`coalesce(${orders.customerName}, ${users.fullName})`,
        customerPhone: sql<string>`coalesce(${orders.customerPhone}, ${users.phone})`,
        customerEmail: sql<string>`coalesce(${orders.customerEmail}, ${users.email})`,
        totalPrice: orders.totalPrice,
        subtotal: orders.subtotal,
        discountTotal: orders.discountTotal,
        deliveryPrice: orders.deliveryPrice,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        deliveryType: orders.deliveryType,
        deliveryStatus: orders.deliveryStatus,
        source: orders.source,
        address: orders.address,
      })
      .from(orders)
      .leftJoin(users, eq(orders.userId, users.id))
      .where(buildModernOrderWhere(input))
      .orderBy(desc(orders.createdAt))
      .limit(5000);

    return {
      rows,
      compatibilityMode: "modern" as const,
      compatibilityWarnings: [] as string[],
    };
  }

  const legacyWhereSql = buildLegacyOrderWhereSql({
    search: input?.search,
    statuses: input?.statuses,
    paymentStatuses: input?.paymentStatuses,
    deliveryTypes: input?.deliveryTypes,
    dateFrom: input?.dateFrom,
    dateTo: input?.dateTo,
    supportsUserEmail: capabilities.hasUsersEmail,
    supportsUserFullName: capabilities.hasUsersFullName,
  });
  const legacyRowsResult = await db.execute<any[]>(sql`
    SELECT
      o.id,
      NULL AS orderNumber,
      o.created_at AS createdAt,
      ${capabilities.hasUsersFullName ? sql`u.full_name` : sql`NULL`} AS customerName,
      NULL AS customerPhone,
      ${capabilities.hasUsersEmail ? sql`u.email` : sql`NULL`} AS customerEmail,
      o.total_price AS totalPrice,
      o.total_price AS subtotal,
      0 AS discountTotal,
      0 AS deliveryPrice,
      o.status,
      o.payment_status AS paymentStatus,
      o.delivery_type AS deliveryType,
      NULL AS deliveryStatus,
      'legacy' AS source,
      o.address
    FROM orders o
    LEFT JOIN users u ON u.id = o.user_id
    ${legacyWhereSql}
    ORDER BY o.created_at DESC
    LIMIT 5000
  `);

  return {
    rows: rowsFromExecute<any>(legacyRowsResult),
    compatibilityMode: "legacy" as const,
    compatibilityWarnings: [
      "Экспорт заказов использует legacy-режим совместимости: недостающие поля заполняются безопасными значениями по умолчанию.",
    ],
  };
}

async function getOrderCoreForUpdate(db: ReturnType<typeof getDb>, orderId: number) {
  try {
    const rows = await db
      .select({
        id: orders.id,
        storeId: orders.storeId,
        totalPrice: orders.totalPrice,
        status: orders.status,
        moyskladOrderId: orders.moyskladOrderId,
        moyskladOrderHref: orders.moyskladOrderHref,
        paymentStatus: orders.paymentStatus,
        deliveryStatus: orders.deliveryStatus,
        deliveryType: orders.deliveryType,
        deliveryService: orders.deliveryService,
        deliveryTrackNumber: orders.deliveryTrackNumber,
        deliveryPrice: orders.deliveryPrice,
        deliveryCity: orders.deliveryCity,
        deliveryRegion: orders.deliveryRegion,
        deliveryProvider: orders.deliveryProvider,
        deliveryProviderOrderId: orders.deliveryProviderOrderId,
        deliveryProviderOfferId: orders.deliveryProviderOfferId,
        deliveryProviderStatus: orders.deliveryProviderStatus,
        deliveryProviderLastSyncAt: orders.deliveryProviderLastSyncAt,
        deliveryProviderError: orders.deliveryProviderError,
        deliveryProviderRawJson: orders.deliveryProviderRawJson,
        address: orders.address,
        paymentType: orders.paymentType,
        paymentMethod: orders.paymentMethod,
        customerPhone: orders.customerPhone,
        customerEmail: orders.customerEmail,
        customerName: orders.customerName,
        orderNumber: orders.orderNumber,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    return withFallbackDeliveryStatus(rows[0]);
  } catch (err) {
    console.error("getOrderCoreForUpdate fallback (legacy schema)", err);
    const raw = await db.execute<any[]>(sql`
      SELECT
        id,
        NULL AS storeId,
        total_price AS totalPrice,
        status,
        NULL AS moyskladOrderId,
        NULL AS moyskladOrderHref,
        payment_status AS paymentStatus,
        CASE
          WHEN delivery_type = 'delivery' THEN 'awaiting_processing'
          ELSE 'not_required'
        END AS deliveryStatus,
        delivery_type AS deliveryType,
        NULL AS deliveryService,
        NULL AS deliveryTrackNumber,
        0 AS deliveryPrice,
        NULL AS deliveryCity,
        NULL AS deliveryRegion,
        NULL AS deliveryProvider,
        NULL AS deliveryProviderOrderId,
        NULL AS deliveryProviderOfferId,
        NULL AS deliveryProviderStatus,
        NULL AS deliveryProviderLastSyncAt,
        NULL AS deliveryProviderError,
        NULL AS deliveryProviderRawJson,
        address,
        payment_type AS paymentType,
        payment_type AS paymentMethod,
        NULL AS customerPhone,
        NULL AS customerEmail,
        NULL AS customerName,
        NULL AS orderNumber
      FROM orders
      WHERE id = ${orderId}
      LIMIT 1
    `);
    const rows = Array.isArray((raw as any)?.[0]) ? (raw as any)[0] : (raw as any[]);
    return rows[0];
  }
}

function isOrderStatusManagedByMoysklad(order: {
  moyskladOrderId?: string | null;
  moyskladOrderHref?: string | null;
}) {
  return Boolean(order.moyskladOrderId?.trim() || order.moyskladOrderHref?.trim());
}

function assertOrderStatusEditableLocally(order: {
  id?: number | null;
  orderNumber?: string | null;
  moyskladOrderId?: string | null;
  moyskladOrderHref?: string | null;
}) {
  if (!isOrderStatusManagedByMoysklad(order)) return;
  const humanNumber = order.orderNumber?.trim() || (order.id ? `#${order.id}` : "этого заказа");
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Статус заказа ${humanNumber} управляется из МойСклад. Меняйте его в МойСклад — сайт подтянет обновление автоматически.`,
  });
}

async function getOrderItemCoreForUpdate(
  db: ReturnType<typeof getDb>,
  orderId: number,
  itemId: number
) {
  try {
    const rows = await db
      .select({
        id: orderItems.id,
        orderId: orderItems.orderId,
        quantity: orderItems.quantity,
        price: orderItems.price,
        discount: orderItems.discount,
      })
      .from(orderItems)
      .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, orderId)))
      .limit(1);
    return rows[0];
  } catch (err) {
    console.error("getOrderItemCoreForUpdate fallback (legacy schema)", err);
    const raw = await db.execute<any[]>(sql`
      SELECT
        id,
        order_id AS orderId,
        quantity,
        price,
        0 AS discount
      FROM order_items
      WHERE id = ${itemId} AND order_id = ${orderId}
      LIMIT 1
    `);
    const rows = Array.isArray((raw as any)?.[0]) ? (raw as any)[0] : (raw as any[]);
    return rows[0];
  }
}

type RequestedCartItem = {
  productId: number;
  variantId?: number | null;
  quantity: number;
};

async function resolvePurchasableCartItems(
  db: ReturnType<typeof getDb>,
  inputItems: RequestedCartItem[]
) {
  const requestedProductIds = Array.from(
    new Set(inputItems.map(item => item.productId))
  );
  const requestedVariantIds = Array.from(
    new Set(
      inputItems
        .map(item => item.variantId)
        .filter((variantId): variantId is number => typeof variantId === "number")
    )
  );

  if (requestedProductIds.length === 0) {
    return {
      purchasableItems: [] as Array<{
        cartKey: string;
        productId: number;
        variantId: number | null;
        variantName: string | null;
        article: string | null;
        quantity: number;
        name: string;
        slug: string;
        image: string;
        price: number;
      }>,
      removedItemKeys: [] as string[],
      removedProductIds: [] as number[],
    };
  }

  const productRows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      image: products.image,
      price: products.price,
      isActive: products.isActive,
      isAutoBlocked: products.isAutoBlocked,
      autoBlockReason: products.autoBlockReason,
    })
    .from(products)
    .where(inArray(products.id, requestedProductIds));

  const productById = new Map(productRows.map(product => [product.id, product]));
  const variantRows =
    requestedVariantIds.length > 0
      ? await db
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            name: productVariants.name,
            article: productVariants.article,
            price: productVariants.price,
            stock: productVariants.stock,
            isActive: productVariants.isActive,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, requestedVariantIds))
      : [];
  const variantById = new Map(variantRows.map(variant => [variant.id, variant]));
  const removedProductIds = new Set<number>();
  const removedItemKeys = new Set<string>();
  const purchasableItems: Array<{
    cartKey: string;
    productId: number;
    variantId: number | null;
    variantName: string | null;
    article: string | null;
    quantity: number;
    name: string;
    slug: string;
    image: string;
    price: number;
  }> = [];

  for (const item of inputItems) {
    const variantId = typeof item.variantId === "number" ? item.variantId : null;
    const cartKey = `${item.productId}:${variantId ?? 0}`;
    const product = productById.get(item.productId);
    if (
      !product ||
      !isProductVisibleOnSite({
        price: product.price,
        isActive: product.isActive,
        isAutoBlocked: product.isAutoBlocked,
        autoBlockReason: product.autoBlockReason,
      })
    ) {
      removedProductIds.add(item.productId);
      removedItemKeys.add(cartKey);
      continue;
    }

    const variant = variantId ? variantById.get(variantId) : null;
    if (
      variantId &&
      (!variant ||
        variant.productId !== item.productId ||
        !variant.isActive ||
        Number(variant.price ?? 0) <= 0 ||
        Number(variant.stock ?? 0) <= 0)
    ) {
      removedProductIds.add(item.productId);
      removedItemKeys.add(cartKey);
      continue;
    }

    purchasableItems.push({
      cartKey,
      productId: product.id,
      variantId,
      variantName: variant?.name ?? null,
      article: variant?.article ?? null,
      quantity: item.quantity,
      name: variant ? `${product.name} · ${variant.name}` : product.name,
      slug: product.slug,
      image: product.image,
      price: Number(variant?.price ?? product.price),
    });
  }

  return {
    purchasableItems,
    removedItemKeys: Array.from(removedItemKeys),
    removedProductIds: Array.from(removedProductIds),
  };
}

async function resolveOrCreateCustomerUser(
  db: ReturnType<typeof getDb>,
  input: {
    ctxUser?: typeof users.$inferSelect | null;
    phone: string;
    fullName: string;
    email?: string | null;
  }
) {
  const normalizedPhone = normalizePhone(input.phone);
  const normalizedFullName = input.fullName.trim();
  const normalizedEmail = input.email?.trim().toLowerCase() || null;

  let resolvedUser = input.ctxUser ?? null;

  if (!resolvedUser && normalizedEmail) {
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    resolvedUser = existingByEmail[0] ?? null;
  }

  if (!resolvedUser && normalizedPhone) {
    const existingByPhone = await db
      .select()
      .from(users)
      .where(eq(users.phone, normalizedPhone))
      .limit(1);
    resolvedUser = existingByPhone[0] ?? null;
  }

  if (resolvedUser) {
    const userPatch: Partial<typeof users.$inferInsert> = {};
    if (normalizedPhone && (!resolvedUser.phone || resolvedUser.phone.trim().length === 0)) {
      userPatch.phone = normalizedPhone;
    }
    if (
      normalizedFullName &&
      (!resolvedUser.fullName || resolvedUser.fullName.trim().length === 0)
    ) {
      userPatch.fullName = normalizedFullName;
    }
    if (
      normalizedEmail &&
      isPlaceholderEmail(resolvedUser.email) &&
      resolvedUser.email !== normalizedEmail
    ) {
      userPatch.email = normalizedEmail;
    }
    if (Object.keys(userPatch).length > 0) {
      await db.update(users).set(userPatch).where(eq(users.id, resolvedUser.id));
    }
    return {
      userId: resolvedUser.id,
      user: resolvedUser,
      normalizedPhone,
      normalizedFullName,
      normalizedEmail,
    };
  }

  const newUser = await db.insert(users).values({
    email: normalizedEmail || buildPlaceholderEmail(normalizedPhone),
    phone: normalizedPhone,
    fullName: normalizedFullName,
    role: "customer",
    status: "active",
  });

  return {
    userId: Number(newUser[0].insertId),
    user: null,
    normalizedPhone,
    normalizedFullName,
    normalizedEmail,
  };
}

async function getCheckoutPickupStoresForItems(
  db: ReturnType<typeof getDb>,
  items: Array<{ productId: number; variantId?: number | null; quantity: number }>
) {
  if (items.length === 0) return [];

  const normalizedItems = items.map(item => ({
    productId: item.productId,
    variantId: item.variantId ?? null,
    quantity: Math.max(1, Number(item.quantity ?? 1)),
  }));

  const perItemAvailability = await Promise.all(
    normalizedItems.map(item =>
      getProductStoreAvailability(db, item.productId, item.variantId ?? null)
    )
  );

  const candidateStoreIds = perItemAvailability.reduce<number[]>((acc, rows, index) => {
    const validStoreIds = rows
      .filter(row => Number(row.availableQty ?? 0) >= normalizedItems[index]!.quantity)
      .map(row => Number(row.storeId));

    if (index === 0) return validStoreIds;
    return acc.filter(storeId => validStoreIds.includes(storeId));
  }, []);

  if (candidateStoreIds.length === 0) return [];

  const firstAvailability = perItemAvailability[0] ?? [];
  return candidateStoreIds
    .map(storeId => firstAvailability.find(row => Number(row.storeId) === storeId))
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => left.storeName.localeCompare(right.storeName, "ru"));
}

function buildCartItemSummary(items: Array<{ name: string; quantity: number }>) {
  if (items.length === 0) return "Заказ без позиций";
  return items
    .slice(0, 4)
    .map(item => `${item.name} x${item.quantity}`)
    .join("; ")
    .slice(0, 900);
}

async function createSingleItemOrder(
  db: ReturnType<typeof getDb>,
  input: {
    userId: number | null;
    product: {
      id: number;
      name: string;
      image: string;
      price: number;
      variantId?: number | null;
      variantName?: string | null;
      article?: string | null;
    };
    store: { id: number; name: string; address: string };
    phone: string;
    fullName: string;
    email?: string | null;
    quantity: number;
    source: string;
    status: string;
    reservationId?: number | null;
  }
) {
  const orderNumber = `TA-${Date.now().toString().slice(-9)}-${Math.floor(
    100 + Math.random() * 900
  )}`;
  const trustedTotal = input.product.price * input.quantity;

  const newOrder = await db.insert(orders).values({
    userId: input.userId,
    storeId: input.store.id,
    reservationId: input.reservationId ?? null,
    orderNumber,
    customerName: input.fullName,
    customerPhone: input.phone,
    customerEmail: input.email ?? null,
    source: input.source,
    totalPrice: trustedTotal,
    subtotal: trustedTotal,
    paidAmount: 0,
    deliveryType: "pickup",
    address: input.store.address,
    deliveryStatus: "not_required",
    paymentType: "cash",
    paymentMethod: "cash",
    status: input.status,
  });

  const orderId = Number(newOrder[0].insertId);
  await db.insert(orderItems).values({
    orderId,
    productId: input.product.id,
    variantId: input.product.variantId ?? null,
    variantName: input.product.variantName ?? null,
    article: input.product.article ?? null,
    sku: input.product.article ?? null,
    productName: input.product.variantName
      ? `${input.product.name} · ${input.product.variantName}`
      : input.product.name,
    image: input.product.image,
    quantity: input.quantity,
    price: input.product.price,
    total: trustedTotal,
  });

  return {
    orderId,
    orderNumber,
    totalPrice: trustedTotal,
  };
}

export const ecommerceRouter = createRouter({
  getReservationSettings: publicQuery.query(async () => {
    return {
      durationMinutes: await getReservationDurationMinutes(),
      defaultDurationMinutes: DEFAULT_RESERVATION_DURATION_MINUTES,
    };
  }),

  createReservation: publicQuery
    .input(
      z.object({
        productId: z.number(),
        variantId: z.number().optional().nullable(),
        storeId: z.number(),
        quantity: z.number().int().min(1).max(20).default(1),
        phone: z.string().trim().optional(),
        customerName: z.string().trim().max(255).optional(),
        comment: z.string().trim().max(1000).optional(),
        source: z.enum(["product_card", "product_page", "admin"]).default("product_page"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const durationMinutes = await getReservationDurationMinutes();
      const fallbackPhone = ctx.user?.phone || "";
      const phone = assertValidReservationPhone(input.phone?.trim() || fallbackPhone);
      const customerName =
        input.customerName?.trim() || ctx.user?.fullName?.trim() || null;

      const result = await db.transaction(async tx => {
        await expireDueReservations(tx, now);

        const { product, variant } = await assertReservableProductSelection(tx as any, {
          productId: input.productId,
          variantId: input.variantId ?? null,
        });
        const store = await assertStoreExists(tx, input.storeId);

        const existing = await findExistingActiveReservation(tx, {
          productId: input.productId,
          variantId: input.variantId ?? null,
          storeId: input.storeId,
          userId: ctx.user?.id ?? null,
          phone,
          now,
        });

        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Товар уже зарезервирован",
          });
        }

        const stockLockResult =
          variant
            ? await tx.execute(sql`
                SELECT quantity
                FROM ${productVariantStocks}
                WHERE ${productVariantStocks.variantId} = ${variant.id}
                  AND ${productVariantStocks.storeId} = ${input.storeId}
                LIMIT 1
                FOR UPDATE
              `)
            : await tx.execute(sql`
                SELECT quantity
                FROM ${productStocks}
                WHERE ${productStocks.productId} = ${input.productId}
                  AND ${productStocks.storeId} = ${input.storeId}
                LIMIT 1
                FOR UPDATE
              `);
        const stockLockRows = Array.isArray((stockLockResult as any)?.[0])
          ? (stockLockResult as any)[0]
          : (stockLockResult as any[]);
        const rawStockQty = Number(stockLockRows?.[0]?.quantity ?? 0);

        if (rawStockQty <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "В этом магазине товар закончился.",
          });
        }

        const activeReservationsResult =
          variant
            ? await tx.execute(sql`
                SELECT ${productReservations.id}, ${productReservations.quantity}
                FROM ${productReservations}
                WHERE ${productReservations.productId} = ${input.productId}
                  AND ${productReservations.variantId} = ${variant.id}
                  AND ${productReservations.storeId} = ${input.storeId}
                  AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
                  AND ${productReservations.reservedUntil} > ${now}
                FOR UPDATE
              `)
            : await tx.execute(sql`
                SELECT ${productReservations.id}, ${productReservations.quantity}
                FROM ${productReservations}
                WHERE ${productReservations.productId} = ${input.productId}
                  AND ${productReservations.variantId} IS NULL
                  AND ${productReservations.storeId} = ${input.storeId}
                  AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
                  AND ${productReservations.reservedUntil} > ${now}
                FOR UPDATE
              `);
        const activeReservationRows = Array.isArray((activeReservationsResult as any)?.[0])
          ? (activeReservationsResult as any)[0]
          : (activeReservationsResult as any[]);
        const activeReservedQty = (activeReservationRows as Array<{ quantity: number }>).reduce(
          (sum, row) => sum + Number(row.quantity ?? 0),
          0
        );
        const availableQty = Math.max(0, rawStockQty - activeReservedQty);

        if (availableQty <= 0 || availableQty < input.quantity) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              availableQty <= 0
                ? "В этом магазине товар закончился."
                : "Товар уже недоступен для резерва.",
          });
        }

        const reservedUntil = getReservationExpiryDate(durationMinutes, now);
        const insertResult = await tx.insert(productReservations).values({
          productId: input.productId,
          variantId: variant?.id ?? null,
          storeId: input.storeId,
          userId: ctx.user?.id ?? null,
          phone,
          customerName,
          quantity: input.quantity,
          status: RESERVATION_STATUS_ACTIVE,
          reservedUntil,
          source: input.source,
          comment: input.comment?.trim() || null,
          updatedAt: now,
        });

        await backfillUserPhoneIfMissing(tx, {
          userId: ctx.user?.id ?? null,
          phone,
        });

        return {
          id: Number(insertResult[0].insertId),
          status: RESERVATION_STATUS_ACTIVE,
          reservedUntil,
          product: {
            id: product.id,
            name: product.name,
            price: Number(variant?.price ?? product.price),
          },
          variant: variant
            ? {
                id: variant.id,
                name: variant.name,
                article: variant.article,
                price: Number(variant.price),
              }
            : null,
          store,
          quantity: input.quantity,
          availableQtyAfterReservation: Math.max(0, availableQty - input.quantity),
        };
      });

      return result;
    }),

  cancelReservation: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await expireDueReservations(db);

      const [reservation] = await db
        .select()
        .from(productReservations)
        .where(eq(productReservations.id, input.reservationId))
        .limit(1);

      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Резерв не найден." });
      }

      const canManageAny =
        ctx.ability?.can("manage", "all") || ctx.ability?.can("update", "Reservation");
      if (!canManageAny && reservation.userId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Резерв недоступен." });
      }

      if (reservation.status !== RESERVATION_STATUS_ACTIVE) {
        return { success: true, status: reservation.status };
      }

      await db
        .update(productReservations)
        .set({
          status: RESERVATION_STATUS_CANCELLED,
          updatedAt: new Date(),
        })
        .where(eq(productReservations.id, input.reservationId));

      return { success: true, status: RESERVATION_STATUS_CANCELLED };
    }),

  createOneClickOrder: publicQuery
    .input(
      z.object({
        productId: z.number(),
        variantId: z.number().optional().nullable(),
        storeId: z.number().optional().nullable(),
        quantity: z.number().int().min(1).max(20).default(1),
        phone: z.string().trim().optional(),
        customerName: z.string().trim().max(255).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const now = new Date();
      const phone = assertValidReservationPhone(input.phone?.trim() || ctx.user?.phone || "");
      const customerName =
        input.customerName?.trim() || ctx.user?.fullName?.trim() || "Клиент";
      const email = ctx.user?.email?.trim().toLowerCase() || null;

      await expireDueReservations(db, now);
      const { product, variant } = await assertReservableProductSelection(db, {
        productId: input.productId,
        variantId: input.variantId ?? null,
      });
      const availability = await getProductStoreAvailability(
        db,
        input.productId,
        variant?.id ?? null
      );
      const availableStores = availability.filter(
        (row: (typeof availability)[number]) => row.availableQty >= input.quantity
      );

      const resolvedStoreId =
        typeof input.storeId === "number" && input.storeId > 0
          ? input.storeId
          : availableStores
              .slice()
              .sort(
                (a, b) =>
                  b.availableQty - a.availableQty ||
                  a.storeId - b.storeId
              )[0]?.storeId ?? null;

      if (!resolvedStoreId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Товар сейчас недоступен для быстрого заказа.",
        });
      }

      const selectedStoreAvailability = availableStores.find(
        (row: (typeof availability)[number]) => row.storeId === resolvedStoreId
      );
      if (!selectedStoreAvailability || selectedStoreAvailability.availableQty < input.quantity) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "В этом магазине товар закончился.",
        });
      }

      const store = await assertStoreExists(db, resolvedStoreId);
      const customer = await resolveOrCreateCustomerUser(db, {
        ctxUser: ctx.user ?? null,
        phone,
        fullName: customerName,
        email,
      });

      const order = await createSingleItemOrder(db, {
        userId: customer.userId,
        product: {
          id: product.id,
          name: product.name,
          image: product.image,
          price: Number(variant?.price ?? product.price),
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          article: variant?.article ?? null,
        },
        store,
        phone: customer.normalizedPhone,
        fullName: customer.normalizedFullName,
        email: customer.normalizedEmail,
        quantity: input.quantity,
        source: "one_click",
        status: "waiting_call",
      });

      await safeInsertOrderHistory(db, {
        orderId: order.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "one_click_order_created",
        newValue: {
          storeId: store.id,
          productId: product.id,
          variantId: variant?.id ?? null,
          quantity: input.quantity,
        } as any,
        comment: "Быстрый заказ создан через кнопку «Купить в 1 клик».",
      });

      await enqueueMoyskladSyncJob({
        entityType: "order",
        entityId: order.orderId,
        action: "create",
        payloadSnapshot: {
          source: "one_click",
          storeId: store.id,
        },
      });

      return {
        success: true,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        status: "waiting_call",
      };
    }),

  listReservations: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum([
              RESERVATION_STATUS_ACTIVE,
              RESERVATION_STATUS_EXPIRED,
              RESERVATION_STATUS_CANCELLED,
              RESERVATION_STATUS_CONVERTED,
            ])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Reservation");
      const db = getDb();
      await expireDueReservations(db);

      const whereClause = input?.status
        ? eq(productReservations.status, input.status)
        : undefined;

      const rows = await db
        .select({
          id: productReservations.id,
          productId: productReservations.productId,
          variantId: productReservations.variantId,
          storeId: productReservations.storeId,
          userId: productReservations.userId,
          phone: productReservations.phone,
          customerName: productReservations.customerName,
          quantity: productReservations.quantity,
          status: productReservations.status,
          reservedUntil: productReservations.reservedUntil,
          source: productReservations.source,
          comment: productReservations.comment,
          createdAt: productReservations.createdAt,
          updatedAt: productReservations.updatedAt,
          productName: products.name,
          productSlug: products.slug,
          variantName: productVariants.name,
          article: productVariants.article,
          storeName: stores.name,
          storeAddress: stores.address,
        })
        .from(productReservations)
        .innerJoin(products, eq(productReservations.productId, products.id))
        .leftJoin(productVariants, eq(productReservations.variantId, productVariants.id))
        .innerJoin(stores, eq(productReservations.storeId, stores.id))
        .where(whereClause)
        .orderBy(desc(productReservations.createdAt));

      return rows;
    }),

  getAdminDashboardOverview: protectedProcedure.query(async ({ ctx }) => {
    requireAbility(ctx, "read", "AdminPanel");
    const db = getDb();

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const canReadProducts = ctx.ability.can("read", "Product");
    const canReadCategories = ctx.ability.can("read", "Category");
    const canReadStores = ctx.ability.can("read", "Store");
    const canReadOrders = ctx.ability.can("read", "Order");
    const canReadReservations = ctx.ability.can("read", "Reservation");
    const canReadReviews = ctx.ability.can("read", "Review");
    const canReadSync = ctx.ability.can("read", "Sync");

    let catalog: {
      totalProducts: number;
      activeProducts: number;
      manuallyHiddenProducts: number;
      autoBlockedProducts: number;
      categoriesCount: number;
      storesCount: number;
    } | null = null;

    let recentProducts: Array<{
      id: number;
      name: string;
      price: number;
      image: string;
      createdAt: Date | null;
      isActive: boolean;
      isAutoBlocked: boolean;
    }> = [];

    if (canReadProducts || canReadCategories || canReadStores) {
      const [catalogSummary] = await db
        .select({
          totalProducts: sql<number>`count(*)`,
          activeProducts: sql<number>`sum(case when ${products.isActive} = 1 then 1 else 0 end)`,
          manuallyHiddenProducts: sql<number>`sum(case when ${products.isActive} = 0 and ${products.isAutoBlocked} = 0 then 1 else 0 end)`,
          autoBlockedProducts: sql<number>`sum(case when ${products.isAutoBlocked} = 1 then 1 else 0 end)`,
        })
        .from(products);

      const [categoriesRow] = canReadCategories
        ? await db.select({ count: sql<number>`count(*)` }).from(categories)
        : [{ count: 0 } as { count: number }];

      const [storesRow] = canReadStores
        ? await db.select({ count: sql<number>`count(*)` }).from(stores)
        : [{ count: 0 } as { count: number }];

      catalog = {
        totalProducts: Number(catalogSummary?.totalProducts ?? 0),
        activeProducts: Number(catalogSummary?.activeProducts ?? 0),
        manuallyHiddenProducts: Number(catalogSummary?.manuallyHiddenProducts ?? 0),
        autoBlockedProducts: Number(catalogSummary?.autoBlockedProducts ?? 0),
        categoriesCount: Number(categoriesRow?.count ?? 0),
        storesCount: Number(storesRow?.count ?? 0),
      };

      if (canReadProducts) {
        recentProducts = await db
          .select({
            id: products.id,
            name: products.name,
            price: products.price,
            image: products.image,
            createdAt: products.createdAt,
            isActive: products.isActive,
            isAutoBlocked: products.isAutoBlocked,
          })
          .from(products)
          .orderBy(desc(products.createdAt))
          .limit(6);
      }
    }

    let ordersSummary: {
      ordersToday: number;
      orders7d: number;
      paidRevenueToday: number;
      paidRevenue7d: number;
      newOrders: number;
      processingOrders: number;
      problemOrders: number;
      awaitingPaymentOrders: number;
      unreadCustomerMessages: number;
      needsResponseOrders: number;
    } | null = null;

    let recentOrders: Array<{
      id: number;
      orderNumber: string | null;
      status: string;
      paymentStatus: string;
      totalPrice: number;
      customerName: string | null;
      customerPhone: string | null;
      createdAt: Date | null;
    }> = [];

    if (canReadOrders) {
      const [summary] = await db
        .select({
          ordersToday: sql<number>`sum(case when ${orders.createdAt} >= ${startOfToday} then 1 else 0 end)`,
          orders7d: sql<number>`sum(case when ${orders.createdAt} >= ${sevenDaysAgo} then 1 else 0 end)`,
          paidRevenueToday: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' and coalesce(${orders.paidAt}, ${orders.createdAt}) >= ${startOfToday} then case when ${orders.paidAmount} > 0 then ${orders.paidAmount} else ${orders.totalPrice} end else 0 end), 0)`,
          paidRevenue7d: sql<number>`coalesce(sum(case when ${orders.paymentStatus} = 'paid' and coalesce(${orders.paidAt}, ${orders.createdAt}) >= ${sevenDaysAgo} then case when ${orders.paidAmount} > 0 then ${orders.paidAmount} else ${orders.totalPrice} end else 0 end), 0)`,
          newOrders: sql<number>`sum(case when ${orders.status} in ('pending', 'new') then 1 else 0 end)`,
          processingOrders: sql<number>`sum(case when ${orders.status} = 'processing' then 1 else 0 end)`,
          problemOrders: sql<number>`sum(case when ${orders.status} = 'problem' or ${orders.isProblem} = 1 then 1 else 0 end)`,
          awaitingPaymentOrders: sql<number>`sum(case when ${orders.paymentStatus} = 'awaiting_payment' then 1 else 0 end)`,
        })
        .from(orders);

      const unreadRows = rowsFromExecute<{ count: number }>(
        await db.execute(sql`
          SELECT count(*) AS count
          FROM orders o
          WHERE EXISTS (
            SELECT 1
            FROM order_comments client
            WHERE client.order_id = o.id
              AND client.comment_type = 'client'
          )
            AND (
              (
                SELECT MAX(client.created_at)
                FROM order_comments client
                WHERE client.order_id = o.id
                  AND client.comment_type = 'client'
              ) > COALESCE(
                (
                  SELECT MAX(history.created_at)
                  FROM order_history history
                  WHERE history.order_id = o.id
                    AND history.action_type = 'manager_conversation_read'
                ),
                TIMESTAMP('1970-01-01 00:00:00')
              )
            )
        `)
      );

      const needsResponseRows = rowsFromExecute<{ count: number }>(
        await db.execute(sql`
          SELECT count(*) AS count
          FROM orders o
          WHERE EXISTS (
            SELECT 1
            FROM order_comments client
            WHERE client.order_id = o.id
              AND client.comment_type = 'client'
          )
            AND (
              (
                SELECT MAX(client.created_at)
                FROM order_comments client
                WHERE client.order_id = o.id
                  AND client.comment_type = 'client'
              ) > COALESCE(
                (
                  SELECT MAX(manager.created_at)
                  FROM order_comments manager
                  WHERE manager.order_id = o.id
                    AND manager.comment_type = 'manager'
                ),
                TIMESTAMP('1970-01-01 00:00:00')
              )
            )
        `)
      );

      recentOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          totalPrice: orders.totalPrice,
          customerName: sql<string | null>`coalesce(${orders.customerName}, ${users.fullName})`,
          customerPhone: sql<string | null>`coalesce(${orders.customerPhone}, ${users.phone})`,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .leftJoin(users, eq(orders.userId, users.id))
        .orderBy(desc(orders.createdAt))
        .limit(6);

      ordersSummary = {
        ordersToday: Number(summary?.ordersToday ?? 0),
        orders7d: Number(summary?.orders7d ?? 0),
        paidRevenueToday: Number(summary?.paidRevenueToday ?? 0),
        paidRevenue7d: Number(summary?.paidRevenue7d ?? 0),
        newOrders: Number(summary?.newOrders ?? 0),
        processingOrders: Number(summary?.processingOrders ?? 0),
        problemOrders: Number(summary?.problemOrders ?? 0),
        awaitingPaymentOrders: Number(summary?.awaitingPaymentOrders ?? 0),
        unreadCustomerMessages: Number(unreadRows[0]?.count ?? 0),
        needsResponseOrders: Number(needsResponseRows[0]?.count ?? 0),
      };
    }

    let reservationsSummary: {
      activeCount: number;
      expiringTodayCount: number;
      expiredCount: number;
      converted7dCount: number;
    } | null = null;

    if (canReadReservations) {
      await expireDueReservations(db);
      const [summary] = await db
        .select({
          activeCount: sql<number>`sum(case when ${productReservations.status} = 'active' then 1 else 0 end)`,
          expiringTodayCount: sql<number>`sum(case when ${productReservations.status} = 'active' and ${productReservations.reservedUntil} >= ${now} and ${productReservations.reservedUntil} < ${startOfTomorrow} then 1 else 0 end)`,
          expiredCount: sql<number>`sum(case when ${productReservations.status} = 'expired' then 1 else 0 end)`,
          converted7dCount: sql<number>`sum(case when ${productReservations.status} = 'converted_to_order' and ${productReservations.updatedAt} >= ${sevenDaysAgo} then 1 else 0 end)`,
        })
        .from(productReservations);

      reservationsSummary = {
        activeCount: Number(summary?.activeCount ?? 0),
        expiringTodayCount: Number(summary?.expiringTodayCount ?? 0),
        expiredCount: Number(summary?.expiredCount ?? 0),
        converted7dCount: Number(summary?.converted7dCount ?? 0),
      };
    }

    let reviewsSummary: {
      pendingCount: number;
      totalCount: number;
      publishedCount: number;
      avgPublishedRating: number;
      reminderCandidates: number;
    } | null = null;

    if (canReadReviews) {
      const [summary] = await db
        .select({
          total: sql<number>`count(*)`,
          pending: sql<number>`sum(case when ${productReviews.status} = 'pending_moderation' then 1 else 0 end)`,
          published: sql<number>`sum(case when ${productReviews.status} = 'published' then 1 else 0 end)`,
          avgPublishedRating: sql<number>`coalesce(avg(case when ${productReviews.status} = 'published' then ${productReviews.rating} end), 0)`,
        })
        .from(productReviews);

      const [reminderCandidates] = await db
        .select({ count: sql<number>`count(*)` })
        .from(productReviewRequests)
        .where(
          and(
            eq(productReviewRequests.requestStatus, "pending"),
            sql`${productReviewRequests.initialSentAt} IS NOT NULL`,
            sql`(${productReviewRequests.reminderSentAt} IS NULL OR ${productReviewRequests.reminderSentAt} < date_sub(now(), interval 5 day))`
          )
        );

      reviewsSummary = {
        pendingCount: Number(summary?.pending ?? 0),
        totalCount: Number(summary?.total ?? 0),
        publishedCount: Number(summary?.published ?? 0),
        avgPublishedRating: Math.round(Number(summary?.avgPublishedRating ?? 0) * 10) / 10,
        reminderCandidates: Number(reminderCandidates?.count ?? 0),
      };
    }

    let syncSummary: {
      pendingJobs: number;
      processingJobs: number;
      failedJobs: number;
      successJobs: number;
      ordersNeedingSync: number;
      latestFullRun: {
        id: number;
        status: string;
        phase: string | null;
        message: string | null;
        startedAt: Date | null;
        finishedAt: Date | null;
      } | null;
    } | null = null;

    if (canReadSync) {
      const [jobCounts] = await db
        .select({
          pending: sql<number>`sum(case when ${moyskladSyncJobs.status} = 'pending' then 1 else 0 end)`,
          processing: sql<number>`sum(case when ${moyskladSyncJobs.status} = 'processing' then 1 else 0 end)`,
          error: sql<number>`sum(case when ${moyskladSyncJobs.status} = 'error' then 1 else 0 end)`,
          success: sql<number>`sum(case when ${moyskladSyncJobs.status} = 'success' then 1 else 0 end)`,
        })
        .from(moyskladSyncJobs);

      const [ordersNeedingSyncRow] = await db
        .select({ count: sql<number>`count(*)` })
        .from(orders)
        .where(inArray(orders.moyskladSyncStatus, ["pending", "error", "processing"]));

      const [latestRun] = await db
        .select({
          id: syncRuns.id,
          status: syncRuns.status,
          phase: syncRuns.phase,
          message: syncRuns.message,
          startedAt: syncRuns.startedAt,
          finishedAt: syncRuns.finishedAt,
        })
        .from(syncRuns)
        .where(eq(syncRuns.runType, "full"))
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);

      syncSummary = {
        pendingJobs: Number(jobCounts?.pending ?? 0),
        processingJobs: Number(jobCounts?.processing ?? 0),
        failedJobs: Number(jobCounts?.error ?? 0),
        successJobs: Number(jobCounts?.success ?? 0),
        ordersNeedingSync: Number(ordersNeedingSyncRow?.count ?? 0),
        latestFullRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              phase: latestRun.phase,
              message: latestRun.message,
              startedAt: latestRun.startedAt,
              finishedAt: latestRun.finishedAt,
            }
          : null,
      };
    }

    return {
      generatedAt: now,
      permissions: {
        canReadProducts,
        canReadCategories,
        canReadStores,
        canReadOrders,
        canReadReservations,
        canReadReviews,
        canReadSync,
      },
      catalog,
      orders: ordersSummary,
      reservations: reservationsSummary,
      reviews: reviewsSummary,
      sync: syncSummary,
      recentOrders,
      recentProducts,
    };
  }),

  getProductReservationSummary: protectedProcedure
    .input(z.object({ productId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Reservation");
      const db = getDb();
      return getProductReservationSummary(db, input.productId);
    }),

  convertReservationToOrder: protectedProcedure
    .input(z.object({ reservationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Reservation");
      const db = getDb();
      await expireDueReservations(db);

      const [reservation] = await db
        .select()
        .from(productReservations)
        .where(eq(productReservations.id, input.reservationId))
        .limit(1);

      if (!reservation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Резерв не найден." });
      }
      if (reservation.status !== RESERVATION_STATUS_ACTIVE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Оформить заказ можно только из активного резерва.",
        });
      }

      const { product, variant } = await assertReservableProductSelection(db, {
        productId: reservation.productId,
        variantId: reservation.variantId ?? null,
      });
      const store = await assertStoreExists(db, reservation.storeId);

      const customer = await resolveOrCreateCustomerUser(db, {
        ctxUser: null,
        phone: reservation.phone,
        fullName: reservation.customerName?.trim() || "Клиент",
        email: null,
      });

      const order = await createSingleItemOrder(db, {
        userId: customer.userId,
        product: {
          id: product.id,
          name: product.name,
          image: product.image,
          price: Number(variant?.price ?? product.price),
          variantId: variant?.id ?? null,
          variantName: variant?.name ?? null,
          article: variant?.article ?? null,
        },
        store,
        phone: reservation.phone,
        fullName: reservation.customerName?.trim() || "Клиент",
        email: customer.normalizedEmail,
        quantity: reservation.quantity,
        source: "reservation",
        status: "waiting_call",
        reservationId: reservation.id,
      });

      await db
        .update(productReservations)
        .set({
          status: RESERVATION_STATUS_CONVERTED,
          updatedAt: new Date(),
        })
        .where(eq(productReservations.id, input.reservationId));

      await safeInsertOrderHistory(db, {
        orderId: order.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "order_created_from_reservation",
        newValue: {
          reservationId: reservation.id,
          storeId: reservation.storeId,
          productId: reservation.productId,
          variantId: reservation.variantId ?? null,
        } as any,
        comment: "Заказ оформлен из активного резерва.",
      });

      await enqueueMoyskladSyncJob({
        entityType: "order",
        entityId: order.orderId,
        action: "create",
        payloadSnapshot: {
          source: "reservation",
          reservationId: reservation.id,
          storeId: reservation.storeId,
        },
      });

      return {
        success: true,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
      };
    }),

  validateCartItems: publicQuery
    .input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number(),
            variantId: z.number().optional().nullable(),
            quantity: z.number().min(1),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const { purchasableItems, removedItemKeys, removedProductIds } = await resolvePurchasableCartItems(
        db,
        input.items
      );

      return {
        items: purchasableItems.map(item => ({
          cartKey: item.cartKey,
          id: item.productId,
          variantId: item.variantId,
          variantName: item.variantName,
          article: item.article,
          slug: item.slug,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
        })),
        removedItemKeys,
        removedProductIds,
        message:
          removedProductIds.length > 0
            ? "Некоторые товары стали недоступны и были удалены из корзины."
            : null,
      };
    }),

  getCheckoutPickupStores: publicQuery
    .input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number(),
            variantId: z.number().optional().nullable(),
            quantity: z.number().int().min(1),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      if (input.items.length === 0) return [];

      const { purchasableItems, removedProductIds } = await resolvePurchasableCartItems(
        db,
        input.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }))
      );

      if (purchasableItems.length !== input.items.length || removedProductIds.length > 0) {
        return [];
      }

      return await getCheckoutPickupStoresForItems(
        db,
        purchasableItems.map(item => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }))
      );
    }),

  getYandexDeliveryQuote: publicQuery
    .input(
      z.object({
        items: z.array(
          z.object({
            productId: z.number().int().positive(),
            variantId: z.number().int().positive().optional().nullable(),
            quantity: z.number().int().min(1),
          })
        ),
        street: z.string().trim().min(1),
        house: z.string().trim().min(1),
        apartment: z.string().trim().max(120).optional().nullable(),
        storeId: z.number().int().positive().optional().nullable(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      await assertYandexDeliverySchemaReady(db);

      const normalizedStreet = normalizeDeliveryAddressPart(input.street);
      const normalizedHouse = normalizeDeliveryAddressPart(input.house);
      const normalizedApartment = normalizeDeliveryAddressPart(
        input.apartment ?? "",
      );

      if (!isLikelyValidDeliveryStreetInput(normalizedStreet)) {
        return {
          available: false,
          price: null,
          currency: "RUB",
          etaMinutes: null,
          etaLabel: null,
          offerId: null,
          message:
            "Укажите улицу в корректном формате, например: Суворова или улица Клары Цеткин.",
          raw: null,
          sourceStore: null,
          itemSummary: null,
        };
      }

      if (!isLikelyValidDeliveryHouseInput(normalizedHouse)) {
        return {
          available: false,
          price: null,
          currency: "RUB",
          etaMinutes: null,
          etaLabel: null,
          offerId: null,
          message:
            "Укажите корректный номер дома, например: 192, 14А или 7/1.",
          raw: null,
          sourceStore: null,
          itemSummary: null,
        };
      }

      const normalizedAddress = buildStructuredDeliveryAddress({
        street: normalizedStreet,
        house: normalizedHouse,
        apartment: normalizedApartment || null,
      });
      const { purchasableItems } = await resolvePurchasableCartItems(
        db,
        input.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }))
      );

      if (purchasableItems.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "В корзине не осталось доступных товаров для расчёта доставки.",
        });
      }

      const sourceStore = await resolveDeliveryStore(db, {
        storeId: input.storeId ?? null,
      });

      const addressValidation = await validatePenzaDeliveryAddress({
        street: normalizedStreet,
        house: normalizedHouse,
      });

      if (!addressValidation.ok) {
        return {
          available: false,
          price: null,
          currency: "RUB",
          etaMinutes: null,
          etaLabel: null,
          offerId: null,
          message: addressValidation.message,
          raw: null,
          sourceStore: {
            id: sourceStore.id,
            name: sourceStore.name,
            address: sourceStore.address,
          },
          itemSummary: buildCartItemSummary(
            purchasableItems.map(item => ({
              name: item.name,
              quantity: item.quantity,
            })),
          ),
        };
      }

      const quote = await calculateYandexDeliveryOffers({
        sourceAddress: sourceStore.address,
        destinationAddress: addressValidation.normalizedAddress || normalizedAddress,
        destinationCoordinates: addressValidation.coordinates,
      });

      return {
        ...quote,
        sourceStore: {
          id: sourceStore.id,
          name: sourceStore.name,
          address: sourceStore.address,
        },
        itemSummary: buildCartItemSummary(
          purchasableItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
          }))
        ),
      };
    }),

  searchPenzaDeliveryAddresses: publicQuery
    .input(
      z.object({
        street: z.string().trim().min(1),
        house: z.string().trim().min(1),
      })
    )
    .query(async ({ input }) => {
      const street = normalizeDeliveryAddressPart(input.street);
      const house = normalizeDeliveryAddressPart(input.house);

      if (
        !isLikelyValidDeliveryStreetInput(street) ||
        normalizeDeliveryAddressPart(street).length < 3 ||
        normalizeDeliveryAddressPart(house).length < 1
      ) {
        return [];
      }

      return await searchPenzaDeliveryAddresses({
        street,
        house,
      });
    }),

  getMyLoyaltyState: protectedProcedure
    .input(
      z
        .object({
          refresh: z.boolean().optional().default(false),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      return input?.refresh
        ? refreshUserLoyaltyState(ctx.user.id)
        : getUserLoyaltyState(ctx.user.id);
    }),

  previewBonusWriteoff: protectedProcedure
    .input(
      z.object({
        subtotal: z.number().min(0),
        requestedAmount: z.number().min(0).optional().nullable(),
      })
    )
    .query(async ({ ctx, input }) => {
      return previewBonusWriteoff({
        userId: ctx.user.id,
        subtotal: input.subtotal,
        requestedAmount: input.requestedAmount ?? null,
      });
    }),

  getMyBonusTransactions: protectedProcedure.query(async ({ ctx }) => {
    return listUserBonusTransactions(ctx.user.id);
  }),

  // Order creation (Progressive Checkout)
  placeOrder: publicQuery
    .input(
      z.object({
        customer: z.object({
          phone: z.string().min(10),
          fullName: z.string().min(2),
          email: z.string().email().optional().nullable(),
        }),
        items: z.array(
          z.object({
            productId: z.number(),
            variantId: z.number().optional().nullable(),
            quantity: z.number().min(1),
            price: z.number(),
          })
        ),
        deliveryType: z.enum(["pickup", "delivery"]),
        storeId: z.number().int().positive().optional().nullable(),
        address: z.string().optional().nullable(),
        paymentType: z.enum(["cash", "card", "sbp", "yookassa"]),
        totalPrice: z.number(),
        deliveryPrice: z.number().min(0).optional().nullable(),
        loyaltyBonusAmount: z.number().min(0).optional().nullable(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      if (input.items.length === 0) {
        throw new Error("Корзина пуста");
      }

      const normalizedPhone = input.customer.phone.trim();
      const normalizedFullName = input.customer.fullName.trim();
      const normalizedEmailRaw = input.customer.email?.trim();
      const normalizedEmail =
        normalizedEmailRaw && normalizedEmailRaw.length > 0
          ? normalizedEmailRaw.toLowerCase()
          : null;
      const authenticatedEmail = ctx.user?.email?.trim().toLowerCase() || null;
      const contactEmail = normalizedEmail ?? authenticatedEmail;

      const { purchasableItems, removedProductIds } = await resolvePurchasableCartItems(
        db,
        input.items.map(item => ({
          productId: item.productId,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        }))
      );

      if (purchasableItems.length !== input.items.length || removedProductIds.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Некоторые товары стали недоступны и были удалены из корзины.",
        });
      }

      let pickupStore:
        | {
            id: number;
            name: string;
            address: string;
            phone: string | null;
            hours: string | null;
          }
        | null = null;

      if (input.deliveryType === "pickup") {
        if (!input.storeId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Выберите магазин для самовывоза.",
          });
        }

        const resolvedPickupStore = await assertStoreExists(db, input.storeId);
        pickupStore = resolvedPickupStore;

        for (const item of purchasableItems) {
          const stock = await getAvailableStock(
            db,
            item.productId,
            input.storeId,
            item.variantId ?? null
          );

          if (stock.availableQty < item.quantity) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `В магазине «${resolvedPickupStore.name}» не хватает товара «${item.name}». Выберите другой магазин или доставку.`,
            });
          }
        }
      }

      const trustedTotal = purchasableItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const orderNumber = `TA-${Date.now().toString().slice(-9)}-${Math.floor(
        100 + Math.random() * 900
      )}`;

      // 1. Find or create user. If the customer is already authenticated,
      // always attach the order to that account instead of creating a guest duplicate.
      let userId: number | null = null;
      let resolvedUser = ctx.user ?? null;

      if (!resolvedUser && contactEmail) {
        const existingByEmail = await db
          .select()
          .from(users)
          .where(eq(users.email, contactEmail))
          .limit(1);
        resolvedUser = existingByEmail[0] ?? null;
      }

      if (!resolvedUser && normalizedPhone) {
        const existingByPhone = await db
          .select()
          .from(users)
          .where(eq(users.phone, normalizedPhone))
          .limit(1);
        resolvedUser = existingByPhone[0] ?? null;
      }

      if (resolvedUser) {
        userId = resolvedUser.id;
        const userPatch: Partial<typeof users.$inferInsert> = {};
        if (normalizedPhone && (!resolvedUser.phone || resolvedUser.phone.trim().length === 0)) {
          userPatch.phone = normalizedPhone;
        }
        if (
          normalizedFullName &&
          (!resolvedUser.fullName || resolvedUser.fullName.trim().length === 0)
        ) {
          userPatch.fullName = normalizedFullName;
        }
        if (
          contactEmail &&
          isPlaceholderEmail(resolvedUser.email) &&
          resolvedUser.email !== contactEmail
        ) {
          userPatch.email = contactEmail;
        }
        if (Object.keys(userPatch).length > 0) {
          await db.update(users).set(userPatch).where(eq(users.id, resolvedUser.id));
        }
      } else {
        const newUser = await db.insert(users).values({
          email: contactEmail || buildPlaceholderEmail(normalizedPhone),
          phone: normalizedPhone,
          fullName: normalizedFullName,
          role: "customer",
          status: "active",
        });
        userId = newUser[0].insertId;
      }

      let loyaltyPreview: Awaited<ReturnType<typeof previewBonusWriteoff>> | null = null;
      let loyaltyBonusSpent = 0;

      if (userId && Number(input.loyaltyBonusAmount ?? 0) > 0) {
        loyaltyPreview = await previewBonusWriteoff({
          userId,
          subtotal: trustedTotal,
          requestedAmount: input.loyaltyBonusAmount ?? 0,
        });
        loyaltyBonusSpent = loyaltyPreview.appliedAmount;

        if (loyaltyBonusSpent <= 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              loyaltyPreview.warning ||
              "Бонусы нельзя применить к этому заказу.",
          });
        }
      }

      const deliveryPrice =
        input.deliveryType === "delivery"
          ? Math.max(0, Math.round(Number(input.deliveryPrice ?? 0)))
          : 0;
      const finalTotal = Math.max(0, trustedTotal - loyaltyBonusSpent + deliveryPrice);

      const orderAddress =
        input.deliveryType === "pickup"
          ? pickupStore
            ? `${pickupStore.name}, ${pickupStore.address}`
            : "Самовывоз из магазина"
          : input.address;

      const reservationDurationMinutes =
        input.deliveryType === "pickup"
          ? await getReservationDurationMinutes()
          : DEFAULT_RESERVATION_DURATION_MINUTES;

      const orderId = await db.transaction(async tx => {
        if (input.deliveryType === "pickup" && input.storeId) {
          await expireDueReservations(tx);
          for (const item of purchasableItems) {
            const stock = await getAvailableStock(
              tx,
              item.productId,
              input.storeId,
              item.variantId ?? null
            );

            if (stock.availableQty < item.quantity) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Товар «${item.name}» уже недоступен в выбранном магазине.`,
              });
            }
          }
        }

        let newOrder;
        if (canUseModernOrderInsertSchema(capabilities)) {
          newOrder = await tx.insert(orders).values({
            userId,
            storeId: input.deliveryType === "pickup" ? input.storeId ?? null : null,
            orderNumber,
            customerName: normalizedFullName,
            customerPhone: normalizedPhone,
            customerEmail: contactEmail,
            source: "site",
            totalPrice: finalTotal,
            subtotal: trustedTotal,
            discountTotal: loyaltyBonusSpent,
            deliveryPrice,
            paidAmount: 0,
            deliveryType: input.deliveryType,
            address: orderAddress,
            deliveryStatus:
              input.deliveryType === "pickup" ? "not_required" : "awaiting_processing",
            paymentType: input.paymentType,
            paymentMethod: input.paymentType,
            paymentStatus:
              input.paymentType === "yookassa" ? "awaiting_payment" : "unpaid",
            status: "pending",
          });
        } else {
          const legacyInsertResult = await tx.execute(sql`
            INSERT INTO orders (
              user_id,
              status,
              total_price,
              delivery_type,
              address,
              payment_type,
              payment_status,
              created_at
            ) VALUES (
              ${userId},
              ${"pending"},
              ${finalTotal},
              ${input.deliveryType},
              ${orderAddress},
              ${input.paymentType},
              ${input.paymentType === "yookassa" ? "awaiting_payment" : "unpaid"},
              NOW()
            )
          `);
          const fallbackOrderId = Number(
            (legacyInsertResult as any)?.[0]?.insertId ??
            (legacyInsertResult as any)?.insertId ??
            0
          );
          if (!fallbackOrderId) {
            throw new Error("Не удалось получить ID созданного заказа");
          }
          newOrder = [{ insertId: fallbackOrderId }];
        }

        const createdOrderId = Number(newOrder[0].insertId);

        for (const item of purchasableItems) {
          if (canUseModernOrderInsertSchema(capabilities)) {
            await tx.insert(orderItems).values({
              orderId: createdOrderId,
              productId: item.productId,
              variantId: item.variantId ?? null,
              variantName: item.variantName ?? null,
              article: item.article ?? null,
              sku: item.article ?? null,
              productName: item.name,
              image: item.image,
              total: item.price * item.quantity,
              quantity: item.quantity,
              price: item.price,
            });
          } else {
            await tx.execute(sql`
              INSERT INTO order_items (
                order_id,
                product_id,
                quantity,
                price
              ) VALUES (
                ${createdOrderId},
                ${item.productId},
                ${item.quantity},
                ${item.price}
              )
            `);
          }
        }

        if (input.deliveryType === "pickup" && input.storeId) {
          const now = new Date();
          const reservedUntil = getReservationExpiryDate(reservationDurationMinutes, now);
          for (const item of purchasableItems) {
            await tx.insert(productReservations).values({
              productId: item.productId,
              variantId: item.variantId ?? null,
              storeId: input.storeId,
              userId,
              phone: normalizedPhone,
              customerName: normalizedFullName,
              quantity: item.quantity,
              status: RESERVATION_STATUS_ACTIVE,
              reservedUntil,
              source: "checkout",
              comment: `Заказ ${orderNumber}`,
              updatedAt: now,
            });
          }
        }

        return createdOrderId;
      });

      if (userId) {
        await attachLoyaltyToOrder({
          orderId,
          userId,
          subtotal: trustedTotal,
          spent: loyaltyBonusSpent,
          preview: loyaltyPreview,
        });
      }

      await enqueueMoyskladSyncJob({
        entityType: "order",
        entityId: orderId,
        action: "create",
        payloadSnapshot: {
          source: "site",
          itemCount: purchasableItems.length,
        },
      });

      const payment =
        input.paymentType === "yookassa"
          ? await createYooKassaPaymentForOrder({
              orderId,
              orderNumber,
              totalPrice: finalTotal,
              customerPhone: normalizedPhone,
              customerEmail: contactEmail,
              items: [
                ...purchasableItems.map(item => ({
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  paymentSubject: "commodity" as const,
                })),
                ...(deliveryPrice > 0
                  ? [
                      {
                        name: "Доставка Яндекс",
                        quantity: 1,
                        price: deliveryPrice,
                        paymentSubject: "service" as const,
                      },
                    ]
                  : []),
              ],
            })
          : null;

      let yandexDelivery: {
        providerOrderId: string;
        providerOfferId: string;
        providerStatus: string;
        deliveryStatus: string;
      } | null = null;
      let yandexDeliveryWarning: string | null = null;

      if (input.deliveryType === "delivery") {
        try {
          const providerResult = await createYandexDeliveryOrderForOrder({
            db,
            orderId,
            actorUserId: ctx.user?.id ?? null,
            historyActionType: "yandex_delivery_auto_created",
          });
          yandexDelivery = {
            providerOrderId: providerResult.providerOrderId,
            providerOfferId: providerResult.providerOfferId,
            providerStatus: providerResult.providerStatus,
            deliveryStatus: providerResult.deliveryStatus,
          };
        } catch (error: any) {
          yandexDeliveryWarning =
            error instanceof TRPCError
              ? error.message
              : error?.message || "Не удалось автоматически создать заявку Яндекс Доставки.";
          console.error("[yandex-delivery] auto create failed", error);
        }
      }

      if (contactEmail) {
        const emailItems = purchasableItems.map(item => ({
          title: item.name,
          sku: item.article ?? undefined,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        }));

        const baseEmailData = {
          customerName: normalizedFullName,
          customerEmail: contactEmail,
          customerPhone: normalizedPhone,
          orderDate: new Date(),
          orderStatus:
            input.paymentType === "yookassa" && payment?.status !== "succeeded"
              ? "awaiting_payment"
              : "pending",
          paymentMethod: input.paymentType,
          paymentStatus:
            input.paymentType === "yookassa"
              ? payment?.status === "succeeded"
                ? "paid"
                : "awaiting_payment"
              : "unpaid",
          deliveryMethod: input.deliveryType,
          deliveryAddress: orderAddress,
          subtotal: trustedTotal,
          totalAmount: finalTotal,
          orderUrl: ACCOUNT_ORDERS_URL,
          items: emailItems,
        } as const;

        const isYooKassaPending =
          input.paymentType === "yookassa" && payment?.status !== "succeeded";

        await sendOrderNotificationEmail({
          email: contactEmail,
          orderNumber,
          eventType: isYooKassaPending ? "payment_pending" : "order_created",
          data: {
            ...baseEmailData,
            paymentUrl: payment?.confirmationUrl ?? undefined,
          },
          message: isYooKassaPending
            ? "Заказ создан. После оплаты мы автоматически передадим его в обработку."
            : "Заказ создан и передан в обработку. Если потребуется уточнение, мы свяжемся с вами отдельно.",
        }).catch(err => {
          console.error("order notification email failed", err);
        });
      }

      return { success: true, orderId, payment, yandexDelivery, yandexDeliveryWarning };
    }),

  getPaymentResult: publicQuery
    .input(z.object({ orderId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = getDb();
      const loadOrder = () =>
        db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          totalPrice: orders.totalPrice,
          status: orders.status,
          paymentStatus: orders.paymentStatus,
          paymentMethod: orders.paymentMethod,
          paymentId: orders.paymentId,
          paymentError: orders.paymentError,
          paidAt: orders.paidAt,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      let rows = await loadOrder();

      let order = rows[0];
      if (!order || order.paymentMethod !== "yookassa") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Платёж не найден.",
        });
      }

      if (order.paymentId && order.paymentStatus === "awaiting_payment") {
        try {
          await refreshYooKassaPaymentForOrder(order.id);
          rows = await loadOrder();
          order = rows[0] ?? order;
        } catch (error) {
          console.warn("[yookassa] payment result refresh failed", error);
        }
      }

      const items = await db
        .select({
          productId: orderItems.productId,
          variantId: orderItems.variantId,
          variantName: orderItems.variantName,
          productName: sql<string>`coalesce(${orderItems.productName}, ${products.name})`,
          price: orderItems.price,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(eq(orderItems.orderId, order.id));

      return {
        ...order,
        items,
      };
    }),

  // User orders for Account section
  getUserOrders: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const { phoneForLookup, emailForLookup, relatedUserIds } =
        await resolveAccountViewerContext(db, {
          id: ctx.user.id,
          phone: ctx.user.phone || input.phone || null,
          email: ctx.user.email || null,
        });

      if (capabilities.detected && !canUseRichOrdersSchema(capabilities)) {
        console.info("getUserOrders using legacy compatibility mode");
        const legacyConditions = Array.from(relatedUserIds).map(
          relatedUserId => sql`user_id = ${relatedUserId}`
        );
        if (phoneForLookup && capabilities.hasOrdersCustomerFields) {
          legacyConditions.push(sql`customer_phone = ${phoneForLookup}`);
        }
        if (emailForLookup && capabilities.hasOrdersCustomerFields) {
          legacyConditions.push(sql`customer_email = ${emailForLookup}`);
        }
        const raw = await db.execute<any[]>(sql`
          SELECT
            id,
            user_id AS userId,
            NULL AS orderNumber,
            status,
            total_price AS totalPrice,
            delivery_type AS deliveryType,
            address,
            payment_type AS paymentType,
            payment_status AS paymentStatus,
            created_at AS createdAt
          FROM orders
          WHERE ${sql.join(legacyConditions, sql` OR `)}
          ORDER BY created_at DESC
        `);
        return rowsFromExecute<any>(raw);
      }

      const orderLookupConditions = buildAccountOrderLookupConditions(
        relatedUserIds,
        phoneForLookup,
        emailForLookup,
        capabilities
      );

      return await db
        .select({
          id: orders.id,
          userId: orders.userId,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalPrice: orders.totalPrice,
          deliveryType: orders.deliveryType,
          address: orders.address,
          paymentType: orders.paymentType,
          paymentStatus: orders.paymentStatus,
          createdAt: orders.createdAt,
          latestClientCommentAt: capabilities.hasOrderCommentsTable
            ? sql<Date | null>`(
                SELECT MAX(${orderComments.createdAt})
                FROM ${orderComments}
                WHERE ${orderComments.orderId} = ${orders.id}
                  AND ${orderComments.commentType} = 'client'
              )`
            : sql<Date | null>`NULL`,
          latestManagerCommentAt: capabilities.hasOrderCommentsTable
            ? sql<Date | null>`(
                SELECT MAX(${orderComments.createdAt})
                FROM ${orderComments}
                WHERE ${orderComments.orderId} = ${orders.id}
                  AND ${orderComments.commentType} = 'manager'
            )`
            : sql<Date | null>`NULL`,
          latestCustomerReadManagerAt: capabilities.hasOrderHistoryTable
            ? sql<Date | null>`(
                SELECT MAX(${orderHistory.createdAt})
                FROM ${orderHistory}
                WHERE ${orderHistory.orderId} = ${orders.id}
                  AND ${orderHistory.actionType} = 'customer_conversation_read'
                  AND ${orderHistory.userId} = ${ctx.user.id}
              )`
            : sql<Date | null>`NULL`,
        })
        .from(orders)
        .orderBy(desc(orders.createdAt))
        .where(or(...orderLookupConditions));
    }),

  getMyOrders: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const capabilities = await getOrderDbCapabilities(db);
    const { phoneForLookup, emailForLookup, relatedUserIds } =
      await resolveAccountViewerContext(db, {
        id: ctx.user.id,
        phone: ctx.user.phone || null,
        email: ctx.user.email || null,
      });

    if (capabilities.detected && !canUseRichOrdersSchema(capabilities)) {
      const legacyConditions = Array.from(relatedUserIds).map(
        relatedUserId => sql`user_id = ${relatedUserId}`
      );
      if (phoneForLookup && capabilities.hasOrdersCustomerFields) {
        legacyConditions.push(sql`customer_phone = ${phoneForLookup}`);
      }
      if (emailForLookup && capabilities.hasOrdersCustomerFields) {
        legacyConditions.push(sql`customer_email = ${emailForLookup}`);
      }
      const raw = await db.execute<any[]>(sql`
        SELECT
          id,
          user_id AS userId,
          NULL AS orderNumber,
          status,
          total_price AS totalPrice,
          delivery_type AS deliveryType,
          address,
          payment_type AS paymentType,
          payment_status AS paymentStatus,
          created_at AS createdAt,
          ${
            capabilities.hasOrderCommentsTable
              ? sql`(
                  SELECT MAX(oc.created_at)
                  FROM order_comments oc
                  WHERE oc.order_id = orders.id
                    AND oc.comment_type = 'client'
                )`
              : sql`NULL`
          } AS latestClientCommentAt,
          ${
            capabilities.hasOrderCommentsTable
              ? sql`(
                  SELECT MAX(oc.created_at)
                  FROM order_comments oc
                  WHERE oc.order_id = orders.id
                    AND oc.comment_type = 'manager'
                )`
              : sql`NULL`
          } AS latestManagerCommentAt
        FROM orders
        WHERE ${sql.join(legacyConditions, sql` OR `)}
        ORDER BY created_at DESC
      `);
      return rowsFromExecute<any>(raw);
    }

    const orderLookupConditions = buildAccountOrderLookupConditions(
      relatedUserIds,
      phoneForLookup,
      emailForLookup,
      capabilities
    );

    return await db
      .select({
        id: orders.id,
        userId: orders.userId,
        orderNumber: orders.orderNumber,
        status: orders.status,
        totalPrice: orders.totalPrice,
        deliveryType: orders.deliveryType,
        address: orders.address,
        paymentType: orders.paymentType,
        paymentStatus: orders.paymentStatus,
        deliveryProvider: capabilities.hasOrdersDeliveryProviderMetadata
          ? orders.deliveryProvider
          : sql<string | null>`NULL`,
        deliveryProviderStatus: capabilities.hasOrdersDeliveryProviderMetadata
          ? orders.deliveryProviderStatus
          : sql<string | null>`NULL`,
        deliveryProviderOrderId: capabilities.hasOrdersDeliveryProviderMetadata
          ? orders.deliveryProviderOrderId
          : sql<string | null>`NULL`,
        deliveryProviderLastSyncAt: capabilities.hasOrdersDeliveryProviderMetadata
          ? orders.deliveryProviderLastSyncAt
          : sql<Date | null>`NULL`,
        createdAt: orders.createdAt,
        latestManagerCommentAt: capabilities.hasOrderCommentsTable
          ? sql<Date | null>`(
              SELECT MAX(${orderComments.createdAt})
              FROM ${orderComments}
              WHERE ${orderComments.orderId} = ${orders.id}
                AND ${orderComments.commentType} = 'manager'
            )`
          : sql<Date | null>`NULL`,
      })
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .where(or(...orderLookupConditions));
  }),

  getMyOrderNotifications: protectedProcedure.query(async ({ ctx }) => {
    const db = getDb();
    const capabilities = await getOrderDbCapabilities(db);
    const { phoneForLookup, emailForLookup, relatedUserIds } =
      await resolveAccountViewerContext(db, {
        id: ctx.user.id,
        phone: ctx.user.phone || null,
        email: ctx.user.email || null,
      });

    if (!capabilities.hasOrderCommentsTable) {
      return {
        items: [],
        compatibilityMode: "legacy" as const,
      };
    }

    const orderLookupConditions = buildAccountOrderLookupConditions(
      relatedUserIds,
      phoneForLookup,
      emailForLookup,
      capabilities
    );

    const items = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        latestManagerCommentAt: sql<Date | null>`(
          SELECT MAX(${orderComments.createdAt})
          FROM ${orderComments}
          WHERE ${orderComments.orderId} = ${orders.id}
            AND ${orderComments.commentType} = 'manager'
        )`,
        latestCustomerReadManagerAt: capabilities.hasOrderHistoryTable
          ? sql<Date | null>`(
              SELECT MAX(${orderHistory.createdAt})
              FROM ${orderHistory}
              WHERE ${orderHistory.orderId} = ${orders.id}
                AND ${orderHistory.actionType} = 'customer_conversation_read'
                AND ${orderHistory.userId} = ${ctx.user.id}
            )`
          : sql<Date | null>`NULL`,
      })
      .from(orders)
      .where(and(
        or(...orderLookupConditions),
        sql`EXISTS (
          SELECT 1
          FROM ${orderComments}
          WHERE ${orderComments.orderId} = ${orders.id}
            AND ${orderComments.commentType} = 'manager'
        )`
      ))
      .orderBy(desc(orders.createdAt));

    return {
      items: items.filter(item => {
        if (!item.latestManagerCommentAt) return false;
        if (!item.latestCustomerReadManagerAt) return true;
        return (
          new Date(item.latestManagerCommentAt).getTime() >
          new Date(item.latestCustomerReadManagerAt).getTime()
        );
      }),
      compatibilityMode: "modern" as const,
    };
  }),

  markMyOrderConversationRead: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const allowed = await canViewerAccessOrder(
        db,
        input.orderId,
        {
          id: ctx.user.id,
          phone: ctx.user.phone || null,
          email: ctx.user.email || null,
        },
        capabilities
      );

      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Заказ недоступен" });
      }

      if (!capabilities.hasOrderHistoryTable) {
        return { success: true, compatibilityMode: "legacy" as const };
      }

      const [readState] = await db
        .select({
          latestManagerCommentAt: capabilities.hasOrderCommentsTable
            ? sql<Date | null>`(
                SELECT MAX(${orderComments.createdAt})
                FROM ${orderComments}
                WHERE ${orderComments.orderId} = ${input.orderId}
                  AND ${orderComments.commentType} = 'manager'
              )`
            : sql<Date | null>`NULL`,
          latestCustomerReadManagerAt: sql<Date | null>`(
            SELECT MAX(${orderHistory.createdAt})
            FROM ${orderHistory}
            WHERE ${orderHistory.orderId} = ${input.orderId}
              AND ${orderHistory.actionType} = 'customer_conversation_read'
              AND ${orderHistory.userId} = ${ctx.user.id}
          )`,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      const latestManagerCommentAt = readState?.latestManagerCommentAt
        ? new Date(readState.latestManagerCommentAt).getTime()
        : 0;
      const latestCustomerReadManagerAt = readState?.latestCustomerReadManagerAt
        ? new Date(readState.latestCustomerReadManagerAt).getTime()
        : 0;

      if (
        latestManagerCommentAt > 0 &&
        latestCustomerReadManagerAt >= latestManagerCommentAt
      ) {
        return {
          success: true,
          compatibilityMode: "modern" as const,
          alreadyRead: true,
        };
      }

      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user.id,
        actionType: "customer_conversation_read",
        newValue: { readAt: new Date().toISOString() } as any,
        comment: "Клиент просмотрел переписку по заказу.",
      });

      return { success: true, compatibilityMode: "modern" as const };
    }),

  listOrders: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(200).default(25),
          offset: z.number().min(0).default(0),
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          paymentTypes: z.array(z.string()).optional(),
          sources: z.array(z.string()).optional(),
          managerId: z.number().optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
          conversationState: z.enum(["needs_response", "unread"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const limit = input?.limit ?? 25;
      const offset = input?.offset ?? 0;
      const whereClause = buildModernOrderWhere(input);

      if (canUseRichOrdersSchema(capabilities)) {
        const items = await db
          .select({
            id: orders.id,
            storeId: orders.storeId,
            reservationId: orders.reservationId,
            orderNumber: orders.orderNumber,
            userId: orders.userId,
            status: orders.status,
            moyskladOrderId: orders.moyskladOrderId,
            moyskladOrderHref: orders.moyskladOrderHref,
            moyskladSyncStatus: orders.moyskladSyncStatus,
            totalPrice: orders.totalPrice,
            subtotal: orders.subtotal,
            discountTotal: orders.discountTotal,
            deliveryPrice: orders.deliveryPrice,
            paidAmount: orders.paidAmount,
            deliveryType: orders.deliveryType,
            deliveryStatus: orders.deliveryStatus,
            deliveryCity: orders.deliveryCity,
            source: orders.source,
            managerId: orders.managerId,
            address: orders.address,
            paymentType: orders.paymentType,
            paymentStatus: orders.paymentStatus,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
            customerName: sql<string>`coalesce(${orders.customerName}, ${users.fullName})`,
            customerPhone: sql<string>`coalesce(${orders.customerPhone}, ${users.phone})`,
            customerEmail: sql<string>`coalesce(${orders.customerEmail}, ${users.email})`,
            itemsCount: sql<number>`(
              SELECT count(*) FROM ${orderItems}
              WHERE ${orderItems.orderId} = ${orders.id}
            )`,
            clientCommentsCount: capabilities.hasOrderCommentsTable
              ? sql<number>`(
                  SELECT count(*) FROM ${orderComments}
                  WHERE ${orderComments.orderId} = ${orders.id}
                    AND ${orderComments.commentType} = 'client'
                )`
              : sql<number>`0`,
            latestClientCommentAt: capabilities.hasOrderCommentsTable
              ? sql<Date | null>`(
                  SELECT MAX(${orderComments.createdAt})
                  FROM ${orderComments}
                  WHERE ${orderComments.orderId} = ${orders.id}
                    AND ${orderComments.commentType} = 'client'
                )`
              : sql<Date | null>`NULL`,
            latestManagerCommentAt: capabilities.hasOrderCommentsTable
              ? sql<Date | null>`(
                  SELECT MAX(${orderComments.createdAt})
                  FROM ${orderComments}
                  WHERE ${orderComments.orderId} = ${orders.id}
                    AND ${orderComments.commentType} = 'manager'
                )`
              : sql<Date | null>`NULL`,
            latestAdminReadClientAt: capabilities.hasOrderHistoryTable
              ? sql<Date | null>`(
                  SELECT MAX(${orderHistory.createdAt})
                  FROM ${orderHistory}
                  WHERE ${orderHistory.orderId} = ${orders.id}
                    AND ${orderHistory.actionType} = 'manager_conversation_read'
                )`
              : sql<Date | null>`NULL`,
          })
          .from(orders)
          .leftJoin(users, eq(orders.userId, users.id))
          .where(whereClause)
          .orderBy(desc(orders.createdAt))
          .limit(limit)
          .offset(offset);

        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(orders)
          .where(whereClause);

        return {
          orders: items.map(item => withFallbackDeliveryStatus(item)!),
          total: Number(countResult[0]?.count ?? 0),
          compatibilityMode: "modern" as const,
          compatibilityWarnings: [] as string[],
        };
      }

      const legacyWhereSql = buildLegacyOrderWhereSql({
        search: input?.search,
        statuses: input?.statuses,
        paymentStatuses: input?.paymentStatuses,
        deliveryTypes: input?.deliveryTypes,
        dateFrom: input?.dateFrom,
        dateTo: input?.dateTo,
        conversationState: capabilities.hasOrderCommentsTable
          ? input?.conversationState
          : undefined,
        supportsUserEmail: capabilities.hasUsersEmail,
        supportsUserFullName: capabilities.hasUsersFullName,
      });
      const ignoredFilters: string[] = [];
      // Legacy orders schema from 0003 does not store dedicated delivery/payment source
      // metadata, so these filters are reported back to the UI and safely ignored.
      if (input?.deliveryStatuses?.length) {
        ignoredFilters.push("deliveryStatuses");
      }
      if (input?.paymentTypes?.length) {
        ignoredFilters.push("paymentTypes");
      }
      if (input?.sources?.length) {
        ignoredFilters.push("sources");
      }
      if (typeof input?.managerId === "number") {
        ignoredFilters.push("managerId");
      }

      const legacyResult = await db.execute<any[]>(sql`
          SELECT
            o.id,
            NULL AS orderNumber,
            o.user_id AS userId,
            o.status,
            o.total_price AS totalPrice,
            o.delivery_type AS deliveryType,
            NULL AS deliveryStatus,
            NULL AS deliveryCity,
            'legacy' AS source,
            NULL AS managerId,
            o.address,
            o.payment_type AS paymentType,
            o.payment_status AS paymentStatus,
            o.created_at AS createdAt,
            o.created_at AS updatedAt,
            ${capabilities.hasUsersFullName ? sql`u.full_name` : sql`NULL`} AS customerName,
            u.phone AS customerPhone,
            ${capabilities.hasUsersEmail ? sql`u.email` : sql`NULL`} AS customerEmail,
            (
              SELECT COUNT(*)
              FROM order_items oi
              WHERE oi.order_id = o.id
            ) AS itemsCount,
            ${
              capabilities.hasOrderCommentsTable
                ? sql`(
                    SELECT COUNT(*)
                    FROM order_comments oc
                    WHERE oc.order_id = o.id
                      AND oc.comment_type = 'client'
                  )`
                : sql`0`
            } AS clientCommentsCount,
            ${
              capabilities.hasOrderCommentsTable
                ? sql`(
                    SELECT MAX(oc.created_at)
                    FROM order_comments oc
                    WHERE oc.order_id = o.id
                      AND oc.comment_type = 'client'
                  )`
                : sql`NULL`
            } AS latestClientCommentAt,
            ${
              capabilities.hasOrderCommentsTable
                ? sql`(
                    SELECT MAX(oc.created_at)
                    FROM order_comments oc
                    WHERE oc.order_id = o.id
                      AND oc.comment_type = 'manager'
                  )`
                : sql`NULL`
            } AS latestManagerCommentAt
            ,
            ${
              capabilities.hasOrderHistoryTable
                ? sql`(
                    SELECT MAX(oh.created_at)
                    FROM order_history oh
                    WHERE oh.order_id = o.id
                      AND oh.action_type = 'manager_conversation_read'
                  )`
                : sql`NULL`
            } AS latestAdminReadClientAt
          FROM orders o
          LEFT JOIN users u ON u.id = o.user_id
          ${legacyWhereSql}
          ORDER BY o.created_at DESC
          LIMIT ${limit} OFFSET ${offset}
        `);

      const legacyCountResult = await db.execute<any[]>(sql`
        SELECT COUNT(*) AS count
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ${legacyWhereSql}
      `);

      const legacyRows = Array.isArray((legacyResult as any)?.[0])
        ? (legacyResult as any)[0]
        : (legacyResult as any[]);
      const legacyCountRows = Array.isArray((legacyCountResult as any)?.[0])
        ? (legacyCountResult as any)[0]
        : (legacyCountResult as any[]);

      return {
        orders: (legacyRows as any[]).map(mapLegacyListOrderRow),
        total: Number((legacyCountRows as any[])[0]?.count ?? 0),
        compatibilityMode: "legacy" as const,
        compatibilityWarnings:
          ignoredFilters.length > 0
            ? [
                `Часть фильтров недоступна в legacy-схеме БД и была безопасно проигнорирована: ${ignoredFilters.join(
                  ", "
                )}`,
              ]
            : ["Раздел заказов работает в режиме совместимости с legacy-БД"],
      };
    }),

  updateOrderStatus: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        status: z.enum([
          "pending",
          "waiting_call",
          "confirmed",
          "shipped",
          "delivered",
          "cancelled",
          "new",
          "awaiting_payment",
          "paid",
          "processing",
          "confirmed_by_customer",
          "ready_for_pickup",
          "assembling",
          "assembled",
          "awaiting_dispatch",
          "handed_to_delivery",
          "in_delivery",
          "completed",
          "return_requested",
          "problem",
        ]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_status", {
        nextStatus: input.status,
      });
      const db = getDb();
      const existing = [await getOrderCoreForUpdate(db, input.id)].filter(Boolean);
      if (!existing[0]) throw new Error("Заказ не найден");
      assertOrderStatusEditableLocally(existing[0]);
      ensureTransition(ORDER_STATUS_FLOW, existing[0].status, input.status, "заказа");
      try {
        await db
          .update(orders)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(orders.id, input.id));
      } catch (err) {
        console.error("update status with updatedAt failed, trying legacy", err);
        await db.execute(sql`UPDATE orders SET status = ${input.status} WHERE id = ${input.id}`);
      }
      await safeInsertOrderHistory(db, {
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "status_changed",
        oldValue: { status: existing[0]?.status ?? null } as any,
        newValue: { status: input.status } as any,
      });
      const notificationEmail = existing[0]?.customerEmail;
      const notificationOrderNumber = existing[0]?.orderNumber;
      if (notificationEmail && notificationOrderNumber) {
        await sendOrderNotificationEmail({
          email: notificationEmail,
          orderNumber: notificationOrderNumber,
          eventType:
            input.status === "cancelled"
              ? "order_cancelled"
              : input.status === "return_requested"
              ? "order_refund"
                : "order_status_changed",
          data: {
            customerName: existing[0]?.customerName,
            orderStatus: input.status,
            previousStatus: existing[0]?.status ?? null,
            newStatus: input.status,
            orderDate: new Date(),
            orderUrl: ACCOUNT_ORDERS_URL,
          },
          message: `Новый статус заказа: ${input.status}.`,
        }).catch(err => {
          console.error("order_status email failed", err);
        });
      }
      if (input.status === "delivered" || input.status === "completed") {
        await sendReviewInvitationsForCompletedOrder(db, input.id).catch(err => {
          console.error("review invitation flow failed", err);
        });
      }

      await enqueueMoyskladSyncJob({
        entityType: "status",
        entityId: input.id,
        action: "status_update",
        payloadSnapshot: {
          status: input.status,
          previousStatus: existing[0]?.status ?? null,
        },
      });
      if (
        input.status === "cancelled" ||
        input.status === "completed" ||
        input.status === "return_requested"
      ) {
        await enqueueLoyaltySyncJob({
          jobType: "order_loyalty_sync",
          orderId: input.id,
          payloadJson: {
            reason: "order_status_changed",
            status: input.status,
            previousStatus: existing[0]?.status ?? null,
          },
        }).catch(err => {
          console.error("loyalty order sync enqueue failed", err);
        });
      }
      return { success: true };
    }),

  getOrderById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);

      if (canUseRichOrdersSchema(capabilities)) {
        const orderRows = await db
          .select({
            id: orders.id,
            storeId: orders.storeId,
            reservationId: orders.reservationId,
            orderNumber: orders.orderNumber,
            status: orders.status,
            moyskladOrderId: orders.moyskladOrderId,
            moyskladOrderHref: orders.moyskladOrderHref,
            moyskladExternalCode: orders.moyskladExternalCode,
            moyskladSyncStatus: orders.moyskladSyncStatus,
            paymentStatus: orders.paymentStatus,
            deliveryStatus: orders.deliveryStatus,
            totalPrice: orders.totalPrice,
            subtotal: orders.subtotal,
            discountTotal: orders.discountTotal,
            deliveryPrice: orders.deliveryPrice,
            paidAmount: orders.paidAmount,
            loyaltyBalanceBefore: orders.loyaltyBalanceBefore,
            loyaltyBonusRequested: orders.loyaltyBonusRequested,
            loyaltyBonusSpent: orders.loyaltyBonusSpent,
            loyaltyBonusAccrued: orders.loyaltyBonusAccrued,
            loyaltyBonusExpectedAccrued: orders.loyaltyBonusExpectedAccrued,
            loyaltyActualSpent: orders.loyaltyActualSpent,
            loyaltyActualAccrued: orders.loyaltyActualAccrued,
            loyaltySyncStatus: orders.loyaltySyncStatus,
            loyaltyLastSyncError: orders.loyaltyLastSyncError,
            loyaltyLastSyncedAt: orders.loyaltyLastSyncedAt,
            loyaltyProgramSnapshotJson: orders.loyaltyProgramSnapshotJson,
            loyaltyPreviewPayloadJson: orders.loyaltyPreviewPayloadJson,
            loyaltyRulesSnapshotJson: orders.loyaltyRulesSnapshotJson,
            loyaltyRawResultJson: orders.loyaltyRawResultJson,
            paymentType: orders.paymentType,
            paymentMethod: orders.paymentMethod,
            paymentId: orders.paymentId,
            paymentProviderStatus: capabilities.hasOrdersPaymentProviderMetadata
              ? orders.paymentProviderStatus
              : sql<string | null>`NULL`,
            paymentTest: capabilities.hasOrdersPaymentProviderMetadata
              ? orders.paymentTest
              : sql<boolean | null>`NULL`,
            paymentCancellationParty: capabilities.hasOrdersPaymentProviderMetadata
              ? orders.paymentCancellationParty
              : sql<string | null>`NULL`,
            paymentCancellationReason: capabilities.hasOrdersPaymentProviderMetadata
              ? orders.paymentCancellationReason
              : sql<string | null>`NULL`,
            paymentRawResponseJson: capabilities.hasOrdersPaymentProviderMetadata
              ? orders.paymentRawResponseJson
              : sql<unknown | null>`NULL`,
            paymentError: orders.paymentError,
            paidAt: orders.paidAt,
            deliveryType: orders.deliveryType,
            deliveryService: orders.deliveryService,
            deliveryProvider: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProvider
              : sql<string | null>`NULL`,
            deliveryProviderOrderId: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderOrderId
              : sql<string | null>`NULL`,
            deliveryProviderOfferId: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderOfferId
              : sql<string | null>`NULL`,
            deliveryProviderStatus: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderStatus
              : sql<string | null>`NULL`,
            deliveryProviderLastSyncAt: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderLastSyncAt
              : sql<Date | null>`NULL`,
            deliveryProviderError: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderError
              : sql<string | null>`NULL`,
            deliveryProviderRawJson: capabilities.hasOrdersDeliveryProviderMetadata
              ? orders.deliveryProviderRawJson
              : sql<unknown | null>`NULL`,
            deliveryCity: orders.deliveryCity,
            deliveryRegion: orders.deliveryRegion,
            deliveryPostalCode: orders.deliveryPostalCode,
            deliveryTrackNumber: orders.deliveryTrackNumber,
            deliveryComment: orders.deliveryComment,
            address: orders.address,
            source: orders.source,
            managerId: orders.managerId,
            customerName: sql<string>`coalesce(${orders.customerName}, ${users.fullName})`,
            customerPhone: sql<string>`coalesce(${orders.customerPhone}, ${users.phone})`,
            customerEmail: sql<string>`coalesce(${orders.customerEmail}, ${users.email})`,
            customerFirstName: orders.customerFirstName,
            customerLastName: orders.customerLastName,
            customerComment: orders.customerComment,
            internalComment: orders.internalComment,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .leftJoin(users, eq(orders.userId, users.id))
          .where(eq(orders.id, input.id))
          .limit(1);

        if (!orderRows[0]) {
          throw new Error("Заказ не найден");
        }

        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            variantId: orderItems.variantId,
            variantName: orderItems.variantName,
            article: orderItems.article,
            sku: orderItems.sku,
            productName: sql<string>`coalesce(${orderItems.productName}, ${products.name})`,
            image: sql<string>`coalesce(${orderItems.image}, ${products.image})`,
            quantity: orderItems.quantity,
            price: orderItems.price,
            discount: orderItems.discount,
            total: orderItems.total,
            stockStatus: orderItems.stockStatus,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, input.id))
          .orderBy(orderItems.id);

        const receiptMeta = extractReceiptMeta(orderRows[0].paymentRawResponseJson);

        return {
          ...withFallbackDeliveryStatus(orderRows[0]),
          ...receiptMeta,
          items,
          compatibilityMode: "modern" as const,
          compatibilityWarnings: [] as string[],
        };
      }

      const legacyOrderResult = await db.execute<any[]>(sql`
        SELECT
          o.id,
          NULL AS orderNumber,
          o.status,
          NULL AS moyskladOrderId,
          NULL AS moyskladOrderHref,
          NULL AS moyskladExternalCode,
          NULL AS moyskladSyncStatus,
          o.payment_status AS paymentStatus,
          NULL AS deliveryStatus,
          o.total_price AS totalPrice,
          o.total_price AS subtotal,
          0 AS discountTotal,
          0 AS deliveryPrice,
          0 AS paidAmount,
          o.payment_type AS paymentType,
          NULL AS paymentMethod,
          NULL AS paymentId,
          NULL AS paymentProviderStatus,
          NULL AS paymentTest,
          NULL AS paymentCancellationParty,
          NULL AS paymentCancellationReason,
          NULL AS paymentRawResponseJson,
          NULL AS paymentError,
          NULL AS paidAt,
          o.delivery_type AS deliveryType,
          NULL AS deliveryService,
          NULL AS deliveryProvider,
          NULL AS deliveryProviderOrderId,
          NULL AS deliveryProviderOfferId,
          NULL AS deliveryProviderStatus,
          NULL AS deliveryProviderLastSyncAt,
          NULL AS deliveryProviderError,
          NULL AS deliveryProviderRawJson,
          NULL AS deliveryCity,
          NULL AS deliveryRegion,
          NULL AS deliveryPostalCode,
          NULL AS deliveryTrackNumber,
          NULL AS deliveryComment,
          o.address,
          'legacy' AS source,
          NULL AS managerId,
          ${capabilities.hasUsersFullName ? sql`u.full_name` : sql`NULL`} AS customerName,
          u.phone AS customerPhone,
          ${capabilities.hasUsersEmail ? sql`u.email` : sql`NULL`} AS customerEmail,
          NULL AS customerFirstName,
          NULL AS customerLastName,
          NULL AS customerComment,
          NULL AS internalComment,
          o.created_at AS createdAt,
          o.created_at AS updatedAt
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        WHERE o.id = ${input.id}
        LIMIT 1
      `);
      const legacyOrderRows = rowsFromExecute<any>(legacyOrderResult);
      if (!legacyOrderRows[0]) throw new Error("Заказ не найден");

      const legacyItemsResult = await db.execute<any[]>(sql`
        SELECT
          oi.id,
          oi.order_id AS orderId,
          oi.product_id AS productId,
          NULL AS variantId,
          NULL AS variantName,
          NULL AS article,
          NULL AS sku,
          p.name AS productName,
          p.image AS image,
          oi.quantity,
          oi.price,
          0 AS discount,
          (oi.quantity * oi.price) AS total,
          'in_stock' AS stockStatus
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ${input.id}
        ORDER BY oi.id ASC
      `);
      const legacyItemsRows = rowsFromExecute<any>(legacyItemsResult);

      return {
        ...mapLegacyOrderDetailsRow(legacyOrderRows[0]),
        items: legacyItemsRows.map(mapLegacyOrderItemRow),
        compatibilityMode: "legacy" as const,
        compatibilityWarnings: [
          "Карточка заказа открыта в режиме совместимости с legacy-БД: часть новых полей недоступна.",
        ],
      };
    }),

  getMyOrderDetails: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const allowed = await canViewerAccessOrder(
        db,
        input.orderId,
        {
          id: ctx.user.id,
          phone: ctx.user.phone || null,
          email: ctx.user.email || null,
        },
        capabilities
      );

      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Заказ недоступен" });
      }

      if (canUseRichOrdersSchema(capabilities)) {
        let orderRows = await db
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            paymentStatus: orders.paymentStatus,
            deliveryStatus: orders.deliveryStatus,
            totalPrice: orders.totalPrice,
            subtotal: orders.subtotal,
            discountTotal: orders.discountTotal,
            deliveryPrice: orders.deliveryPrice,
            paidAmount: orders.paidAmount,
            paymentType: orders.paymentType,
            paymentMethod: orders.paymentMethod,
            paymentId: orders.paymentId,
            paymentProviderStatus: orders.paymentProviderStatus,
            paymentTest: orders.paymentTest,
            paymentCancellationParty: orders.paymentCancellationParty,
            paymentCancellationReason: orders.paymentCancellationReason,
            paymentRawResponseJson: orders.paymentRawResponseJson,
            paidAt: orders.paidAt,
            deliveryType: orders.deliveryType,
            deliveryService: orders.deliveryService,
            deliveryProvider: orders.deliveryProvider,
            deliveryProviderOrderId: orders.deliveryProviderOrderId,
            deliveryProviderOfferId: orders.deliveryProviderOfferId,
            deliveryProviderStatus: orders.deliveryProviderStatus,
            deliveryProviderLastSyncAt: orders.deliveryProviderLastSyncAt,
            deliveryProviderError: orders.deliveryProviderError,
            deliveryProviderRawJson: orders.deliveryProviderRawJson,
            deliveryCity: orders.deliveryCity,
            deliveryRegion: orders.deliveryRegion,
            deliveryPostalCode: orders.deliveryPostalCode,
            deliveryTrackNumber: orders.deliveryTrackNumber,
            deliveryComment: orders.deliveryComment,
            address: orders.address,
            customerComment: orders.customerComment,
            createdAt: orders.createdAt,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);

        if (!orderRows[0]) {
          throw new Error("Заказ не найден");
        }

        const initialReceiptMeta = extractReceiptMeta(
          orderRows[0].paymentRawResponseJson
        );
        if (
          orderRows[0].paymentMethod === "yookassa" &&
          orderRows[0].paymentStatus === "paid" &&
          orderRows[0].paymentId &&
          !initialReceiptMeta.receiptUrl &&
          !initialReceiptMeta.receiptPdfUrl
        ) {
          try {
            await refreshYooKassaPaymentForOrder(input.orderId);
            orderRows = await db
              .select({
                id: orders.id,
                orderNumber: orders.orderNumber,
                status: orders.status,
                paymentStatus: orders.paymentStatus,
                deliveryStatus: orders.deliveryStatus,
                totalPrice: orders.totalPrice,
                subtotal: orders.subtotal,
                discountTotal: orders.discountTotal,
                deliveryPrice: orders.deliveryPrice,
                paidAmount: orders.paidAmount,
                paymentType: orders.paymentType,
                paymentMethod: orders.paymentMethod,
                paymentId: orders.paymentId,
                paymentProviderStatus: orders.paymentProviderStatus,
                paymentTest: orders.paymentTest,
                paymentCancellationParty: orders.paymentCancellationParty,
                paymentCancellationReason: orders.paymentCancellationReason,
                paymentRawResponseJson: orders.paymentRawResponseJson,
                paidAt: orders.paidAt,
                deliveryType: orders.deliveryType,
                deliveryService: orders.deliveryService,
                deliveryProvider: orders.deliveryProvider,
                deliveryProviderOrderId: orders.deliveryProviderOrderId,
                deliveryProviderOfferId: orders.deliveryProviderOfferId,
                deliveryProviderStatus: orders.deliveryProviderStatus,
                deliveryProviderLastSyncAt: orders.deliveryProviderLastSyncAt,
                deliveryProviderError: orders.deliveryProviderError,
                deliveryProviderRawJson: orders.deliveryProviderRawJson,
                deliveryCity: orders.deliveryCity,
                deliveryRegion: orders.deliveryRegion,
                deliveryPostalCode: orders.deliveryPostalCode,
                deliveryTrackNumber: orders.deliveryTrackNumber,
                deliveryComment: orders.deliveryComment,
                address: orders.address,
                customerComment: orders.customerComment,
                createdAt: orders.createdAt,
                updatedAt: orders.updatedAt,
              })
              .from(orders)
              .where(eq(orders.id, input.orderId))
              .limit(1);
          } catch (error) {
            console.error("order receipt refresh skipped", error);
          }
        }

        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
            variantId: orderItems.variantId,
            variantName: orderItems.variantName,
            article: orderItems.article,
            sku: orderItems.sku,
            productName: sql<string>`coalesce(${orderItems.productName}, ${products.name})`,
            image: sql<string>`coalesce(${orderItems.image}, ${products.image})`,
            quantity: orderItems.quantity,
            price: orderItems.price,
            discount: orderItems.discount,
            total: orderItems.total,
            stockStatus: orderItems.stockStatus,
          })
          .from(orderItems)
          .leftJoin(products, eq(orderItems.productId, products.id))
          .where(eq(orderItems.orderId, input.orderId))
          .orderBy(orderItems.id);

        return {
          ...withFallbackDeliveryStatus(orderRows[0]),
          items,
          compatibilityMode: "modern" as const,
          compatibilityWarnings: [] as string[],
        };
      }

      const legacyOrderResult = await db.execute<any[]>(sql`
        SELECT
          o.id,
          NULL AS orderNumber,
          o.status,
          o.payment_status AS paymentStatus,
          NULL AS deliveryStatus,
          o.total_price AS totalPrice,
          o.total_price AS subtotal,
          0 AS discountTotal,
          0 AS deliveryPrice,
          0 AS paidAmount,
          o.payment_type AS paymentType,
          NULL AS paymentMethod,
          NULL AS paymentId,
          NULL AS paymentProviderStatus,
          NULL AS paymentTest,
          NULL AS paymentCancellationParty,
          NULL AS paymentCancellationReason,
          NULL AS paymentRawResponseJson,
          NULL AS paidAt,
          o.delivery_type AS deliveryType,
          NULL AS deliveryService,
          NULL AS deliveryProvider,
          NULL AS deliveryProviderOrderId,
          NULL AS deliveryProviderOfferId,
          NULL AS deliveryProviderStatus,
          NULL AS deliveryProviderLastSyncAt,
          NULL AS deliveryProviderError,
          NULL AS deliveryProviderRawJson,
          NULL AS deliveryCity,
          NULL AS deliveryRegion,
          NULL AS deliveryPostalCode,
          NULL AS deliveryTrackNumber,
          NULL AS deliveryComment,
          o.address,
          NULL AS customerComment,
          o.created_at AS createdAt,
          o.created_at AS updatedAt
        FROM orders o
        WHERE o.id = ${input.orderId}
        LIMIT 1
      `);
      const legacyOrderRows = rowsFromExecute<any>(legacyOrderResult);
      if (!legacyOrderRows[0]) throw new Error("Заказ не найден");

      const legacyItemsResult = await db.execute<any[]>(sql`
        SELECT
          oi.id,
          oi.order_id AS orderId,
          oi.product_id AS productId,
          NULL AS variantId,
          NULL AS variantName,
          NULL AS article,
          NULL AS sku,
          p.name AS productName,
          p.image AS image,
          oi.quantity,
          oi.price,
          0 AS discount,
          (oi.quantity * oi.price) AS total,
          'in_stock' AS stockStatus
        FROM order_items oi
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = ${input.orderId}
        ORDER BY oi.id ASC
      `);
      const legacyItemsRows = rowsFromExecute<any>(legacyItemsResult);

      const mappedLegacy = mapLegacyOrderDetailsRow(legacyOrderRows[0]) as Record<
        string,
        any
      >;
      const receiptMeta = extractReceiptMeta(mappedLegacy.paymentRawResponseJson);

      return {
        ...mappedLegacy,
        ...receiptMeta,
        items: legacyItemsRows.map(mapLegacyOrderItemRow),
        compatibilityMode: "legacy" as const,
        compatibilityWarnings: [
          "Детали заказа открыты в режиме совместимости: часть новых полей может быть недоступна.",
        ],
      };
    }),

  getMyOrderHistory: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      let capabilities = await getOrderDbCapabilities(db);
      const allowed = await canViewerAccessOrder(
        db,
        input.orderId,
        {
          id: ctx.user.id,
          phone: ctx.user.phone || null,
          email: ctx.user.email || null,
        },
        capabilities
      );

      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Заказ недоступен" });
      }

      if (!capabilities.hasOrderHistoryTable && !capabilities.hasOrderCommentsTable) {
        const refreshedCapabilities = await getOrderDbCapabilities(db, {
          forceRefresh: true,
        });
        capabilities = refreshedCapabilities;
      }

      if (!capabilities.hasOrderHistoryTable && !capabilities.hasOrderCommentsTable) {
        return {
          history: [],
          comments: [],
          compatibilityMode: "legacy" as const,
          warning:
            "История и комментарии заказа пока недоступны: в legacy-схеме отсутствуют нужные таблицы.",
        };
      }

      try {
        const history = capabilities.hasOrderHistoryTable
          ? await db
              .select({
                id: orderHistory.id,
                orderId: orderHistory.orderId,
                userId: orderHistory.userId,
                actionType: orderHistory.actionType,
                oldValue: orderHistory.oldValue,
                newValue: orderHistory.newValue,
                comment: orderHistory.comment,
                createdAt: orderHistory.createdAt,
              })
              .from(orderHistory)
              .where(eq(orderHistory.orderId, input.orderId))
              .orderBy(desc(orderHistory.createdAt))
          : [];

        const comments = capabilities.hasOrderCommentsTable
          ? await db
              .select({
                id: orderComments.id,
                orderId: orderComments.orderId,
                userId: orderComments.userId,
                commentType: orderComments.commentType,
                comment: orderComments.comment,
                createdAt: orderComments.createdAt,
              })
              .from(orderComments)
              .where(eq(orderComments.orderId, input.orderId))
              .orderBy(desc(orderComments.createdAt))
          : [];

        const [readState] = capabilities.hasOrderHistoryTable
          ? await db
              .select({
                latestManagerCommentAt: capabilities.hasOrderCommentsTable
                  ? sql<Date | null>`(
                      SELECT MAX(${orderComments.createdAt})
                      FROM ${orderComments}
                      WHERE ${orderComments.orderId} = ${input.orderId}
                        AND ${orderComments.commentType} = 'manager'
                    )`
                  : sql<Date | null>`NULL`,
                latestCustomerReadManagerAt: sql<Date | null>`(
                  SELECT MAX(${orderHistory.createdAt})
                  FROM ${orderHistory}
                  WHERE ${orderHistory.orderId} = ${input.orderId}
                    AND ${orderHistory.actionType} = 'customer_conversation_read'
                    AND ${orderHistory.userId} = ${ctx.user.id}
                )`,
              })
              .from(orders)
              .where(eq(orders.id, input.orderId))
              .limit(1)
          : [
              {
                latestManagerCommentAt: null,
                latestCustomerReadManagerAt: null,
              },
            ];

        return {
          history,
          comments: comments.filter(comment => comment.commentType !== "internal"),
          readState,
          compatibilityMode:
            capabilities.hasOrderHistoryTable && capabilities.hasOrderCommentsTable
              ? ("modern" as const)
              : ("legacy" as const),
          warning:
            capabilities.hasOrderHistoryTable && capabilities.hasOrderCommentsTable
              ? undefined
              : "Часть ленты заказа недоступна: отдельные таблицы истории или комментариев отсутствуют.",
        };
      } catch (err) {
        console.error("getMyOrderHistory fallback", err);
        return {
          history: [],
          comments: [],
          compatibilityMode: "legacy" as const,
          warning:
            "Не удалось загрузить историю заказа полностью. Возвращен безопасный пустой результат.",
        };
      }
    }),

  addMyOrderComment: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        comment: z.string().trim().min(1).max(2000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      let capabilities = await getOrderDbCapabilities(db);
      const allowed = await canViewerAccessOrder(
        db,
        input.orderId,
        {
          id: ctx.user.id,
          phone: ctx.user.phone || null,
          email: ctx.user.email || null,
        },
        capabilities
      );

      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Заказ недоступен" });
      }

      if (!capabilities.hasOrderCommentsTable) {
        capabilities = await getOrderDbCapabilities(db, { forceRefresh: true });
      }

      if (!capabilities.hasOrderCommentsTable) {
        await safeInsertOrderHistory(db, {
          orderId: input.orderId,
          userId: ctx.user?.id ?? null,
          actionType: "customer_comment_skipped_legacy",
          newValue: { comment: input.comment } as any,
          comment:
            "Сообщение клиента не сохранено: таблица order_comments отсутствует в legacy-схеме.",
        });
        return {
          success: true,
          compatibilityMode: "legacy" as const,
          warning:
            "Сообщение не сохранено отдельно: в текущей legacy-схеме нет таблицы комментариев.",
        };
      }

      await db.insert(orderComments).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        commentType: "client",
        comment: input.comment,
      });

      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "customer_comment_added",
        newValue: { commentType: "client", comment: input.comment } as any,
        comment: "Клиент добавил сообщение к заказу.",
      });

      return { success: true, compatibilityMode: "modern" as const };
    }),

  addOrderComment: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        comment: z.string().trim().min(1),
        commentType: z.enum(["internal", "client", "manager"]).default("internal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "add_comment");
      const db = getDb();
      let capabilities = await getOrderDbCapabilities(db);

      if (!capabilities.hasOrderCommentsTable) {
        capabilities = await getOrderDbCapabilities(db, { forceRefresh: true });
      }

      if (!capabilities.hasOrderCommentsTable) {
        await safeInsertOrderHistory(db, {
          orderId: input.orderId,
          userId: ctx.user?.id ?? null,
          actionType: "comment_skipped_legacy",
          newValue: { commentType: input.commentType, comment: input.comment } as any,
          comment: "Комментарий не сохранен: таблица order_comments отсутствует в legacy-схеме.",
        });
        return {
          success: true,
          compatibilityMode: "legacy" as const,
          warning:
            "Комментарии к заказам недоступны в legacy-схеме БД. Запись не сохранена в отдельной таблице.",
        };
      }

      await db.insert(orderComments).values({
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        commentType: input.commentType,
        comment: input.comment,
      });

      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "comment_added",
        newValue: { commentType: input.commentType, comment: input.comment } as any,
      });

      if (input.commentType === "manager") {
        await safeInsertOrderHistory(db, {
          orderId: input.orderId,
          userId: ctx.user?.id ?? null,
          actionType: "manager_conversation_read",
          newValue: { readAt: new Date().toISOString(), reason: "manager_reply" } as any,
          comment: "Менеджер ответил клиенту и просмотрел переписку.",
        });
      }

      return { success: true, compatibilityMode: "modern" as const };
    }),

  markOrderConversationRead: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);

      if (!capabilities.hasOrderHistoryTable) {
        return { success: true, compatibilityMode: "legacy" as const };
      }

      const [readState] = await db
        .select({
          latestClientCommentAt: capabilities.hasOrderCommentsTable
            ? sql<Date | null>`(
                SELECT MAX(${orderComments.createdAt})
                FROM ${orderComments}
                WHERE ${orderComments.orderId} = ${input.orderId}
                  AND ${orderComments.commentType} = 'client'
              )`
            : sql<Date | null>`NULL`,
          latestAdminReadClientAt: sql<Date | null>`(
            SELECT MAX(${orderHistory.createdAt})
            FROM ${orderHistory}
            WHERE ${orderHistory.orderId} = ${input.orderId}
              AND ${orderHistory.actionType} = 'manager_conversation_read'
          )`,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      const latestClientCommentAt = readState?.latestClientCommentAt
        ? new Date(readState.latestClientCommentAt).getTime()
        : 0;
      const latestAdminReadClientAt = readState?.latestAdminReadClientAt
        ? new Date(readState.latestAdminReadClientAt).getTime()
        : 0;

      if (latestClientCommentAt > 0 && latestAdminReadClientAt >= latestClientCommentAt) {
        return {
          success: true,
          compatibilityMode: "modern" as const,
          alreadyRead: true,
        };
      }

      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "manager_conversation_read",
        newValue: { readAt: new Date().toISOString() } as any,
        comment: "Менеджер просмотрел переписку с клиентом.",
      });

      return { success: true, compatibilityMode: "modern" as const };
    }),

  getOrderHistory: protectedProcedure
    .input(z.object({ orderId: z.number() }))
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      let capabilities = await getOrderDbCapabilities(db);

      if (!capabilities.hasOrderHistoryTable && !capabilities.hasOrderCommentsTable) {
        capabilities = await getOrderDbCapabilities(db, { forceRefresh: true });
      }

      if (!capabilities.hasOrderHistoryTable && !capabilities.hasOrderCommentsTable) {
        return {
          history: [],
          comments: [],
          compatibilityMode: "legacy" as const,
          warning:
            "История и комментарии заказов недоступны: в legacy-схеме отсутствуют таблицы order_history и order_comments.",
        };
      }

      try {
        const history = capabilities.hasOrderHistoryTable
          ? await db
          .select({
            id: orderHistory.id,
            orderId: orderHistory.orderId,
            userId: orderHistory.userId,
            actionType: orderHistory.actionType,
            oldValue: orderHistory.oldValue,
            newValue: orderHistory.newValue,
            comment: orderHistory.comment,
            createdAt: orderHistory.createdAt,
          })
          .from(orderHistory)
          .where(eq(orderHistory.orderId, input.orderId))
          .orderBy(desc(orderHistory.createdAt))
          : [];

        const comments = capabilities.hasOrderCommentsTable
          ? await db
          .select({
            id: orderComments.id,
            orderId: orderComments.orderId,
            userId: orderComments.userId,
            commentType: orderComments.commentType,
            comment: orderComments.comment,
            createdAt: orderComments.createdAt,
          })
          .from(orderComments)
          .where(eq(orderComments.orderId, input.orderId))
          .orderBy(desc(orderComments.createdAt))
          : [];

        const [readState] = capabilities.hasOrderHistoryTable
          ? await db
              .select({
                latestClientCommentAt: capabilities.hasOrderCommentsTable
                  ? sql<Date | null>`(
                      SELECT MAX(${orderComments.createdAt})
                      FROM ${orderComments}
                      WHERE ${orderComments.orderId} = ${input.orderId}
                        AND ${orderComments.commentType} = 'client'
                    )`
                  : sql<Date | null>`NULL`,
                latestManagerCommentAt: capabilities.hasOrderCommentsTable
                  ? sql<Date | null>`(
                      SELECT MAX(${orderComments.createdAt})
                      FROM ${orderComments}
                      WHERE ${orderComments.orderId} = ${input.orderId}
                        AND ${orderComments.commentType} = 'manager'
                    )`
                  : sql<Date | null>`NULL`,
                latestAdminReadClientAt: sql<Date | null>`(
                  SELECT MAX(${orderHistory.createdAt})
                  FROM ${orderHistory}
                  WHERE ${orderHistory.orderId} = ${input.orderId}
                    AND ${orderHistory.actionType} = 'manager_conversation_read'
                )`,
              })
              .from(orders)
              .where(eq(orders.id, input.orderId))
              .limit(1)
          : [
              {
                latestClientCommentAt: null,
                latestManagerCommentAt: null,
                latestAdminReadClientAt: null,
              },
            ];

        return {
          history,
          comments,
          readState,
          compatibilityMode:
            capabilities.hasOrderHistoryTable && capabilities.hasOrderCommentsTable
              ? ("modern" as const)
              : ("legacy" as const),
          warning:
            capabilities.hasOrderHistoryTable && capabilities.hasOrderCommentsTable
              ? undefined
              : "Часть ленты заказа недоступна: в legacy-схеме отсутствуют отдельные таблицы истории или комментариев.",
        };
      } catch (err) {
        console.error("getOrderHistory fallback (legacy schema)", err);
        return {
          history: [],
          comments: [],
          compatibilityMode: "legacy" as const,
          warning:
            "Не удалось загрузить историю заказа в полной схеме. Возвращен безопасный пустой результат.",
        };
      }
    }),

  updateOrderDetails: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        customerName: z.string().trim().min(2).optional(),
        customerPhone: z.string().trim().min(6).optional(),
        customerEmail: z.string().trim().email().optional().or(z.literal("")),
        address: z.string().trim().optional(),
        deliveryType: z.enum(["pickup", "delivery"]).optional(),
        deliveryCity: z.string().trim().optional(),
        deliveryRegion: z.string().trim().optional(),
        deliveryPostalCode: z.string().trim().optional(),
        customerComment: z.string().trim().optional(),
        internalComment: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_details");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const existing = [await getOrderCoreForUpdate(db, input.id)].filter(Boolean);
      if (!existing[0]) throw new Error("Заказ не найден");

      const patch: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (typeof input.customerName === "string") patch.customerName = input.customerName;
      if (typeof input.customerPhone === "string") patch.customerPhone = input.customerPhone;
      if (typeof input.customerEmail === "string")
        patch.customerEmail = input.customerEmail.trim() || null;
      if (typeof input.address === "string") patch.address = input.address || null;
      if (typeof input.deliveryType === "string") patch.deliveryType = input.deliveryType;
      if (typeof input.deliveryCity === "string") patch.deliveryCity = input.deliveryCity || null;
      if (typeof input.deliveryRegion === "string")
        patch.deliveryRegion = input.deliveryRegion || null;
      if (typeof input.deliveryPostalCode === "string")
        patch.deliveryPostalCode = input.deliveryPostalCode || null;
      if (typeof input.customerComment === "string")
        patch.customerComment = input.customerComment || null;
      if (typeof input.internalComment === "string")
        patch.internalComment = input.internalComment || null;

      if (canUseModernOrderDetailsSchema(capabilities)) {
        await db.update(orders).set(patch as any).where(eq(orders.id, input.id));
      } else {
        await db.execute(
          sql`UPDATE orders
              SET address = ${patch.address ?? existing[0].address ?? null},
                  delivery_type = ${patch.deliveryType ?? existing[0].deliveryType ?? "pickup"},
                  payment_type = ${existing[0].paymentType ?? "cash"}
              WHERE id = ${input.id}`
        );
      }
      await safeInsertOrderHistory(db, {
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "order_details_updated",
        oldValue: existing[0] as any,
        newValue: patch as any,
      });
      return { success: true };
    }),

  updateOrderPayment: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        paymentStatus: z.string().trim().min(2),
        paidAmount: z.number().int().min(0).optional(),
        paymentMethod: z.string().trim().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_payment");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const existing = [await getOrderCoreForUpdate(db, input.id)].filter(Boolean);
      if (!existing[0]) throw new Error("Заказ не найден");
      ensureTransition(
        PAYMENT_STATUS_FLOW,
        existing[0].paymentStatus,
        input.paymentStatus,
        "оплаты"
      );
      if (canUseModernOrderPaymentSchema(capabilities)) {
        await db
          .update(orders)
          .set({
            paymentStatus: input.paymentStatus,
            paidAmount: input.paidAmount,
            paymentMethod: input.paymentMethod,
            updatedAt: new Date(),
          } as any)
          .where(eq(orders.id, input.id));
      } else {
        await db.execute(
          sql`UPDATE orders SET payment_status = ${input.paymentStatus} WHERE id = ${input.id}`
        );
      }
      await safeInsertOrderHistory(db, {
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "payment_updated",
        newValue: input as any,
      });
      if (existing[0].customerEmail && existing[0].orderNumber && input.paymentStatus === "paid") {
        await sendOrderNotificationEmail({
          email: existing[0].customerEmail,
          orderNumber: existing[0].orderNumber,
          eventType: "payment_success",
          data: {
            customerName: existing[0]?.customerName,
            orderStatus: existing[0]?.status,
            paymentMethod: input.paymentMethod || existing[0]?.paymentMethod || existing[0]?.paymentType,
            paymentStatus: input.paymentStatus,
            paidAmount: input.paidAmount ?? existing[0]?.totalPrice ?? null,
            paidAt: new Date(),
            totalAmount: existing[0]?.totalPrice ?? null,
            orderUrl: ACCOUNT_ORDERS_URL,
          },
          message: `Оплата по заказу ${existing[0].orderNumber} успешно получена.`,
        }).catch(err => {
          console.error("payment_success email failed", err);
        });
      }
      if (
        existing[0].customerEmail &&
        existing[0].orderNumber &&
        input.paymentStatus === "payment_error"
      ) {
        await sendOrderNotificationEmail({
          email: existing[0].customerEmail,
          orderNumber: existing[0].orderNumber,
          eventType: "payment_failed",
          data: {
            customerName: existing[0]?.customerName,
            orderStatus: existing[0]?.status,
            paymentMethod:
              input.paymentMethod ||
              existing[0]?.paymentMethod ||
              existing[0]?.paymentType,
            paymentStatus: input.paymentStatus,
            totalAmount: existing[0]?.totalPrice ?? null,
            paymentError: existing[0]?.paymentError || "Платёж не был подтверждён.",
            orderUrl: ACCOUNT_ORDERS_URL,
          },
          message:
            "Платёж по заказу не подтверждён. Вы можете вернуться к заказу и попробовать снова.",
        }).catch(err => {
          console.error("payment_failed email failed", err);
        });
      }
      if (
        input.paymentStatus === "paid" ||
        input.paymentStatus === "refund" ||
        input.paymentStatus === "partial_refund"
      ) {
        await enqueueMoyskladSyncJob({
          entityType: "payment",
          entityId: input.id,
          action: "payment",
          payloadSnapshot: {
            source: "admin",
            paymentStatus: input.paymentStatus,
            paymentMethod: input.paymentMethod || existing[0]?.paymentMethod || existing[0]?.paymentType,
          },
        }).catch(err => {
          console.error("moysklad payment sync enqueue failed", err);
        });
        await enqueueLoyaltySyncJob({
          jobType: "order_loyalty_sync",
          orderId: input.id,
          payloadJson: {
            reason: "payment_status_changed",
            paymentStatus: input.paymentStatus,
            paymentMethod:
              input.paymentMethod ||
              existing[0]?.paymentMethod ||
              existing[0]?.paymentType,
          },
        }).catch(err => {
          console.error("loyalty payment sync enqueue failed", err);
        });
        await syncOrderLoyaltyFromMoysklad(input.id).catch(err => {
          console.error("loyalty sync after admin payment update failed", err);
        });
      }
      return { success: true };
    }),

  refreshYooKassaPayment: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_payment");
      const result = await refreshYooKassaPaymentForOrder(input.id);
      await safeInsertOrderHistory(getDb(), {
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "payment_updated",
        newValue: {
          provider: "yookassa",
          action: "refresh",
          paymentId: result.paymentId,
          status: result.status,
          test: result.test,
        } as any,
      });
      await syncOrderLoyaltyFromMoysklad(input.id).catch(err => {
        console.error("loyalty sync after payment refresh failed", err);
      });
      return result;
    }),

  createYandexDeliveryOrder: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_delivery");
      const db = getDb();
      await assertYandexDeliverySchemaReady(db);

      const order = await getOrderCoreForYandexDelivery(db, input.id);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Заказ не найден" });
      }

      try {
        const providerResult = await createYandexDeliveryOrderForOrder({
          db,
          orderId: input.id,
          actorUserId: ctx.user?.id ?? null,
        });

        return {
          success: true,
          providerOrderId: providerResult.providerOrderId,
          providerOfferId: providerResult.providerOfferId,
          providerStatus: providerResult.providerStatus,
          deliveryStatus: providerResult.deliveryStatus,
        };
      } catch (error: any) {
        throw error;
      }
    }),

  refreshYandexDeliveryOrder: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_delivery");
      const db = getDb();
      await assertYandexDeliverySchemaReady(db);

      try {
        const result = await refreshYandexDeliveryOrderForOrder({
          db,
          orderId: input.id,
          actorUserId: ctx.user?.id ?? null,
          writeHistory: true,
        });
        return result;
      } catch (error: any) {
        throw error;
      }
    }),

  cancelYandexDeliveryOrder: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_delivery");
      const db = getDb();
      await assertYandexDeliverySchemaReady(db);

      const order = await getOrderCoreForUpdate(db, input.id);
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Заказ не найден" });
      }
      if (!order.deliveryProviderOrderId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "У заказа нет активной заявки Яндекс Доставки.",
        });
      }

      try {
        const providerInfo = await cancelYandexDeliveryProviderOrder(order.deliveryProviderOrderId);
        const providerStatus =
          providerInfo?.status?.full ||
          providerInfo?.status?.simple ||
          "cancelled";
        const localDeliveryStatus = mapYandexDeliveryStatusToLocal(providerStatus);

        await patchOrderYandexDeliveryState(db, input.id, {
          deliveryStatus: localDeliveryStatus,
          deliveryService: "yandex_delivery",
          deliveryProvider: "yandex_delivery",
          deliveryProviderStatus: providerStatus,
          deliveryProviderLastSyncAt: new Date(),
          deliveryProviderError: null,
          deliveryProviderRawJson: providerInfo,
        });

        await safeInsertOrderHistory(db, {
          orderId: input.id,
          userId: ctx.user?.id ?? null,
          actionType: "yandex_delivery_cancelled",
          newValue: {
            provider: "yandex_delivery",
            providerOrderId: order.deliveryProviderOrderId,
            providerStatus,
            deliveryStatus: localDeliveryStatus,
          } as any,
        });

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
            : error?.message || "Не удалось отменить заявку Яндекс Доставки.";
        await patchOrderYandexDeliveryState(db, input.id, {
          deliveryProviderError: message,
          deliveryProviderLastSyncAt: new Date(),
        });
        await safeInsertOrderHistory(db, {
          orderId: input.id,
          userId: ctx.user?.id ?? null,
          actionType: "yandex_delivery_error",
          comment: message,
          newValue: {
            provider: "yandex_delivery",
            action: "cancel",
            providerOrderId: order.deliveryProviderOrderId,
          } as any,
        });
        throw error;
      }
    }),

  updateOrderDelivery: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        deliveryStatus: z.string().trim().min(2),
        deliveryService: z.string().trim().optional(),
        deliveryTrackNumber: z.string().trim().optional(),
        deliveryPrice: z.number().int().min(0).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_delivery");
      const db = getDb();
      const capabilities = await getOrderDbCapabilities(db);
      const existing = [await getOrderCoreForUpdate(db, input.id)].filter(Boolean);
      if (!existing[0]) throw new Error("Заказ не найден");
      if (
        existing[0].deliveryType !== "delivery" &&
        input.deliveryStatus !== "not_required"
      ) {
        await safeInsertOrderHistory(db, {
          orderId: input.id,
          userId: ctx.user?.id ?? null,
          actionType: "delivery_update_skipped_not_required",
          newValue: input as any,
          comment:
            "Доставка для заказа не требуется: попытка обновления delivery-статуса пропущена.",
        });
        return {
          success: true,
          ok: true,
          compatibilityMode: "legacy" as const,
          warning:
            "Для заказа с самовывозом статус доставки не применяется. Обновление пропущено.",
        };
      }
      ensureTransition(
        DELIVERY_STATUS_FLOW,
        existing[0].deliveryStatus,
        input.deliveryStatus,
        "доставки"
      );
      let mutationResponse:
        | { success: true; ok: true; compatibilityMode: "modern" | "legacy"; warning?: string }
        | { success: true } = { success: true };
      if (canUseModernOrderDeliverySchema(capabilities)) {
        await db
          .update(orders)
          .set({
            deliveryStatus: input.deliveryStatus,
            deliveryService: input.deliveryService,
            deliveryTrackNumber: input.deliveryTrackNumber,
            deliveryPrice: input.deliveryPrice,
            updatedAt: new Date(),
          } as any)
          .where(eq(orders.id, input.id));
        mutationResponse = { success: true, ok: true, compatibilityMode: "modern" as const };
      } else {
        await safeInsertOrderHistory(db, {
          orderId: input.id,
          userId: ctx.user?.id ?? null,
          actionType: "delivery_update_skipped_legacy",
          newValue: input as any,
          comment:
            "Доставочные поля не сохранены: в legacy-схеме отсутствуют delivery_status/service/track/price.",
        });
        mutationResponse = {
          success: true,
          ok: true,
          compatibilityMode: "legacy" as const,
          warning:
            "Delivery status fields are not available in legacy database schema",
        };
      }
      await safeInsertOrderHistory(db, {
        orderId: input.id,
        userId: ctx.user?.id ?? null,
        actionType: "delivery_updated",
        newValue: input as any,
      });
      if (
        existing[0].customerEmail &&
        existing[0].orderNumber &&
        (input.deliveryStatus === "handed_to_delivery" ||
          input.deliveryStatus === "in_delivery")
      ) {
        await sendOrderNotificationEmail({
          email: existing[0].customerEmail,
          orderNumber: existing[0].orderNumber,
          eventType: "delivery_handed",
          data: {
            customerName: existing[0]?.customerName,
            deliveryStatus: input.deliveryStatus,
            deliveryService: input.deliveryService || existing[0]?.deliveryService,
            trackingNumber:
              input.deliveryTrackNumber || existing[0]?.deliveryTrackNumber,
            deliveryPrice:
              input.deliveryPrice ?? existing[0]?.deliveryPrice ?? null,
            deliveryAddress: existing[0]?.address ?? null,
            orderUrl: ACCOUNT_ORDERS_URL,
          },
          message: `Заказ ${existing[0].orderNumber} передан в доставку.`,
        }).catch(err => {
          console.error("delivery_handed email failed", err);
        });
      }
      return mutationResponse;
    }),

  updateOrderItemQuantity: protectedProcedure
    .input(
      z.object({
        orderId: z.number(),
        itemId: z.number(),
        quantity: z.number().int().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_item");
      const db = getDb();
      const item = [await getOrderItemCoreForUpdate(db, input.orderId, input.itemId)].filter(Boolean);
      if (!item[0]) throw new Error("Позиция заказа не найдена");

      const nextTotal = item[0].price * input.quantity - (item[0].discount ?? 0);
      try {
        await db
          .update(orderItems)
          .set({
            quantity: input.quantity,
            total: nextTotal,
          })
          .where(eq(orderItems.id, input.itemId));

        const totals = await db
          .select({
            subtotal: sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.quantity}), 0)`,
            discountTotal: sql<number>`coalesce(sum(${orderItems.discount}), 0)`,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, input.orderId));
        const subtotal = totals[0]?.subtotal ?? 0;
        const discountTotal = totals[0]?.discountTotal ?? 0;
        const orderRow = await db
          .select({ deliveryPrice: orders.deliveryPrice })
          .from(orders)
          .where(eq(orders.id, input.orderId))
          .limit(1);
        const deliveryPrice = orderRow[0]?.deliveryPrice ?? 0;
        const totalPrice = subtotal - discountTotal + deliveryPrice;

        await db
          .update(orders)
          .set({ subtotal, discountTotal, totalPrice, updatedAt: new Date() })
          .where(eq(orders.id, input.orderId));
      } catch (err) {
        console.error("updateOrderItemQuantity full flow failed, trying legacy", err);
        await db.execute(
          sql`UPDATE order_items SET quantity = ${input.quantity} WHERE id = ${input.itemId} AND order_id = ${input.orderId}`
        );
        await db.execute(sql`
          UPDATE orders
          SET total_price = (
            SELECT COALESCE(SUM(oi.price * oi.quantity), 0)
            FROM order_items oi
            WHERE oi.order_id = ${input.orderId}
          )
          WHERE id = ${input.orderId}
        `);
      }

      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "order_item_quantity_updated",
        oldValue: { itemId: input.itemId, quantity: item[0].quantity } as any,
        newValue: { itemId: input.itemId, quantity: input.quantity } as any,
      });
      return { success: true };
    }),

  removeOrderItem: protectedProcedure
    .input(z.object({ orderId: z.number(), itemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "remove_item");
      const db = getDb();
      await db
        .delete(orderItems)
        .where(and(eq(orderItems.id, input.itemId), eq(orderItems.orderId, input.orderId)));
      try {
        const totals = await db
          .select({
            subtotal: sql<number>`coalesce(sum(${orderItems.price} * ${orderItems.quantity}), 0)`,
            discountTotal: sql<number>`coalesce(sum(${orderItems.discount}), 0)`,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, input.orderId));
        const subtotal = totals[0]?.subtotal ?? 0;
        const discountTotal = totals[0]?.discountTotal ?? 0;
        await db
          .update(orders)
          .set({
            subtotal,
            discountTotal,
            totalPrice: subtotal - discountTotal,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, input.orderId));
      } catch (err) {
        console.error("removeOrderItem totals update failed, trying legacy", err);
        await db.execute(sql`
          UPDATE orders
          SET total_price = (
            SELECT COALESCE(SUM(oi.price * oi.quantity), 0)
            FROM order_items oi
            WHERE oi.order_id = ${input.orderId}
          )
          WHERE id = ${input.orderId}
        `);
      }
      await safeInsertOrderHistory(db, {
        orderId: input.orderId,
        userId: ctx.user?.id ?? null,
        actionType: "order_item_removed",
        newValue: { itemId: input.itemId } as any,
      });
      return { success: true };
    }),

  bulkUpdateOrderStatus: protectedProcedure
    .input(
      z.object({
        orderIds: z.array(z.number()).min(1),
        status: z.string().trim().min(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      requireAbility(ctx, "update", "Order");
      ensureOrderOperationAllowedByRole(ctx.user?.role, "update_status", {
        nextStatus: input.status,
      });
      const db = getDb();
      const targetOrders = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          moyskladOrderId: orders.moyskladOrderId,
          moyskladOrderHref: orders.moyskladOrderHref,
        })
        .from(orders)
        .where(inArray(orders.id, input.orderIds));

      for (const order of targetOrders) {
        assertOrderStatusEditableLocally(order);
      }

      for (const order of targetOrders) {
        ensureTransition(ORDER_STATUS_FLOW, order.status, input.status, "заказа");
      }

      try {
        await db
          .update(orders)
          .set({ status: input.status, updatedAt: new Date() })
          .where(inArray(orders.id, input.orderIds));
      } catch (err) {
        console.error("bulk status update with updatedAt failed, trying legacy", err);
        await db.execute(
          sql`UPDATE orders SET status = ${input.status} WHERE id IN (${sql.join(
            input.orderIds.map(id => sql`${id}`),
            sql`,`
          )})`
        );
      }

      for (const order of targetOrders) {
        await safeInsertOrderHistory(db, {
          orderId: order.id,
          userId: ctx.user?.id ?? null,
          actionType: "bulk_status_changed",
          oldValue: { status: order.status } as any,
          newValue: { status: input.status } as any,
        });
      }

      return { success: true, updated: targetOrders.length };
    }),

  exportOrdersCsv: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const { rows, compatibilityMode, compatibilityWarnings } = await loadOrdersForExport(
        db,
        input
      );

      return {
        filename: `orders-export-${new Date().toISOString().slice(0, 10)}.csv`,
        contentType: "text/csv; charset=utf-8",
        csv: buildOrdersCsv(rows as Record<string, unknown>[]),
        count: rows.length,
        compatibilityMode,
        compatibilityWarnings,
      };
    }),

  exportOrdersXlsx: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          statuses: z.array(z.string()).optional(),
          paymentStatuses: z.array(z.string()).optional(),
          deliveryTypes: z.array(z.string()).optional(),
          dateFrom: z.coerce.date().optional(),
          dateTo: z.coerce.date().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      requireAbility(ctx, "read", "Order");
      const db = getDb();
      const { rows, compatibilityMode, compatibilityWarnings } = await loadOrdersForExport(
        db,
        input
      );
      const table = buildOrdersExportTable(rows as Record<string, unknown>[]);

      const ws = XLSX.utils.json_to_sheet(table);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Заказы");
      const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

      return {
        filename: `orders-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        base64: Buffer.from(buf).toString("base64"),
        count: rows.length,
        compatibilityMode,
        compatibilityWarnings,
      };
    }),

  deleteOrder: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const [existing] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, input.id))
        .limit(1);

      if (!existing) {
        throw new Error("Заказ не найден.");
      }

      await db.delete(orderComments).where(eq(orderComments.orderId, input.id));
      await db.delete(orderHistory).where(eq(orderHistory.orderId, input.id));
      await db.delete(orderItems).where(eq(orderItems.orderId, input.id));
      await db.delete(orders).where(eq(orders.id, input.id));

      return {
        success: true,
        deletedOrderId: input.id,
        orderNumber: existing.orderNumber || `#${input.id}`,
      };
    }),
});
