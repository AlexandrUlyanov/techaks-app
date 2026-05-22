import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";

function normalizeItems(
  items: Array<{ id: number; variantId?: number | null; quantity: number }>
) {
  return items
    .map(item => ({
      productId: item.id,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
    }))
    .sort(
      (a, b) =>
        a.productId - b.productId ||
        Number(a.variantId ?? 0) - Number(b.variantId ?? 0)
    );
}

function cartItemsEqual(
  left: Array<{
    id: number;
    cartKey: string;
    variantId?: number | null;
    variantName?: string | null;
    article?: string | null;
    slug: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }>,
  right: Array<{
    id: number;
    cartKey: string;
    variantId?: number | null;
    variantName?: string | null;
    article?: string | null;
    slug: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }>
) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    return (
      item.id === other.id &&
      item.cartKey === other.cartKey &&
      (item.variantId ?? null) === (other.variantId ?? null) &&
      (item.variantName ?? null) === (other.variantName ?? null) &&
      (item.article ?? null) === (other.article ?? null) &&
      item.slug === other.slug &&
      item.name === other.name &&
      item.image === other.image &&
      item.price === other.price &&
      item.quantity === other.quantity
    );
  });
}

export function useCartAvailability(options?: { enabled?: boolean }) {
  const { items, replaceItems } = useCart();
  const enabled = options?.enabled ?? true;
  const normalizedItems = useMemo(() => normalizeItems(items), [items]);
  const lastAppliedSignatureRef = useRef<string>("");

  const query = trpc.ecommerce.validateCartItems.useQuery(
    { items: normalizedItems },
    {
      enabled: enabled && normalizedItems.length > 0,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (!query.data) return;

    const nextItems = query.data.items;
    const currentSignature = JSON.stringify({
      items: nextItems,
      removedProductIds: query.data.removedProductIds,
    });

    if (currentSignature === lastAppliedSignatureRef.current) return;

    if (!cartItemsEqual(items, nextItems)) {
      replaceItems(nextItems);
    }

    if (query.data.removedProductIds.length > 0 && query.data.message) {
      toast.warning(query.data.message);
    }

    lastAppliedSignatureRef.current = currentSignature;
  }, [items, query.data, replaceItems]);

  return query;
}
