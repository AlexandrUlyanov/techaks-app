import { useParams, Link } from "react-router";
import { Star, CheckCircle, MessageCircle, ArrowLeft } from "lucide-react";
import { products } from "@/data/products";
import ProductCard from "@/components/ProductCard";
import LeadForm from "@/components/LeadForm";
import { useState } from "react";

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = products.find((p) => p.id === id);
  const [showForm, setShowForm] = useState(false);

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#0a0a0a]">Товар не найден</h1>
          <Link to="/catalog" className="mt-4 inline-flex items-center gap-2 text-[#007c91] hover:underline">
            <ArrowLeft size={16} />
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = products
    .filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id)
    .slice(0, 4);

  const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      {/* Breadcrumbs */}
      <section className="bg-gray-50 py-4 border-b border-gray-200">
        <div className="container-main">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/catalog" className="hover:text-[#0a0a0a] transition-colors">Каталог</Link>
            <span>/</span>
            <Link to={`/catalog?cat=${product.categorySlug}`} className="hover:text-[#0a0a0a] transition-colors">
              {product.category}
            </Link>
            <span>/</span>
            <span className="text-[#0a0a0a]">{product.name}</span>
          </div>
        </div>
      </section>

      {/* Product Detail */}
      <section className="py-12">
        <div className="container-main">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Gallery */}
            <div className="lg:w-[45%]">
              <div className="bg-gray-50 rounded-xl p-8 flex items-center justify-center">
                <img
                  src={product.image}
                  alt={product.name}
                  className="max-h-[360px] object-contain"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <span className="text-xs font-semibold uppercase text-[#007c91] tracking-wide">
                {product.category}
              </span>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold text-[#0a0a0a]">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="mt-3 flex items-center gap-3">
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={i < Math.round(product.rating) ? "fill-[#facc15] text-[#facc15]" : "text-gray-200"}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium text-[#0a0a0a]">{product.rating}</span>
                <span className="text-sm text-gray-400">({product.reviewCount} отзывов)</span>
              </div>

              {/* Price */}
              <div className="mt-6 flex items-center gap-4">
                <span className="text-2xl md:text-3xl font-bold text-[#0a0a0a]">
                  {formatPrice(product.price)}
                </span>
                {product.oldPrice && (
                  <>
                    <span className="text-lg text-gray-400 line-through">
                      {formatPrice(product.oldPrice)}
                    </span>
                    <span className="px-2.5 py-1 bg-[#dcfce7] text-[#166534] text-xs font-medium rounded-md">
                      Экономия {formatPrice(product.oldPrice - product.price)}
                    </span>
                  </>
                )}
              </div>

              {/* Stock */}
              <div className="mt-4 flex items-center gap-2">
                <CheckCircle size={16} className="text-[#22c55e]" />
                <span className="text-sm font-medium text-gray-600">
                  В наличии в обоих магазинах
                </span>
              </div>

              {/* Description */}
              <p className="mt-6 text-base text-gray-600 leading-relaxed">
                {product.description}
              </p>

              {/* Specs */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-[#0a0a0a] mb-4">Характеристики</h3>
                <div className="border-t border-gray-200">
                  {Object.entries(product.specs).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between py-3 border-b border-gray-200"
                    >
                      <span className="text-sm text-gray-500">{key}</span>
                      <span className="text-sm font-medium text-[#0a0a0a]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => setShowForm(true)}
                  className="px-8 py-3.5 bg-[#00bcd4] text-white rounded-lg text-sm font-semibold hover:bg-[#0097a7] transition-colors"
                  style={{ boxShadow: "0 2px 8px rgba(0,188,212,0.35)" }}
                >
                  Узнать наличие
                </button>
                <a
                  href="https://t.me/tech_aks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-8 py-3.5 border border-gray-200 rounded-lg text-sm font-semibold hover:border-[#00bcd4] hover:text-[#007c91] transition-colors"
                >
                  <MessageCircle size={16} />
                  Задать вопрос
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-[#0a0a0a]"
            >
              ✕
            </button>
            <LeadForm
              title={`Заявка на «${product.name}»`}
              subtitle="Оставьте контакты — мы проверим наличие и свяжемся с вами"
              type="availability"
              source="product"
              buttonText="Узнать наличие"
            />
          </div>
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="container-main">
            <h2 className="text-2xl md:text-3xl font-bold text-[#0a0a0a]">
              Похожие товары
            </h2>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
