import type { CartItem } from "@/hooks/use-cart";
import { buildCartKey } from "@/hooks/use-cart";

const CHECKOUT_ORDER_PREFIX = "techaks:checkout-order:";

type StoredCheckoutSnapshot = {
  orderId: number;
  createdAt: string;
  cartKeys: string[];
};

function getStorageKey(orderId: number) {
  return `${CHECKOUT_ORDER_PREFIX}${orderId}`;
}

export function storeCheckoutOrderSnapshot(orderId: number, items: CartItem[]) {
  if (typeof window === "undefined" || !Number.isFinite(orderId) || orderId <= 0) {
    return;
  }

  const snapshot: StoredCheckoutSnapshot = {
    orderId,
    createdAt: new Date().toISOString(),
    cartKeys: items.map(item => item.cartKey || buildCartKey(item.id, item.variantId)),
  };

  try {
    window.sessionStorage.setItem(getStorageKey(orderId), JSON.stringify(snapshot));
  } catch {
    // ignore session storage errors
  }
}

export function getCheckoutOrderSnapshot(orderId: number): StoredCheckoutSnapshot | null {
  if (typeof window === "undefined" || !Number.isFinite(orderId) || orderId <= 0) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getStorageKey(orderId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredCheckoutSnapshot>;
    if (
      typeof parsed?.orderId !== "number" ||
      !Array.isArray(parsed?.cartKeys)
    ) {
      return null;
    }

    return {
      orderId: parsed.orderId,
      createdAt:
        typeof parsed.createdAt === "string"
          ? parsed.createdAt
          : new Date().toISOString(),
      cartKeys: parsed.cartKeys.filter(
        (value): value is string => typeof value === "string" && value.length > 0
      ),
    };
  } catch {
    return null;
  }
}

export function clearCheckoutOrderSnapshot(orderId: number) {
  if (typeof window === "undefined" || !Number.isFinite(orderId) || orderId <= 0) {
    return;
  }

  try {
    window.sessionStorage.removeItem(getStorageKey(orderId));
  } catch {
    // ignore session storage errors
  }
}
