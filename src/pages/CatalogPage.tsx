import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";
import { Label } from "@/components/ui/label";
import { FolderTree, ChevronRight } from "lucide-react";

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const activeCategory = searchParams.get("cat") || "all";
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">(
    "default"
  );

  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: products = [], isLoading } =
    trpc.product.getByCategory.useQuery(
      { categorySlug: activeCategory },
      { placeholderData: prev => prev }
    );

  const sortedProducts = useMemo(() => {
    const result = [...products];
    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }
    return result;
  }, [products, sortBy]);

  const currentCategory = useMemo(() => {
    return categories.find(c => c.slug === activeCategory);
  }, [categories, activeCategory]);

  const activeCategoryName = useMemo(() => {
    if (activeCategory === "all") return "Все";
    return currentCategory?.name || "Каталог";
  }, [currentCategory, activeCategory]);

  const displayCategories = useMemo(() => {
    if (activeCategory === "all") {
      return categories.filter(c => !c.parentId);
    }
    if (currentCategory) {
      return categories.filter(c => c.parentId === currentCategory.id);
    }
    return [];
  }, [categories, activeCategory, currentCategory]);

  // Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (activeCategory === "all" || !currentCategory) return [];
    const trail = [];
    let curr = currentCategory;
    while (curr) {
      trail.unshift(curr);
      const pid = curr.parentId;
      curr = categories.find(c => c.id === pid) as any;
    }
    return trail;
  }, [categories, currentCategory, activeCategory]);

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Header Info & Sort */}
      <section className="pt-12 pb-8 border-b border-border">
        <div className="container-main flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div>
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] mb-3 text-muted-foreground">
              <Link to="/catalog?cat=all" className="hover:text-[#05C3D4] transition-colors">
                Каталог
              </Link>
              {breadcrumbs.map(bc => (
                <div key={bc.id} className="flex items-center gap-2">
                  <ChevronRight size={12} />
                  <Link 
                    to={`/catalog?cat=${bc.slug}`}
                    className={bc.id === currentCategory?.id ? "text-[#05C3D4]" : "hover:text-[#05C3D4] transition-colors"}
                  >
                    {bc.name}
                  </Link>
                </div>
              ))}
            </div>
            <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
              {activeCategoryName}
            </h1>
          </div>

          <div className="min-w-[240px]">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1 mb-2 block">
              Сортировка
            </Label>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-5 h-12 bg-muted/50 border border-border rounded-xl text-xs font-black uppercase tracking-widest text-foreground outline-none focus:border-[#05C3D4] appearance-none cursor-pointer transition-all"
            >
              <option value="default">По популярности</option>
              <option value="price-asc">Цена: по возрастанию</option>
              <option value="price-desc">Цена: по убыванию</option>
            </select>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container-main space-y-12">
          
          {/* Categories Grid */}
          {displayCategories.length > 0 && (
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-foreground">
                {activeCategory === "all" ? "Категории" : "Подкатегории"}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {displayCategories.map(cat => (
                  <Link
                    key={cat.id}
                    to={`/catalog?cat=${cat.slug}`}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white/5 border border-border rounded-2xl hover:border-[#05C3D4] hover:bg-white/10 transition-all text-center group"
                  >
                    <FolderTree size={28} className="text-muted-foreground group-hover:text-[#05C3D4] transition-colors" />
                    <span className="text-sm font-bold uppercase tracking-wider line-clamp-2">
                      {cat.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products Grid */}
          {(!displayCategories.length || activeCategory !== "all") && (
            <div>
              <h2 className="text-xl font-black uppercase tracking-widest mb-6 text-foreground">
                Товары
              </h2>
              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/5 border border-white/5 rounded-2xl h-[400px] animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {sortedProducts.map(product => (
                      <ProductCard key={product.id} product={product as any} />
                    ))}
                  </div>
                  {sortedProducts.length === 0 && (
                    <div className="text-center py-24">
                      <p className="text-xl font-black uppercase font-heading text-white/10 tracking-widest">
                        Товары в этой категории скоро появятся
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
