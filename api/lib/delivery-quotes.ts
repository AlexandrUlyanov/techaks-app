import { createHash, randomUUID } from "node:crypto";

import { and, eq, lt } from "drizzle-orm";

import { deliveryQuotes } from "@db/schema";
import { getDb } from "../queries/connection";

const DELIVERY_QUOTE_TTL_MS = 10 * 60_000;

export type DeliveryQuoteCartItem = {
  productId: number;
  variantId: number | null;
  quantity: number;
  price: number;
};

function normalizeAddress(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function buildDeliveryCartFingerprint(params: {
  items: DeliveryQuoteCartItem[];
  sourceStoreId: number;
  destinationAddress: string;
}) {
  const items = [...params.items]
    .map(item => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      price: item.price,
    }))
    .sort((left, right) =>
      `${left.productId}:${left.variantId ?? 0}`.localeCompare(
        `${right.productId}:${right.variantId ?? 0}`,
      ),
    );

  return createHash("sha256")
    .update(
      JSON.stringify({
        items,
        sourceStoreId: params.sourceStoreId,
        destinationAddress: normalizeAddress(params.destinationAddress),
      }),
    )
    .digest("hex");
}

export async function persistDeliveryQuote(params: {
  db?: ReturnType<typeof getDb>;
  userId?: number | null;
  items: DeliveryQuoteCartItem[];
  sourceStore: { id: number; name: string; address: string };
  destinationAddress: string;
  destinationCoordinates?: [number, number] | null;
  providerOfferId?: string | null;
  price: number;
  currency?: string | null;
  etaMinutes?: number | null;
  raw?: unknown;
}) {
  const db = params.db ?? getDb();
  const publicId = randomUUID();
  const expiresAt = new Date(Date.now() + DELIVERY_QUOTE_TTL_MS);
  const cartFingerprint = buildDeliveryCartFingerprint({
    items: params.items,
    sourceStoreId: params.sourceStore.id,
    destinationAddress: params.destinationAddress,
  });

  await db.insert(deliveryQuotes).values({
    publicId,
    userId: params.userId ?? null,
    cartFingerprint,
    sourceStoreId: params.sourceStore.id,
    sourceStoreName: params.sourceStore.name,
    sourceAddress: params.sourceStore.address,
    destinationAddress: params.destinationAddress,
    destinationCoordinates: params.destinationCoordinates ?? null,
    providerOfferId: params.providerOfferId ?? null,
    price: Math.max(0, Math.round(params.price)),
    currency: params.currency || "RUB",
    etaMinutes: params.etaMinutes ?? null,
    rawJson: params.raw ?? null,
    expiresAt,
  });

  return { publicId, expiresAt, cartFingerprint };
}

export async function getValidDeliveryQuote(params: {
  db?: ReturnType<typeof getDb>;
  publicId: string;
  items: DeliveryQuoteCartItem[];
  sourceStoreId: number;
  destinationAddress: string;
}) {
  const db = params.db ?? getDb();
  const [quote] = await db
    .select()
    .from(deliveryQuotes)
    .where(
      and(
        eq(deliveryQuotes.publicId, params.publicId),
        eq(deliveryQuotes.status, "active"),
      ),
    )
    .limit(1);

  if (!quote || quote.expiresAt.getTime() <= Date.now()) return null;

  const expectedFingerprint = buildDeliveryCartFingerprint({
    items: params.items,
    sourceStoreId: params.sourceStoreId,
    destinationAddress: params.destinationAddress,
  });

  return quote.cartFingerprint === expectedFingerprint ? quote : null;
}

export async function consumeDeliveryQuote(params: {
  db: any;
  publicId: string;
  orderId: number;
}) {
  const result = await params.db
    .update(deliveryQuotes)
    .set({
      status: "consumed",
      orderId: params.orderId,
      consumedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(deliveryQuotes.publicId, params.publicId),
        eq(deliveryQuotes.status, "active"),
      ),
    );

  const affectedRows = Number((result as any)?.[0]?.affectedRows ?? 0);
  if (affectedRows !== 1) {
    throw new Error("Котировка доставки уже использована. Рассчитайте доставку заново.");
  }
}

export async function expireDeliveryQuotes(db = getDb()) {
  const result = await db
    .update(deliveryQuotes)
    .set({ status: "expired", updatedAt: new Date() })
    .where(
      and(
        eq(deliveryQuotes.status, "active"),
        lt(deliveryQuotes.expiresAt, new Date()),
      ),
    );

  return Number((result as any)?.[0]?.affectedRows ?? 0);
}
