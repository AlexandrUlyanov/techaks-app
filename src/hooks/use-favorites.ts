import { useCallback, useEffect, useMemo, useRef } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";

type FavoriteProductMeta = {
  id: number;
  name: string;
};

type FavoritesStore = {
  guestIds: number[];
  serverIds: number[];
  mergedGuestUserId: number | null;
  setGuestIds: (ids: number[]) => void;
  setServerIds: (ids: number[]) => void;
  setMergedGuestUserId: (userId: number | null) => void;
  clearGuestIds: () => void;
};

const normalizeIds = (ids: number[]) =>
  Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));

const useFavoritesStore = create<FavoritesStore>()(
  persist(
    set => ({
      guestIds: [],
      serverIds: [],
      mergedGuestUserId: null,
      setGuestIds: ids => set({ guestIds: normalizeIds(ids) }),
      setServerIds: ids => set({ serverIds: normalizeIds(ids) }),
      setMergedGuestUserId: userId => set({ mergedGuestUserId: userId }),
      clearGuestIds: () => set({ guestIds: [] }),
    }),
    {
      name: "techaks-favorites",
      version: 1,
    }
  )
);

export function useFavoritesSyncBootstrap() {
  const { isAuthenticated, user } = useAuth();
  const guestIds = useFavoritesStore(state => state.guestIds);
  const mergedGuestUserId = useFavoritesStore(state => state.mergedGuestUserId);
  const setServerIds = useFavoritesStore(state => state.setServerIds);
  const clearGuestIds = useFavoritesStore(state => state.clearGuestIds);
  const setMergedGuestUserId = useFavoritesStore(state => state.setMergedGuestUserId);
  const syncAttemptRef = useRef<number | null>(null);

  const favoritesQuery = trpc.user.getFavoriteIds.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 60_000,
  });

  const syncFavorites = trpc.user.syncFavorites.useMutation({
    onSuccess: result => {
      setServerIds(result.productIds);
      clearGuestIds();
      if (user?.id) {
        setMergedGuestUserId(user.id);
        syncAttemptRef.current = user.id;
      }
    },
    onError: error => {
      toast.error(error.message || "Не удалось синхронизировать избранное");
    },
  });

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      setServerIds([]);
      setMergedGuestUserId(null);
      syncAttemptRef.current = null;
      return;
    }

    if (!favoritesQuery.data) return;

    if (
      guestIds.length > 0 &&
      mergedGuestUserId !== user.id &&
      syncAttemptRef.current !== user.id &&
      !syncFavorites.isPending
    ) {
      syncAttemptRef.current = user.id;
      syncFavorites.mutate({ productIds: guestIds });
      return;
    }

    setServerIds(favoritesQuery.data);

    if (guestIds.length === 0 && mergedGuestUserId !== user.id) {
      setMergedGuestUserId(user.id);
    }
  }, [
    clearGuestIds,
    favoritesQuery.data,
    guestIds,
    isAuthenticated,
    mergedGuestUserId,
    setMergedGuestUserId,
    setServerIds,
    syncFavorites,
    user?.id,
  ]);
}

export function useFavorites() {
  const utils = trpc.useUtils();
  const { isAuthenticated } = useAuth();
  const guestIds = useFavoritesStore(state => state.guestIds);
  const serverIds = useFavoritesStore(state => state.serverIds);
  const setGuestIds = useFavoritesStore(state => state.setGuestIds);
  const setServerIds = useFavoritesStore(state => state.setServerIds);

  const favoriteIds = isAuthenticated ? serverIds : guestIds;
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const setFavoriteMutation = trpc.user.setFavorite.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.user.getFavoriteIds.invalidate(),
        utils.user.getFavorites.invalidate(),
      ]);
    },
  });

  const setFavorite = useCallback(
    (product: FavoriteProductMeta, nextValue: boolean) => {
      if (isAuthenticated) {
        const previousIds = serverIds;
        const nextIds = nextValue
          ? normalizeIds([...previousIds, product.id])
          : previousIds.filter(id => id !== product.id);

        setServerIds(nextIds);

        setFavoriteMutation.mutate(
          { productId: product.id, isFavorite: nextValue },
          {
            onSuccess: () => {
              toast.success(
                nextValue
                  ? `«${product.name}» добавлен в избранное`
                  : `«${product.name}» убран из избранного`
              );
            },
            onError: error => {
              setServerIds(previousIds);
              toast.error(error.message || "Не удалось обновить избранное");
            },
          }
        );
        return;
      }

      const previousIds = guestIds;
      const nextIds = nextValue
        ? normalizeIds([...previousIds, product.id])
        : previousIds.filter(id => id !== product.id);

      setGuestIds(nextIds);
      toast.success(
        nextValue
          ? `«${product.name}» добавлен в избранное`
          : `«${product.name}» убран из избранного`
      );
    },
    [
      guestIds,
      isAuthenticated,
      serverIds,
      setFavoriteMutation,
      setGuestIds,
      setServerIds,
    ]
  );

  const toggleFavorite = useCallback(
    (product: FavoriteProductMeta) => {
      setFavorite(product, !favoriteSet.has(product.id));
    },
    [favoriteSet, setFavorite]
  );

  return {
    favoriteIds,
    favoriteCount: favoriteIds.length,
    isFavorite: (productId: number) => favoriteSet.has(productId),
    setFavorite,
    toggleFavorite,
  };
}
