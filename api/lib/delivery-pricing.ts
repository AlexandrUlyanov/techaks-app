export type DeliveryPricingPolicy = {
  markupPercent: number;
  markupFixed: number;
  subsidyFixed: number;
  freeDeliveryThreshold: number;
  minCustomerPrice: number;
  maxCustomerPrice: number;
};

export type DeliveryPricingResult = {
  providerPrice: number;
  customerPrice: number;
  discount: number;
  isFree: boolean;
  policy: DeliveryPricingPolicy;
};

function money(value: number) {
  return Math.max(0, Math.round(Number.isFinite(value) ? value : 0));
}

export function calculateCustomerDeliveryPrice(params: {
  providerPrice: number;
  orderSubtotal: number;
  policy: DeliveryPricingPolicy;
}): DeliveryPricingResult {
  const providerPrice = money(params.providerPrice);
  const orderSubtotal = money(params.orderSubtotal);
  const policy = {
    markupPercent: Math.max(0, params.policy.markupPercent || 0),
    markupFixed: money(params.policy.markupFixed),
    subsidyFixed: money(params.policy.subsidyFixed),
    freeDeliveryThreshold: money(params.policy.freeDeliveryThreshold),
    minCustomerPrice: money(params.policy.minCustomerPrice),
    maxCustomerPrice: money(params.policy.maxCustomerPrice),
  };

  const isFree =
    policy.freeDeliveryThreshold > 0 &&
    orderSubtotal >= policy.freeDeliveryThreshold;
  if (isFree) {
    return {
      providerPrice,
      customerPrice: 0,
      discount: providerPrice,
      isFree: true,
      policy,
    };
  }

  const markedUp =
    providerPrice * (1 + policy.markupPercent / 100) + policy.markupFixed;
  let customerPrice = money(markedUp - policy.subsidyFixed);
  if (policy.minCustomerPrice > 0) {
    customerPrice = Math.max(customerPrice, policy.minCustomerPrice);
  }
  if (policy.maxCustomerPrice > 0) {
    customerPrice = Math.min(customerPrice, policy.maxCustomerPrice);
  }

  return {
    providerPrice,
    customerPrice,
    discount: Math.max(0, providerPrice - customerPrice),
    isFree: false,
    policy,
  };
}
