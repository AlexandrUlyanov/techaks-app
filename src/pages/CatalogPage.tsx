import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const initialCat = searchParams.get("cat") || "all";
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: products = [], isLoading } = trpc.product.getByCategory.useQuery({ 
    categorySlug: activeCategory 
  });

  const sortedProducts = useMemo(() => {
    let result = [...products];

    if (sortBy === "price-asc") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => b.price - a.price);
    }

    return result;
  }, [products, sortBy]);

  const allCategories = useMemo(() => [
    { slug: "all", name: "Все" },
    ...categories
  ], [categories]);

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Hero */}
      <section className="relative py-20 overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[100px] rounded-full" />
        <div className="container-main relative z-10">
          <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4 block">Витрина</span>
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            КАТЕГОРИГ <span className="text-muted-foreground/30">ТОВАРОВ</span>
          </h1>
          <p className="mt-6 text-base text-muted-foreground max-w-[500px] font-medium leading-relaxed">
            Смартфоны, наушники, зарядка и аксессуары. Помогаем подобрать под вашу модель.
          </p>
        </div>

      </section>

      {/* Filters */}
      <section className="bg-[#15171A]/80 backdrop-blur-md border-b border-white/5 py-6 sticky top-20 z-30">
        <div className="container-main flex flex-wrap items-center gap-6">
          <div className="flex flex-wrap gap-2">
            {allCategories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeCategory === cat.slug
                    ? "bg-[#05C3D4] text-black glow-cyan"
                    : "bg-white/5 text-white/40 border border-white/5 hover:bg-white/10 hover:text-white"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="ml-auto min-w-[200px]">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-5 h-11 bg-white/5 border border-white/10 rounded-xl text-[11px] font-black uppercase tracking-widest text-white outline-none focus:border-[#05C3D4] appearance-none cursor-pointer"
            >
              <option value="default">По умолчанию</option>
              <option value="price-asc">Цена: по возрастанию</option>
              <option value="price-desc">Цена: по убыванию</option>
            </select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-20">
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
