import { useState, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";
import { CategoryIcon } from "@/lib/category-icons";

export default function CatalogPage() {
  const navigate = useNavigate();
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
    let curr: any = currentCategory;
    while (curr) {
      trail.unshift(curr);
      const pid = curr.parentId;
      curr = categories.find(c => c.id === pid);
    }
    return trail;
  }, [categories, currentCategory, activeCategory]);

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Breadcrumbs */}
      <section className="bg-muted/30 py-4 border-b border-border">
        <div className="container-main">
          <div className="flex items-center flex-wrap gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            <Link to="/catalog?cat=all" className="hover:text-[#05C3D4] transition-colors">
              Каталог
            </Link>
            {breadcrumbs.map(bc => (
              <div key={bc.id} className="flex items-center gap-2">
                <span className="text-muted-foreground/20">/</span>
                <Link 
                  to={`/catalog?cat=${bc.slug}`}
                  className={bc.id === currentCategory?.id ? "text-[#05C3D4]" : "hover:text-[#05C3D4] transition-colors"}
                >
                  {bc.name}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Header Info */}
      <section className="pt-12 pb-8 border-b border-border">
        <div className="container-main">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
            Категория
          </span>
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            {activeCategoryName}
          </h1>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {displayCategories.map(cat => {
                  const subCats = categories.filter(c => c.parentId === cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => navigate(`/catalog?cat=${cat.slug}`)}
                      className="flex flex-col p-6 bg-white/5 border border-border rounded-2xl hover:border-[#05C3D4] hover:bg-white/10 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <CategoryIcon 
                          name={cat.name} 
                          slug={cat.slug} 
                          size={24} 
                          className="text-muted-foreground group-hover:text-[#05C3D4] transition-colors" 
                        />
                        <span className="text-sm font-bold uppercase tracking-wider group-hover:text-[#05C3D4] transition-colors line-clamp-2">
                          {cat.name}
                        </span>
                      </div>
                      
                      {subCats.length > 0 && (
                        <ul className="space-y-2 mt-auto border-t border-white/5 pt-4">
                          {subCats.slice(0, 6).map(sub => (
                            <li key={sub.id}>
                              <Link
                                to={`/catalog?cat=${sub.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-xs font-medium text-muted-foreground hover:text-[#05C3D4] transition-colors flex items-center gap-2"
                              >
                                <span className="w-1 h-1 rounded-full bg-[#05C3D4]/50 shrink-0" />
                                <span className="truncate">{sub.name}</span>
                              </Link>
                            </li>
                          ))}
                          {subCats.length > 6 && (
                            <li className="text-[10px] text-muted-foreground italic mt-2 uppercase tracking-wider">
                              и еще {subCats.length - 6}...
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Products Grid */}
          <div className={displayCategories.length > 0 ? "pt-12 border-t border-border" : ""}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
              <h2 className="text-xl font-black uppercase tracking-widest text-foreground leading-none">
                Товары
              </h2>
              
              <div className="min-w-[240px]">
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
                  {sortedProducts.map((product: any) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {sortedProducts.length === 0 && (
                  <div className="text-center py-24">
                    <p className="text-xl font-black uppercase font-heading text-white/10 tracking-widest">
                      Товары скоро появятся
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
