export type DeliveryPackageDefaults = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type DeliveryPackageSourceItem = {
  productId: number;
  variantId?: number | null;
  name: string;
  quantity: number;
  price: number;
};

export type DeliveryPackageItem = {
  id: string;
  title: string;
  quantity: number;
  cost: number;
  weightKg: number;
  lengthM: number;
  widthM: number;
  heightM: number;
};

export type DeliveryPackageSnapshot = {
  version: 1;
  items: DeliveryPackageItem[];
  totalWeightGrams: number;
  defaults: DeliveryPackageDefaults;
};

function positive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function buildDeliveryPackageSnapshot(
  sourceItems: DeliveryPackageSourceItem[],
  defaults: DeliveryPackageDefaults,
): DeliveryPackageSnapshot {
  const normalizedDefaults = {
    weightGrams: positive(defaults.weightGrams, 500),
    lengthCm: positive(defaults.lengthCm, 20),
    widthCm: positive(defaults.widthCm, 15),
    heightCm: positive(defaults.heightCm, 10),
  };

  const items = sourceItems.map(item => {
    const quantity = Math.max(1, Math.round(item.quantity));
    return {
      id: `product-${item.productId}${item.variantId ? `-variant-${item.variantId}` : ""}`,
      title: item.name.trim().slice(0, 128) || `Товар ${item.productId}`,
      quantity,
      cost: Math.max(0, Math.round(item.price)),
      weightKg: normalizedDefaults.weightGrams / 1000,
      lengthM: normalizedDefaults.lengthCm / 100,
      widthM: normalizedDefaults.widthCm / 100,
      heightM: normalizedDefaults.heightCm / 100,
    };
  });

  return {
    version: 1,
    items,
    totalWeightGrams: items.reduce(
      (sum, item) => sum + Math.round(item.weightKg * 1000) * item.quantity,
      0,
    ),
    defaults: normalizedDefaults,
  };
}
