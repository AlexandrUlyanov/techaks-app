import { TRPCError } from "@trpc/server";
import {
  productReservations,
  productStocks,
  productVariantStocks,
  productVariants,
  products,
  stores,
  users,
} from "@db/schema";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { getAppSetting } from "./app-settings";
import { isProductVisibleOnSite } from "@contracts/product-visibility";
import { isSoftValidPhone, normalizePhone } from "@contracts/phone";
import { assertProductVariant } from "./product-variants";

export const RESERVATION_STATUS_ACTIVE = "active";
export const RESERVATION_STATUS_EXPIRED = "expired";
export const RESERVATION_STATUS_CANCELLED = "cancelled";
export const RESERVATION_STATUS_CONVERTED = "converted_to_order";
export const RESERVATION_DURATION_SETTING_KEY = "reservation_duration_minutes";
export const DEFAULT_RESERVATION_DURATION_MINUTES = 180;

type DbLike = {
  execute: (...args: any[]) => Promise<any>;
  select: (...args: any[]) => any;
  insert: (...args: any[]) => any;
  update: (...args: any[]) => any;
};

export function getReservationExpiryDate(
  durationMinutes: number,
  now: Date = new Date()
) {
  return new Date(now.getTime() + durationMinutes * 60_000);
}

export async function getReservationDurationMinutes() {
  const raw = await getAppSetting(RESERVATION_DURATION_SETTING_KEY);
  const value = Number(raw ?? DEFAULT_RESERVATION_DURATION_MINUTES);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_RESERVATION_DURATION_MINUTES;
  }
  return Math.max(15, Math.round(value));
}

export async function expireDueReservations(db: DbLike, now: Date = new Date()) {
  await db
    .update(productReservations)
    .set({
      status: RESERVATION_STATUS_EXPIRED,
      updatedAt: now,
    })
    .where(
      and(
        eq(productReservations.status, RESERVATION_STATUS_ACTIVE),
        lte(productReservations.reservedUntil, now)
      )
    );
}

export function assertValidReservationPhone(phone: string | null | undefined) {
  const normalized = normalizePhone(phone);
  if (!isSoftValidPhone(normalized)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Введите корректный телефон.",
    });
  }
  return normalized;
}

export async function getAvailableStock(
  db: DbLike,
  productId: number,
  storeId: number,
  variantId?: number | null,
  now: Date = new Date()
) {
  await expireDueReservations(db, now);

  const rawStockResult = variantId
    ? await db.execute(sql`
        SELECT quantity
        FROM ${productVariantStocks}
        WHERE ${productVariantStocks.variantId} = ${variantId}
          AND ${productVariantStocks.storeId} = ${storeId}
        LIMIT 1
      `)
    : await db.execute(sql`
        SELECT quantity
        FROM ${productStocks}
        WHERE ${productStocks.productId} = ${productId}
          AND ${productStocks.storeId} = ${storeId}
        LIMIT 1
      `);
  const rawStockRows = Array.isArray((rawStockResult as any)?.[0])
    ? (rawStockResult as any)[0]
    : (rawStockResult as any[]);
  const rawStockQty = Number(rawStockRows?.[0]?.quantity ?? 0);

  const reservedResult = variantId
    ? await db.execute(sql`
        SELECT COALESCE(SUM(${productReservations.quantity}), 0) AS reservedQty
        FROM ${productReservations}
        WHERE ${productReservations.productId} = ${productId}
          AND ${productReservations.variantId} = ${variantId}
          AND ${productReservations.storeId} = ${storeId}
          AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
          AND ${productReservations.reservedUntil} > ${now}
      `)
    : await db.execute(sql`
        SELECT COALESCE(SUM(${productReservations.quantity}), 0) AS reservedQty
        FROM ${productReservations}
        WHERE ${productReservations.productId} = ${productId}
          AND ${productReservations.variantId} IS NULL
          AND ${productReservations.storeId} = ${storeId}
          AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
          AND ${productReservations.reservedUntil} > ${now}
      `);
  const reservedRows = Array.isArray((reservedResult as any)?.[0])
    ? (reservedResult as any)[0]
    : (reservedResult as any[]);
  const activeReservedQty = Number(reservedRows?.[0]?.reservedQty ?? 0);

  return {
    rawStockQty,
    activeReservedQty,
    availableQty: Math.max(0, rawStockQty - activeReservedQty),
  };
}

async function getProductHasActiveVariants(db: DbLike, productId: number) {
  const rows = await db.execute(sql`
    SELECT 1
    FROM ${productVariants}
    WHERE ${productVariants.productId} = ${productId}
      AND ${productVariants.isActive} = true
    LIMIT 1
  `);
  const normalizedRows = Array.isArray((rows as any)?.[0]) ? (rows as any)[0] : (rows as any[]);
  return normalizedRows.length > 0;
}

export async function getProductStoreAvailability(
  db: DbLike,
  productId: number,
  variantId?: number | null,
  options: { includeHiddenStores?: boolean } = {}
) {
  const now = new Date();
  await expireDueReservations(db, now);

  const hasVariants = !variantId && (await getProductHasActiveVariants(db, productId));
  const visibleStoreCondition = options.includeHiddenStores
    ? undefined
    : eq(stores.isPublic, true);
  const rows: Array<{
    storeId: number;
    storeName: string;
    storeAddress: string;
    storePhone: string | null;
    storeHours: string | null;
    rawStockQty: number;
  }> =
    variantId
      ? await db
          .select({
            storeId: stores.id,
            storeName: stores.name,
            storeAddress: stores.address,
            storePhone: stores.phone,
            storeHours: stores.hours,
            rawStockQty: sql<number>`COALESCE(SUM(${productVariantStocks.quantity}), 0)`,
          })
          .from(productVariantStocks)
          .innerJoin(stores, eq(productVariantStocks.storeId, stores.id))
          .where(and(eq(productVariantStocks.variantId, variantId), visibleStoreCondition))
          .groupBy(stores.id, stores.name, stores.address, stores.phone, stores.hours)
      : hasVariants
        ? await db
            .select({
              storeId: stores.id,
              storeName: stores.name,
              storeAddress: stores.address,
              storePhone: stores.phone,
              storeHours: stores.hours,
              rawStockQty: sql<number>`COALESCE(SUM(${productVariantStocks.quantity}), 0)`,
            })
            .from(productVariantStocks)
            .innerJoin(productVariants, eq(productVariantStocks.variantId, productVariants.id))
            .innerJoin(stores, eq(productVariantStocks.storeId, stores.id))
            .where(
              and(
                eq(productVariants.productId, productId),
                eq(productVariants.isActive, true),
                visibleStoreCondition
              )
            )
            .groupBy(stores.id, stores.name, stores.address, stores.phone, stores.hours)
        : await db
            .select({
              storeId: stores.id,
              storeName: stores.name,
              storeAddress: stores.address,
              storePhone: stores.phone,
              storeHours: stores.hours,
              rawStockQty: sql<number>`COALESCE(SUM(${productStocks.quantity}), 0)`,
            })
            .from(productStocks)
            .innerJoin(stores, eq(productStocks.storeId, stores.id))
            .where(and(eq(productStocks.productId, productId), visibleStoreCondition))
            .groupBy(stores.id, stores.name, stores.address, stores.phone, stores.hours);

  if (rows.length === 0) return [];

  const storeIds = rows.map(row => row.storeId);
  const reservedResult =
    variantId
      ? await db.execute(sql`
          SELECT
            ${productReservations.storeId} AS storeId,
            COALESCE(SUM(${productReservations.quantity}), 0) AS reservedQty
          FROM ${productReservations}
          WHERE ${productReservations.productId} = ${productId}
            AND ${productReservations.variantId} = ${variantId}
            AND ${productReservations.storeId} IN (${sql.join(storeIds, sql`, `)})
            AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
            AND ${productReservations.reservedUntil} > ${now}
          GROUP BY ${productReservations.storeId}
        `)
      : hasVariants
        ? await db.execute(sql`
            SELECT
              ${productReservations.storeId} AS storeId,
              COALESCE(SUM(${productReservations.quantity}), 0) AS reservedQty
            FROM ${productReservations}
            INNER JOIN ${productVariants} ON ${productVariants.id} = ${productReservations.variantId}
            WHERE ${productVariants.productId} = ${productId}
              AND ${productReservations.storeId} IN (${sql.join(storeIds, sql`, `)})
              AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
              AND ${productReservations.reservedUntil} > ${now}
            GROUP BY ${productReservations.storeId}
          `)
        : await db.execute(sql`
            SELECT
              ${productReservations.storeId} AS storeId,
              COALESCE(SUM(${productReservations.quantity}), 0) AS reservedQty
            FROM ${productReservations}
            WHERE ${productReservations.productId} = ${productId}
              AND ${productReservations.variantId} IS NULL
              AND ${productReservations.storeId} IN (${sql.join(storeIds, sql`, `)})
              AND ${productReservations.status} = ${RESERVATION_STATUS_ACTIVE}
              AND ${productReservations.reservedUntil} > ${now}
            GROUP BY ${productReservations.storeId}
          `);
  const reservedRows = Array.isArray((reservedResult as any)?.[0])
    ? (reservedResult as any)[0]
    : (reservedResult as any[]);
  const reservedByStore = new Map<number, number>(
    (reservedRows as Array<{ storeId: number; reservedQty: number }>).map(row => [
      Number(row.storeId),
      Number(row.reservedQty ?? 0),
    ])
  );

  return rows.map(row => {
    const rawStockQty = Number(row.rawStockQty ?? 0);
    const activeReservedQty = reservedByStore.get(row.storeId) ?? 0;
    return {
      ...row,
      rawStockQty,
      activeReservedQty,
      availableQty: Math.max(0, rawStockQty - activeReservedQty),
      hasConflict: activeReservedQty > rawStockQty,
    };
  });
}

export async function getProductReservationSummary(db: DbLike, productId: number) {
  const availability = await getProductStoreAvailability(db, productId);
  const totalRawStockQty = availability.reduce(
    (sum: number, row) => sum + row.rawStockQty,
    0
  );
  const totalActiveReservedQty = availability.reduce(
    (sum: number, row) => sum + row.activeReservedQty,
    0
  );
  const totalAvailableQty = availability.reduce(
    (sum: number, row) => sum + row.availableQty,
    0
  );

  return {
    totalRawStockQty,
    totalActiveReservedQty,
    totalAvailableQty,
    stores: availability,
  };
}

export async function assertReservableProduct(
  db: DbLike,
  productId: number
) {
  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      image: products.image,
      price: products.price,
      isActive: products.isActive,
      isAutoBlocked: products.isAutoBlocked,
      autoBlockReason: products.autoBlockReason,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Товар не найден." });
  }

  if (
    !isProductVisibleOnSite({
      price: product.price,
      isActive: product.isActive,
      isAutoBlocked: product.isAutoBlocked,
      autoBlockReason: product.autoBlockReason,
    })
  ) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Товар уже недоступен для резерва.",
    });
  }

  return product;
}

export async function assertReservableProductSelection(
  db: any,
  input: { productId: number; variantId?: number | null }
) {
  const product = await assertReservableProduct(db, input.productId);
  const variant =
    typeof input.variantId === "number" && input.variantId > 0
      ? await assertProductVariant(db, {
          productId: input.productId,
          variantId: input.variantId,
        })
      : null;

  return { product, variant };
}

export async function assertStoreExists(db: DbLike, storeId: number) {
  const [store] = await db
    .select({
      id: stores.id,
      name: stores.name,
      address: stores.address,
      phone: stores.phone,
      hours: stores.hours,
    })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);

  if (!store) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Магазин не найден." });
  }

  return store;
}

export async function backfillUserPhoneIfMissing(
  db: DbLike,
  input: { userId?: number | null; phone?: string | null }
) {
  if (!input.userId || !input.phone) return;

  const [user] = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user || (user.phone && user.phone.trim().length > 0)) return;

  await db
    .update(users)
    .set({ phone: normalizePhone(input.phone) })
    .where(eq(users.id, input.userId));
}

export async function findExistingActiveReservation(
  db: DbLike,
  input: {
    productId: number;
    variantId?: number | null;
    storeId: number;
    userId?: number | null;
    phone: string;
    now?: Date;
  }
) {
  const now = input.now ?? new Date();
  const conditions = [
    eq(productReservations.productId, input.productId),
    eq(productReservations.storeId, input.storeId),
    eq(productReservations.status, RESERVATION_STATUS_ACTIVE),
    sql`${productReservations.reservedUntil} > ${now}`,
  ];

  if (typeof input.variantId === "number") {
    conditions.push(eq(productReservations.variantId, input.variantId));
  } else {
    conditions.push(sql`${productReservations.variantId} IS NULL`);
  }

  if (input.userId) {
    conditions.push(
      or(
        eq(productReservations.userId, input.userId),
        eq(productReservations.phone, input.phone)
      ) as any
    );
  } else {
    conditions.push(eq(productReservations.phone, input.phone));
  }

  const [existing] = await db
    .select()
    .from(productReservations)
    .where(and(...conditions))
    .limit(1);

  return existing ?? null;
}
