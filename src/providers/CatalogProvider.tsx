import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type {
  Category,
  CatalogAnalyticsEvent,
  CatalogEventData,
  CategoryItem,
} from "@/contracts/catalog.types";
import { trpc } from "@/providers/trpc";

interface CatalogContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
  catalogCategories: Category[];
  isLoading: boolean;
  activeCategoryId: string;
  setActiveCategoryId: (id: string) => void;
  activeCategory: Category | undefined;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredCategories: any[];
  mobilePath: string[];
  setMobilePath: React.Dispatch<React.SetStateAction<string[]>>;
  track: (
    event: CatalogAnalyticsEvent,
    data?: Partial<CatalogEventData>
  ) => void;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const {
    data: dbCategories = [],
    isLoading,
    refetch: refetchCategories,
  } =
    trpc.product.getCategories.useQuery(undefined, {
      staleTime: 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    });
  const [isOpen, setIsOpen] = useState(false);
  const { data: manufacturerEntries = [] } = trpc.manufacturer.getAll.useQuery(
    {
      onlyVisible: true,
      withProductsOnly: true,
    },
    {
      enabled: isOpen,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );
  const topLevelCategorySlugs = useMemo(
    () =>
      dbCategories
        .filter(category => category.parentId === null)
        .map(category => category.slug),
    [dbCategories]
  );
  const shouldLoadCatalogBrands = isOpen && topLevelCategorySlugs.length > 0;
  const { data: brandsByCategory = {} } = trpc.manufacturer.getByCategories.useQuery(
    {
      categorySlugs: topLevelCategorySlugs,
      limit: 24,
    },
    {
      enabled: shouldLoadCatalogBrands,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobilePath, setMobilePath] = useState<string[]>([]);

  const catalogCategories = useMemo<Category[]>(() => {
    const byParent = new Map<number | null, typeof dbCategories>();
    dbCategories.forEach(category => {
      const key = category.parentId ?? null;
      const siblings = byParent.get(key) ?? [];
      siblings.push(category);
      byParent.set(key, siblings);
    });

    byParent.forEach(siblings => {
      siblings.sort((a, b) => {
        const orderDiff = a.sortOrder - b.sortOrder;
        return orderDiff || a.name.localeCompare(b.name, "ru");
      });
    });

    const toItem = (category: (typeof dbCategories)[number]): CategoryItem => ({
      id: String(category.id),
      title: category.name,
      href: `/catalog?cat=${category.slug}`,
    });

    const collectDescendants = (parentId: number): CategoryItem[] => {
      const children = byParent.get(parentId) ?? [];
      return children.flatMap(child => [
        toItem(child),
        ...collectDescendants(child.id),
      ]);
    };

    return (byParent.get(null) ?? []).map(category => {
      const children = (byParent.get(category.id) ?? []).map(group => ({
        id: String(group.id),
        title: group.name,
        href: `/catalog?cat=${group.slug}`,
        items: collectDescendants(group.id),
      }));

      return {
        id: String(category.id),
        title: category.name,
        slug: category.slug,
        icon: category.icon ?? undefined,
        href: `/catalog?cat=${category.slug}`,
        children,
        brands: (brandsByCategory[category.slug] ?? manufacturerEntries.slice(0, 20))
          .map((manufacturer: any) => ({
            ...(function () {
              const sourceKey = manufacturer.sourceNormalizedKey ?? "производитель";
              const normalizedName = manufacturer.normalizedName ?? "";
              const params = new URLSearchParams({ cat: category.slug, show: "products" });
              if (normalizedName) {
                params.append("filter", `${sourceKey}:${normalizedName}`);
              }
              return {
                href: `/catalog?${params.toString()}`,
                normalizedName,
                sourceNormalizedKey: sourceKey,
              };
            })(),
            id: String(manufacturer.id),
            title: manufacturer.title ?? manufacturer.name,
            logo: (manufacturer.logo ?? manufacturer.logoUrl) ?? undefined,
          }))
          .filter(brand => Boolean(brand.logo)),
      };
    });
  }, [brandsByCategory, dbCategories, manufacturerEntries]);

  useEffect(() => {
    if (!activeCategoryId && catalogCategories[0]) {
      setActiveCategoryId(catalogCategories[0].id);
      return;
    }
    if (
      activeCategoryId &&
      catalogCategories.length > 0 &&
      !catalogCategories.some(category => category.id === activeCategoryId)
    ) {
      setActiveCategoryId(catalogCategories[0].id);
    }
  }, [activeCategoryId, catalogCategories]);

  const activeCategory = useMemo(
    () => catalogCategories.find(c => c.id === activeCategoryId),
    [activeCategoryId, catalogCategories]
  );

  const toggle = useCallback(() => {
    setIsOpen(prev => {
      const next = !prev;
      if (next) {
        void refetchCategories();
      }
      return next;
    });
  }, [refetchCategories]);
  const close = useCallback(() => {
    setIsOpen(false);
    setMobilePath([]);
    setSearchTerm("");
  }, []);
  const open = useCallback(() => {
    setIsOpen(true);
    void refetchCategories();
  }, [refetchCategories]);

  const track = useCallback(
    (event: CatalogAnalyticsEvent, data: Partial<CatalogEventData> = {}) => {
      console.log(`[Catalog Analytics] ${event}`, data);
    },
    []
  );

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results: any[] = [];

    catalogCategories.forEach(cat => {
      if (cat.title.toLowerCase().includes(term))
        results.push({ ...cat, type: "Категория" });
      cat.children?.forEach(group => {
        if (group.title.toLowerCase().includes(term))
          results.push({ ...group, type: "Раздел", parentHref: cat.href });
        group.items?.forEach(item => {
          if (item.title.toLowerCase().includes(term))
            results.push({ ...item, type: "Товар" });
        });
      });
    });
    return results.slice(0, 10);
  }, [catalogCategories, searchTerm]);

  return (
    <CatalogContext.Provider
      value={{
        isOpen,
        toggle,
        close,
        open,
        catalogCategories,
        isLoading,
        activeCategoryId,
        setActiveCategoryId,
        activeCategory,
        searchTerm,
        setSearchTerm,
        filteredCategories,
        mobilePath,
        setMobilePath,
        track,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (context === undefined)
    throw new Error("useCatalog must be used within CatalogProvider");
  return context;
}
