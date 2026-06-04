const METRIKA_ID = 109574553;
const CURRENCY = "RUB";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    dataLayer?: Array<Record<string, unknown>>;
  }
}

type EcommerceItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
  item_variant?: string;
};

function ensureDataLayer() {
  if (typeof window === "undefined") return null;
  window.dataLayer = window.dataLayer || [];
  return window.dataLayer;
}

function pushEvent(event: string, ecommerce: Record<string, unknown>, extra?: Record<string, unknown>) {
  const dataLayer = ensureDataLayer();
  if (!dataLayer) return;
  dataLayer.push({
    event,
    ecommerce,
    ...extra,
  });
}

export function reachYandexGoal(goal: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.ym !== "function") return;
  window.ym(METRIKA_ID, "reachGoal", goal, params || {});
}

export function trackViewItem(input: {
  itemId: string;
  name: string;
  price: number;
  brand?: string | null;
  category?: string | null;
  variant?: string | null;
}) {
  const item: EcommerceItem = {
    item_id: input.itemId,
    item_name: input.name,
    price: input.price,
    item_brand: input.brand || undefined,
    item_category: input.category || undefined,
    item_variant: input.variant || undefined,
  };

  pushEvent("view_item", {
    currencyCode: CURRENCY,
    detail: {
      products: [item],
    },
  });
  reachYandexGoal("view_item", { item_id: input.itemId });
}

export function trackAddToCart(input: {
  itemId: string;
  name: string;
  price: number;
  quantity?: number;
  brand?: string | null;
  category?: string | null;
  variant?: string | null;
}) {
  const item: EcommerceItem = {
    item_id: input.itemId,
    item_name: input.name,
    price: input.price,
    quantity: input.quantity ?? 1,
    item_brand: input.brand || undefined,
    item_category: input.category || undefined,
    item_variant: input.variant || undefined,
  };

  pushEvent("add_to_cart", {
    currencyCode: CURRENCY,
    add: {
      products: [item],
    },
  });
  reachYandexGoal("add_to_cart", { item_id: input.itemId });
}

export function trackBeginCheckout(
  items: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    brand?: string | null;
    category?: string | null;
    variant?: string | null;
  }>
) {
  if (items.length === 0) return;
  const products = items.map(item => ({
    item_id: item.itemId,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
    item_brand: item.brand || undefined,
    item_category: item.category || undefined,
    item_variant: item.variant || undefined,
  }));

  pushEvent("begin_checkout", {
    currencyCode: CURRENCY,
    checkout: {
      products,
    },
  });
  reachYandexGoal("begin_checkout", { items: items.length });
}

export function trackReserveItem(input: {
  itemId: string;
  name: string;
  storeName?: string | null;
  variant?: string | null;
}) {
  pushEvent("reserve_item", {
    reserve: {
      products: [
        {
          item_id: input.itemId,
          item_name: input.name,
          item_variant: input.variant || undefined,
          store_name: input.storeName || undefined,
        },
      ],
    },
  });
  reachYandexGoal("reserve_item", {
    item_id: input.itemId,
    store_name: input.storeName || undefined,
  });
}

export function trackPurchase(input: {
  orderId: string;
  revenue: number;
  items: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
    brand?: string | null;
    category?: string | null;
    variant?: string | null;
  }>;
}) {
  const products = input.items.map(item => ({
    item_id: item.itemId,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity,
    item_brand: item.brand || undefined,
    item_category: item.category || undefined,
    item_variant: item.variant || undefined,
  }));

  pushEvent("purchase", {
    currencyCode: CURRENCY,
    purchase: {
      actionField: {
        id: input.orderId,
        revenue: input.revenue,
      },
      products,
    },
  });
  reachYandexGoal("payment_success", {
    order_id: input.orderId,
    revenue: input.revenue,
  });
}

export function trackLeadSubmit(input: {
  formType: string;
  source?: string | null;
}) {
  pushEvent("generate_lead", {
    lead: {
      form_type: input.formType,
      source: input.source || undefined,
    },
  });
  reachYandexGoal("lead_submit", {
    form_type: input.formType,
    source: input.source || undefined,
  });
}

export function trackOrderMessage(input: {
  orderId: string;
}) {
  pushEvent("order_message", {
    message: {
      order_id: input.orderId,
    },
  });
  reachYandexGoal("order_message", {
    order_id: input.orderId,
  });
}
