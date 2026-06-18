import { create } from "zustand";
import { persist } from "zustand/middleware";
import { trackAddToCart } from "@/lib/yandex-metrika";

export interface CartItem {
  cartKey: string;
  id: number;
  variantId?: number | null;
  variantName?: string | null;
  article?: string | null;
  slug: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}

const CART_STORAGE_KEY = "techaks-cart";

export function buildCartKey(productId: number, variantId?: number | null) {
  return `${productId}:${typeof variantId === "number" ? variantId : 0}`;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity" | "cartKey">) => void;
  removeItem: (cartKey: string) => void;
  removeItems: (cartKeys: string[]) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  replaceItems: (items: CartItem[]) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getItemCount: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: product => {
        const currentItems = get().items;
        const cartKey = buildCartKey(product.id, product.variantId);
        const existingItem = currentItems.find(item => item.cartKey === cartKey);

        if (existingItem) {
          set({
            items: currentItems.map(item =>
              item.cartKey === cartKey
                ? { ...item, quantity: item.quantity + 1 }
                : item
            ),
          });
        } else {
          set({ items: [...currentItems, { ...product, cartKey, quantity: 1 }] });
        }

        trackAddToCart({
          itemId: String(product.variantId ?? product.id),
          name: product.name,
          price: product.price,
          quantity: 1,
          variant: product.variantName ?? null,
        });
      },
      removeItem: cartKey => {
        set({
          items: get().items.filter(item => item.cartKey !== cartKey),
        });
      },
      removeItems: cartKeys => {
        if (!Array.isArray(cartKeys) || cartKeys.length === 0) return;
        const keys = new Set(cartKeys);
        set({
          items: get().items.filter(item => !keys.has(item.cartKey)),
        });
      },
      updateQuantity: (cartKey, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartKey);
          return;
        }
        set({
          items: get().items.map(item =>
            item.cartKey === cartKey ? { ...item, quantity } : item
          ),
        });
      },
      replaceItems: items =>
        set({
          items: items.map(item => ({
            ...item,
            cartKey: item.cartKey || buildCartKey(item.id, item.variantId),
          })),
        }),
      clearCart: () => {
        set({ items: [] });
        if (typeof window !== "undefined") {
          try {
            window.localStorage.removeItem(CART_STORAGE_KEY);
          } catch {
            // ignore storage cleanup errors; in-memory state is already empty
          }
        }
      },
      getTotalPrice: () => {
        return get().items.reduce(
          (total, item) => total + item.price * item.quantity,
          0
        );
      },
      getItemCount: () => {
        return get().items.reduce((count, item) => count + item.quantity, 0);
      },
    }),
    {
      name: CART_STORAGE_KEY,
      version: 2,
      migrate: (persistedState: any) => {
        const items = Array.isArray(persistedState?.items)
          ? persistedState.items.map((item: any) => ({
              ...item,
              cartKey:
                item?.cartKey ||
                buildCartKey(Number(item?.id ?? 0), item?.variantId ?? null),
              variantId:
                typeof item?.variantId === "number" ? item.variantId : null,
              variantName:
                typeof item?.variantName === "string" ? item.variantName : null,
              article: typeof item?.article === "string" ? item.article : null,
            }))
          : [];

        return {
          ...persistedState,
          items,
        };
      },
    }
  )
);
