import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";
import { Label } from "@/components/ui/label";

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") || "all";
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: products = [], isLoading } = trpc.product.getByCategory.useQuery(
    { categorySlug: activeCategory },
    { placeholderData: (prev) => prev }
  );

  const sortedProducts = useMemo(() => {
    let result = [...products];
    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }
    return result;
  }, [products, sortBy]);

  const activeCategoryName = useMemo(() => {
    if (activeCategory === "all") return "Все";
    return categories.find(c => c.slug === activeCategory)?.name || "Каталог";
  }, [categories, activeCategory]);

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Header Info & Sort */}
      <section className="pt-12 pb-8 border-b border-border">
        <div className="container-main flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">Категория</span>
            <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
              {activeCategoryName} <span className="text-muted-foreground/30">ТОВАРОВ</span>
            </h1>
          </div>
          
          <div className="min-w-[240px]">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">Сортировка</Label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-5 h-12 bg-muted/50 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-foreground outline-none focus:border-[#05C3D4] appearance-none cursor-pointer transition-all"
            >
              <option value="default">По популярности</option>
              <option value="price-asc">Цена: по возрастанию</option>
              <option value="price-desc">Цена: по убыванию</option>
            </select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-16">
        <div className="container-main">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white/5 border border-white/5 rounded-2xl h-[400px] animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {sortedProducts.map((product) => (
                  <ProductCard key={product.id} product={product as any} />
                ))}
              </div>
              {sortedProducts.length === 0 && (
                <div className="text-center py-24">
                  <p className="text-xl font-black uppercase font-heading text-white/10 tracking-widest">Товары в этой категории скоро появятся</p>
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
