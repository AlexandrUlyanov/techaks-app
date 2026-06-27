import { TRPCError } from "@trpc/server";
import {
  productVariantStocks,
  productVariants,
} from "@db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

export type ProductVariantAttributes = Record<string, string>;

export function normalizeVariantAttributes(value: unknown): ProductVariantAttributes {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([key, rawValue]) => {
      const normalizedValue =
        rawValue == null
          ? ""
          : typeof rawValue === "string"
            ? rawValue.trim()
            : String(rawValue).trim();

      return key.trim() && normalizedValue ? [[key.trim(), normalizedValue]] : [];
    })
  );
}

export async function getProductVariants(db: ReturnType<typeof getDb>, productId: number) {
  const rows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      msId: productVariants.msId,
      externalCode: productVariants.externalCode,
      name: productVariants.name,
      article: productVariants.article,
      image: productVariants.image,
      imageVariants: productVariants.imageVariants,
      images: productVariants.images,
      price: productVariants.price,
      oldPrice: productVariants.oldPrice,
      stock: productVariants.stock,
      attributesJson: productVariants.attributesJson,
      isActive: productVariants.isActive,
      lastSyncedAt: productVariants.lastSyncedAt,
      createdAt: productVariants.createdAt,
      updatedAt: productVariants.updatedAt,
    })
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(
      desc(productVariants.isActive),
      desc(sql<boolean>`${productVariants.stock} > 0`),
      asc(productVariants.price),
      asc(productVariants.id)
    );

  return rows.map(row => ({
    ...row,
    price: Number(row.price ?? 0),
    oldPrice: row.oldPrice == null ? null : Number(row.oldPrice),
    stock: Number(row.stock ?? 0),
    attributes: normalizeVariantAttributes(row.attributesJson),
  }));
}

export async function assertProductVariant(
  db: ReturnType<typeof getDb>,
  input: { productId: number; variantId: number }
) {
  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      msId: productVariants.msId,
      externalCode: productVariants.externalCode,
      name: productVariants.name,
      article: productVariants.article,
      image: productVariants.image,
      imageVariants: productVariants.imageVariants,
      images: productVariants.images,
      price: productVariants.price,
      oldPrice: productVariants.oldPrice,
      stock: productVariants.stock,
      attributesJson: productVariants.attributesJson,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.id, input.variantId),
        eq(productVariants.productId, input.productId)
      )
    )
    .limit(1);

  if (!variant) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Модификация товара не найдена.",
    });
  }

  if (!variant.isActive || Number(variant.price ?? 0) <= 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Выбранный вариант товара недоступен.",
    });
  }

  return {
    ...variant,
    price: Number(variant.price ?? 0),
    oldPrice: variant.oldPrice == null ? null : Number(variant.oldPrice),
    stock: Number(variant.stock ?? 0),
    attributes: normalizeVariantAttributes(variant.attributesJson),
  };
}

export async function getVariantStoreStock(
  db: ReturnType<typeof getDb>,
  input: { variantId: number; storeId: number }
) {
  const [row] = await db
    .select({
      quantity: productVariantStocks.quantity,
    })
    .from(productVariantStocks)
    .where(
      and(
        eq(productVariantStocks.variantId, input.variantId),
        eq(productVariantStocks.storeId, input.storeId)
      )
    )
    .limit(1);

  return Number(row?.quantity ?? 0);
}
