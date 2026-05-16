import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";

function normalizeItems(items: Array<{ id: number; quantity: number }>) {
  return items
    .map(item => ({
      productId: item.id,
      quantity: item.quantity,
    }))
    .sort((a, b) => a.productId - b.productId);
}

function cartItemsEqual(
  left: Array<{
    id: number;
    slug: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }>,
  right: Array<{
    id: number;
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
