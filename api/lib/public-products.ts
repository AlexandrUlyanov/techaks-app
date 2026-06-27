import {
  categories,
  productReservations,
  productStocks,
  productVariantStocks,
  productVariants,
  products,
  stores,
} from "@db/schema";
import * as schema from "@db/schema";
import {
  asc,
  desc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import {
  normalizeProductImageVariantSet,
  type ProductImageVariantSet,
} from "@contracts/product-images";
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

export const publicProductHasVariantsSql = sql<boolean>`exists(
  select 1
  from ${productVariants}
  where ${productVariants.productId} = ${products.id}
    and ${productVariants.isActive} = true
)`;

export const publicVariantActiveReservedQtySql = sql<number>`coalesce((
  select sum(${productReservations.quantity})
  from ${productReservations}
  inner join ${productVariants} reserved_variants on reserved_variants.id = ${productReservations.variantId}
  inner join ${stores} reserved_variant_stores on reserved_variant_stores.id = ${productReservations.storeId}
  where reserved_variants.product_id = ${products.id}
    and ${productReservations.status} = 'active'
    and ${productReservations.reservedUntil} > now()
), 0)`;

export const publicProductStockQtySql = sql<number>`coalesce((
  select sum(${productStocks.quantity})
  from ${productStocks}
  inner join ${stores} stock_stores on stock_stores.id = ${productStocks.storeId}
  where ${productStocks.productId} = ${products.id}
), 0)`;

export const publicVariantStockQtySql = sql<number>`coalesce((
  select sum(${productVariantStocks.quantity})
  from ${productVariantStocks}
  inner join ${productVariants} variant_stock_variants on variant_stock_variants.id = ${productVariantStocks.variantId}
  inner join ${stores} variant_stock_stores on variant_stock_stores.id = ${productVariantStocks.storeId}
  where variant_stock_variants.product_id = ${products.id}
    and variant_stock_variants.is_active = true
), 0)`;

export const publicAvailableStockQtySql = sql<number>`case
  when ${publicProductHasVariantsSql} then greatest(
    ${publicVariantStockQtySql} - ${publicVariantActiveReservedQtySql},
    0
  )
  else greatest(
    ${publicProductStockQtySql} - ${publicActiveReservedQtySql},
    0
  )
end`;

export const productSelectFields = {
  id: products.id,
  msId: products.msId,
  externalCode: products.externalCode,
  article: products.article,
  barcode: products.barcode,
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

const MAX_VARIANT_PREVIEW_IMAGES = 8;

function normalizeVariantPreviewImage(
  image: unknown,
  imageVariants: unknown
): ProductImageVariantSet | null {
  const direct = normalizeProductImageVariantSet(
    imageVariants,
    typeof image === "string" ? image : null
  );
  if (direct?.original) return direct;

  if (typeof image === "string" && image.trim()) {
    return normalizeProductImageVariantSet(null, image);
  }

  return null;
}

function getVariantFirstPreviewImage(variant: {
  image?: unknown;
  imageVariants?: unknown;
  images?: unknown;
}): ProductImageVariantSet | null {
  if (Array.isArray(variant.images) && variant.images.length > 0) {
    const firstImage = variant.images[0];
    const fromGallery =
      typeof firstImage === "string"
        ? normalizeProductImageVariantSet(null, firstImage)
        : normalizeProductImageVariantSet(firstImage, null);
    if (fromGallery?.original) return fromGallery;
  }

  return normalizeVariantPreviewImage(variant.image, variant.imageVariants);
}

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
  const variantPreviewMap = new Map<number, ProductImageVariantSet[]>();

  if (rowIds.length > 0) {
    const db = getDb();
    const variantRows = await db
      .select({
        id: productVariants.id,
        productId: productVariants.productId,
        image: productVariants.image,
        imageVariants: productVariants.imageVariants,
        images: productVariants.images,
        price: productVariants.price,
        stock: productVariants.stock,
        isActive: productVariants.isActive,
      })
      .from(productVariants)
      .where(
        inArray(productVariants.productId, rowIds)
      )
      .orderBy(
        asc(productVariants.productId),
        desc(productVariants.isActive),
        desc(sql<boolean>`${productVariants.stock} > 0`),
        asc(productVariants.price),
        asc(productVariants.id)
      );

    for (const variantRow of variantRows) {
      const productId = Number(variantRow.productId ?? 0);
      if (!productId || !variantRow.isActive) continue;

      const image = getVariantFirstPreviewImage(variantRow);
      if (!image?.original) continue;

      const current = variantPreviewMap.get(productId) ?? [];
      if (current.some(item => item.original === image.original)) continue;
      if (current.length >= MAX_VARIANT_PREVIEW_IMAGES) continue;
      current.push(image);
      variantPreviewMap.set(productId, current);
    }
  }

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
    variantPreviewImages: (() => {
      const candidate = row as T & { id?: unknown };
      return typeof candidate.id === "number"
        ? variantPreviewMap.get(candidate.id) ?? []
        : [];
    })(),
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
