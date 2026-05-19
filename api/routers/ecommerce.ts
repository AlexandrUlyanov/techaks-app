import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { adminProcedure, createRouter, publicQuery, protectedProcedure, requireAbility } from "../middleware";
import { getDb } from "../queries/connection";
import { users, orders, orderItems, orderComments, orderHistory, products, productReviewRequests, stores, productReservations, productStocks } from "@db/schema";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import * as XLSX from "xlsx";
import { env } from "../lib/env";
import { sendOrderNotificationEmail, sendReviewRequestEmail } from "../lib/mail";
import { isProductVisibleOnSite } from "@contracts/product-visibility";
import { ensureReviewRequestRowsForOrder } from "../lib/product-reviews";
import {
  assertReservableProduct,
  assertStoreExists,
  assertValidReservationPhone,
  backfillUserPhoneIfMissing,
  DEFAULT_RESERVATION_DURATION_MINUTES,
  expireDueReservations,
  findExistingActiveReservation,
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

const PUBLIC_SITE_URL = env.isProduction ? "https://techaks.ru" : "http://localhost:5173";
const ACCOUNT_ORDERS_URL = `${PUBLIC_SITE_URL}/account`;
const PLACEHOLDER_EMAIL_DOMAIN = "@placeholder.techaks.ru";

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
        totalPrice: orders.totalPrice,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        deliveryStatus: orders.deliveryStatus,
        deliveryType: orders.deliveryType,
        deliveryService: orders.deliveryService,
        deliveryTrackNumber: orders.deliveryTrackNumber,
        deliveryPrice: orders.deliveryPrice,
        address: orders.address,
        paymentType: orders.paymentType,
        paymentMethod: orders.paymentMethod,
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
        total_price AS totalPrice,
        status,
        payment_status AS paymentStatus,
        CASE
          WHEN delivery_type = 'delivery' THEN 'awaiting_processing'
          ELSE 'not_required'
        END AS deliveryStatus,
        delivery_type AS deliveryType,
        NULL AS deliveryService,
        NULL AS deliveryTrackNumber,
        0 AS deliveryPrice,
        address,
        payment_type AS paymentType,
        payment_type AS paymentMethod,
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
  quantity: number;
};

async function resolvePurchasableCartItems(
  db: ReturnType<typeof getDb>,
  inputItems: RequestedCartItem[]
) {
  const requestedProductIds = Array.from(
    new Set(inputItems.map(item => item.productId))
  );

  if (requestedProductIds.length === 0) {
    return {
      purchasableItems: [] as Array<{
        productId: number;
        quantity: number;
        name: string;
        slug: string;
        image: string;
        price: number;
      }>,
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
  const removedProductIds = new Set<number>();
  const purchasableItems: Array<{
    productId: number;
    quantity: number;
    name: string;
    slug: string;
    image: string;
    price: number;
  }> = [];

  for (const item of inputItems) {
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
      continue;
    }

    purchasableItems.push({
      productId: product.id,
      quantity: item.quantity,
      name: product.name,
      slug: product.slug,
      image: product.image,
      price: Number(product.price),
    });
  }

  return {
    purchasableItems,
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

async function createSingleItemOrder(
  db: ReturnType<typeof getDb>,
  input: {
    userId: number | null;
    product: { id: number; name: string; image: string; price: number };
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
    productName: input.product.name,
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

        const product = await assertReservableProduct(tx, input.productId);
        const store = await assertStoreExists(tx, input.storeId);

        const existing = await findExistingActiveReservation(tx, {
          productId: input.productId,
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

        const stockLockResult = await tx.execute(sql`
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

        const activeReservationsResult = await tx.execute(sql`
          SELECT ${productReservations.id}, ${productReservations.quantity}
          FROM ${productReservations}
          WHERE ${productReservations.productId} = ${input.productId}
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
            price: Number(product.price),
          },
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
      const product = await assertReservableProduct(db, input.productId);
      const availability = await getProductStoreAvailability(db, input.productId);
      const availableStores = availability.filter(
        (row: (typeof availability)[number]) => row.availableQty >= input.quantity
      );

      const resolvedStoreId =
        typeof input.storeId === "number" && input.storeId > 0
          ? input.storeId
          : availableStores.length === 1
            ? availableStores[0].storeId
            : null;

      if (!resolvedStoreId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Выберите магазин, в котором хотите оформить товар.",
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
          price: Number(product.price),
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
          quantity: input.quantity,
        } as any,
        comment: "Быстрый заказ создан через кнопку «Купить в 1 клик».",
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
          storeName: stores.name,
          storeAddress: stores.address,
        })
        .from(productReservations)
        .innerJoin(products, eq(productReservations.productId, products.id))
        .innerJoin(stores, eq(productReservations.storeId, stores.id))
        .where(whereClause)
        .orderBy(desc(productReservations.createdAt));

      return rows;
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

      const product = await assertReservableProduct(db, reservation.productId);
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
          price: Number(product.price),
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
        } as any,
        comment: "Заказ оформлен из активного резерва.",
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
            quantity: z.number().min(1),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();
      const { purchasableItems, removedProductIds } = await resolvePurchasableCartItems(
        db,
        input.items
      );

      return {
        items: purchasableItems.map(item => ({
          id: item.productId,
          slug: item.slug,
          name: item.name,
          image: item.image,
          price: item.price,
          quantity: item.quantity,
        })),
        removedProductIds,
        message:
          removedProductIds.length > 0
            ? "Некоторые товары стали недоступны и были удалены из корзины."
            : null,
      };
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
            quantity: z.number().min(1),
            price: z.number(),
          })
        ),
        deliveryType: z.enum(["pickup", "delivery"]),
        address: z.string().optional().nullable(),
        paymentType: z.enum(["cash", "card", "sbp"]),
        totalPrice: z.number(),
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
          quantity: item.quantity,
        }))
      );

      if (purchasableItems.length !== input.items.length || removedProductIds.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Некоторые товары стали недоступны и были удалены из корзины.",
        });
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

      // 2. Create order
      let newOrder;
      if (canUseModernOrderInsertSchema(capabilities)) {
        newOrder = await db.insert(orders).values({
          userId,
          orderNumber,
          customerName: normalizedFullName,
          customerPhone: normalizedPhone,
          customerEmail: contactEmail,
          source: "site",
          totalPrice: trustedTotal,
          subtotal: trustedTotal,
          paidAmount: 0,
          deliveryType: input.deliveryType,
          address: input.address,
          deliveryStatus:
            input.deliveryType === "pickup" ? "not_required" : "awaiting_processing",
          paymentType: input.paymentType,
          paymentMethod: input.paymentType,
          status: "pending",
        });
      } else {
        // Fallback for partially migrated DBs (legacy orders schema with fewer columns).
        const legacyInsertResult = await db.execute(sql`
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
            ${trustedTotal},
            ${input.deliveryType},
            ${input.address},
            ${input.paymentType},
            ${"unpaid"},
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
      const orderId = newOrder[0].insertId;

      // 3. Create order items
      for (const item of purchasableItems) {
        if (canUseModernOrderInsertSchema(capabilities)) {
          await db.insert(orderItems).values({
            orderId,
            productId: item.productId,
            total: item.price * item.quantity,
            quantity: item.quantity,
            price: item.price,
          });
        } else {
          await db.execute(sql`
            INSERT INTO order_items (
              order_id,
              product_id,
              quantity,
              price
            ) VALUES (
              ${orderId},
              ${item.productId},
            ${item.quantity},
            ${item.price}
          )
        `);
        }
      }

      // 4. (Optional) Trigger Telegram Notification to Admin
      // This will be added in a separate utility
      if (contactEmail) {
        await sendOrderNotificationEmail({
          email: contactEmail,
          orderNumber,
          eventType: "order_created",
          data: {
            customerName: normalizedFullName,
            customerEmail: contactEmail,
            customerPhone: normalizedPhone,
            orderDate: new Date(),
            orderStatus: "pending",
            paymentMethod: input.paymentType,
            paymentStatus: "unpaid",
            deliveryMethod: input.deliveryType,
            deliveryAddress:
              input.deliveryType === "delivery"
                ? input.address
                : "Самовывоз из магазина",
            subtotal: trustedTotal,
            totalAmount: trustedTotal,
            orderUrl: ACCOUNT_ORDERS_URL,
            items: purchasableItems.map(item => {
              return {
                title: item.name,
                quantity: item.quantity,
                price: item.price,
                total: item.price * item.quantity,
              };
            }),
          },
          message:
            "Заказ создан и передан в обработку. Если потребуется уточнение, мы свяжемся с вами отдельно.",
        }).catch(err => {
          console.error("order_created email failed", err);
        });
      }

      return { success: true, orderId };
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
            paymentError: orders.paymentError,
            paidAt: orders.paidAt,
            deliveryType: orders.deliveryType,
            deliveryService: orders.deliveryService,
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
          NULL AS paymentError,
          NULL AS paidAt,
          o.delivery_type AS deliveryType,
          NULL AS deliveryService,
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
        const orderRows = await db
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
            deliveryType: orders.deliveryType,
            deliveryService: orders.deliveryService,
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

        const items = await db
          .select({
            id: orderItems.id,
            orderId: orderItems.orderId,
            productId: orderItems.productId,
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
          o.delivery_type AS deliveryType,
          NULL AS deliveryService,
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

      return {
        ...mapLegacyOrderDetailsRow(legacyOrderRows[0]),
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
      return { success: true };
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
          status: orders.status,
        })
        .from(orders)
        .where(inArray(orders.id, input.orderIds));

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
