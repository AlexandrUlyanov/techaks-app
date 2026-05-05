import { useState, useEffect, useCallback, useMemo } from "react";
import type { Category, CatalogAnalyticsEvent, CatalogEventData } from "@/contracts/catalog.types";

export function useCatalogMenu(initialCategories: Category[]) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(initialCategories[0]?.id || "");
  const [searchTerm, setSearchTerm] = useState("");
  const [mobilePath, setMobilePath] = useState<string[]>([]); // Array of category IDs

  const activeCategory = useMemo(() => 
    initialCategories.find(c => c.id === activeCategoryId) || initialCategories[0],
    [activeCategoryId, initialCategories]
  );

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setMobilePath([]);
    setSearchTerm("");
  }, []);

  const track = useCallback((event: CatalogAnalyticsEvent, data: Partial<CatalogEventData> = {}) => {
    console.log(`[Analytics] ${event}`, {
      ...data,
      timestamp: Date.now(),
      source: window.innerWidth < 1280 ? "mobile" : "desktop"
    });
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      track("catalog_open");
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen, close, track]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results: any[] = [];
    
    initialCategories.forEach(cat => {
      if (cat.title.toLowerCase().includes(term)) results.push({ ...cat, type: "category" });
      cat.children?.forEach(group => {
        if (group.title.toLowerCase().includes(term)) results.push({ ...group, type: "group", parentHref: cat.href });
        group.items?.forEach(item => {
          if (item.title.toLowerCase().includes(term)) results.push({ ...item, type: "item" });
        });
      });
    });
    return results.slice(0, 10);
  }, [searchTerm, initialCategories]);

  return {
    isOpen,
    toggle,
    close,
    activeCategoryId,
    setActiveCategoryId,
    activeCategory,
    searchTerm,
    setSearchTerm,
    filteredCategories,
    mobilePath,
    setMobilePath,
    track
  };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    if (media.matches !== matches) setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [matches, query]);

  return matches;
}

export function useBodyScrollLock(lock: boolean) {
  useEffect(() => {
    if (lock) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = originalStyle; };
    }
  }, [lock]);
}
