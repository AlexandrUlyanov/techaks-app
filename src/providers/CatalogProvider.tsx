import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import type { Category, CatalogAnalyticsEvent, CatalogEventData } from "@/contracts/catalog.types";
import { catalogData } from "@/contracts/catalog.data";

interface CatalogContextType {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
  open: () => void;
  activeCategoryId: string;
  setActiveCategoryId: (id: string) => void;
  activeCategory: Category | undefined;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredCategories: any[];
  mobilePath: string[];
  setMobilePath: React.Dispatch<React.SetStateAction<string[]>>;
  track: (event: CatalogAnalyticsEvent, data?: Partial<CatalogEventData>) => void;
}

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string>(catalogData[0].id);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobilePath, setMobilePath] = useState<string[]>([]);

  const activeCategory = useMemo(() => 
    catalogData.find(c => c.id === activeCategoryId),
    [activeCategoryId]
  );

  const toggle = useCallback(() => setIsOpen(v => !v), []);
  const close = useCallback(() => {
    setIsOpen(false);
    setMobilePath([]);
    setSearchTerm("");
  }, []);
  const open = useCallback(() => setIsOpen(true), []);

  const track = useCallback((event: CatalogAnalyticsEvent, data: Partial<CatalogEventData> = {}) => {
    console.log(`[Catalog Analytics] ${event}`, data);
  }, []);

  const filteredCategories = useMemo(() => {
    if (!searchTerm) return [];
    const term = searchTerm.toLowerCase();
    const results: any[] = [];
    
    catalogData.forEach(cat => {
      if (cat.title.toLowerCase().includes(term)) results.push({ ...cat, type: "Категория" });
      cat.children?.forEach(group => {
        if (group.title.toLowerCase().includes(term)) results.push({ ...group, type: "Раздел", parentHref: cat.href });
        group.items?.forEach(item => {
          if (item.title.toLowerCase().includes(term)) results.push({ ...item, type: "Товар" });
        });
      });
    });
    return results.slice(0, 10);
  }, [searchTerm]);

  return (
    <CatalogContext.Provider value={{
      isOpen, toggle, close, open,
      activeCategoryId, setActiveCategoryId, activeCategory,
      searchTerm, setSearchTerm, filteredCategories,
      mobilePath, setMobilePath, track
    }}>
      {children}
    </CatalogContext.Provider>
  );
}

export function useCatalog() {
  const context = useContext(CatalogContext);
  if (context === undefined) throw new Error("useCatalog must be used within CatalogProvider");
  return context;
}
