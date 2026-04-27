import { useState, useMemo } from "react";
import { useSearchParams } from "react-router";
import ProductCard from "@/components/ProductCard";
import { products, categories } from "@/data/products";

export default function CatalogPage() {
  const [searchParams] = useSearchParams();
  const initialCat = searchParams.get("cat") || "all";
  const [activeCategory, setActiveCategory] = useState(initialCat);
  const [sortBy, setSortBy] = useState<"default" | "price-asc" | "price-desc">("default");

  const filteredProducts = useMemo(() => {
    let result = activeCategory === "all"
      ? products
      : products.filter((p) => p.categorySlug === activeCategory);

    if (sortBy === "price-asc") {
      result = [...result].sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-desc") {
      result = [...result].sort((a, b) => b.price - a.price);
    }

    return result;
  }, [activeCategory, sortBy]);

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Hero */}
      <section className="bg-gray-50 py-12">
        <div className="container-main text-center">
          <h1 className="text-3xl md:text-5xl font-extrabold text-[#0a0a0a]">
            Каталог товаров
          </h1>
          <p className="mt-3 text-base text-gray-600">
            Смартфоны, наушники, зарядка, аксессуары, гаджеты для дома и ПК
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="bg-white border-b border-gray-200 py-5 sticky top-16 z-30">
        <div className="container-main flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat.slug
                    ? "bg-[#00bcd4] text-white"
                    : "border border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <div className="ml-auto">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 outline-none focus:border-[#00bcd4]"
            >
              <option value="default">По умолчанию</option>
              <option value="price-asc">Цена: по возрастанию</option>
              <option value="price-desc">Цена: по убыванию</option>
            </select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container-main">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-lg text-gray-400">Товары в этой категории скоро появятся</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
