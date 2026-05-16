export const AUTO_BLOCK_REASON_ZERO_PRICE = "zero_price" as const;

export type ProductAutoBlockReason = typeof AUTO_BLOCK_REASON_ZERO_PRICE | string | null;

export type ProductVisibilitySnapshot = {
  price?: unknown;
  isActive?: boolean | null;
  isAutoBlocked?: boolean | null;
  autoBlockReason?: ProductAutoBlockReason;
};

export function getNumericProductPrice(price: unknown) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) ? numericPrice : NaN;
}

export function hasInvalidProductPrice(price: unknown) {
  const numericPrice = getNumericProductPrice(price);
  return !Number.isFinite(numericPrice) || numericPrice <= 0;
}

export function isProductVisibleOnSite(product: ProductVisibilitySnapshot) {
  return (
    product.isActive === true &&
    product.isAutoBlocked !== true &&
    !hasInvalidProductPrice(product.price)
  );
}

export function deriveProductAutoBlockState(
  price: unknown,
  currentReason?: ProductAutoBlockReason,
  currentBlocked?: boolean | null
) {
  if (hasInvalidProductPrice(price)) {
    return {
      isAutoBlocked: true,
      autoBlockReason: AUTO_BLOCK_REASON_ZERO_PRICE,
    };
  }

  if (
    currentReason === AUTO_BLOCK_REASON_ZERO_PRICE ||
    (currentBlocked === true && (!currentReason || currentReason === AUTO_BLOCK_REASON_ZERO_PRICE))
  ) {
    return {
      isAutoBlocked: false,
      autoBlockReason: null,
    };
  }

  return {
    isAutoBlocked: currentBlocked ?? false,
    autoBlockReason: currentReason ?? null,
  };
}

export function applyProductAutoBlockState<T extends ProductVisibilitySnapshot>(product: T) {
  const nextState = deriveProductAutoBlockState(
    product.price,
    product.autoBlockReason,
    product.isAutoBlocked
  );

  return {
    ...product,
    ...nextState,
  };
}

