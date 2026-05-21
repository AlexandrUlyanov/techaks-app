import {
  categories,
  productReservations,
  productStocks,
  products,
  stores,
} from "@db/schema";
import * as schema from "@db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import { getMerchandisingDisabledBadges } from "./merchandising-score";
import { filterDisabledMerchandisingBadges } from "@/lib/merchandising-badges";
import { getStorefrontBadgeLabels } from "./merchandising-ai-badges";

export const publicProductVisibilityCondition =
  buildPublicProductVisibilityCondition();

export const publicActiveReservedQtySql = sql<number>`coalesce((
  select sum(${productReservations.quantity})
  from ${productReservations}
  inner join ${stores} reserved_stores on reserved_stores.id = ${productReservations.storeId}
  where ${productReservations.productId} = ${products.id}
    and ${productReservations.status} = 'active'
    and ${productReservations.reservedUntil} > now()
), 0)`;

export const publicAvailableStockQtySql = sql<number>`greatest(
  coalesce((
    select sum(${productStocks.quantity})
    from ${productStocks}
    inner join ${stores} stock_stores on stock_stores.id = ${productStocks.storeId}
    where ${productStocks.productId} = ${products.id}
  ), 0) - ${publicActiveReservedQtySql},
  0
)`;

export const productSelectFields = {
  id: products.id,
  msId: products.msId,
  slug: products.slug,
  name: products.name,
  categoryId: products.categoryId,
  price: products.price,
  isActive: products.isActive,
  isAutoBlocked: products.isAutoBlocked,
  autoBlockReason: products.autoBlockReason,
  oldPrice: products.oldPrice,
  badge: products.badge,
  image: products.image,
  imageVariants: products.imageVariants,
  images: products.images,
  description: products.description,
  specs: products.specs,
  inStock: products.inStock,
  rating: products.rating,
  reviewCount: products.reviewCount,
  createdAt: products.createdAt,
  categoryName: categories.name,
  merchandisingBadges: schema.productMerchandising.badges,
};

export const publicProductSelectFields = {
  ...productSelectFields,
  inStock: sql<boolean>`${publicAvailableStockQtySql} > 0`,
};

export async function attachVisibleMerchandisingBadges<
  T extends { merchandisingBadges?: unknown }
>(rows: T[]) {
  const disabledBadges = await getMerchandisingDisabledBadges();
  const rowIds = rows
    .map(row => {
      const candidate = row as T & { id?: unknown };
      return typeof candidate.id === "number" ? candidate.id : null;
    })
    .filter((id): id is number => typeof id === "number");
  const aiBadgeMap = await getStorefrontBadgeLabels(rowIds);
  return rows.map(row => ({
    ...row,
    merchandisingBadges: Array.from(
      new Set([
        ...filterDisabledMerchandisingBadges(
          row.merchandisingBadges,
          disabledBadges
        ),
        ...(() => {
          const candidate = row as T & { id?: unknown };
          return typeof candidate.id === "number"
            ? aiBadgeMap.get(candidate.id) ?? []
            : [];
        })(),
      ])
    ),
  }));
}

export async function listHomepageFallbackProducts(limit = 12) {
  const db = getDb();
  const rows = await db
    .select(publicProductSelectFields)
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(
      schema.productMerchandising,
      eq(schema.productMerchandising.productId, products.id)
    )
    .where(publicProductVisibilityCondition)
    .orderBy(
      desc(sql<boolean>`${publicAvailableStockQtySql} > 0`),
      desc(products.createdAt),
      desc(products.id)
    )
    .limit(limit);

  return attachVisibleMerchandisingBadges(rows);
}
