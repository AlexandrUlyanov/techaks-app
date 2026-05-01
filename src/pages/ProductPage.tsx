import { useParams, Link } from "react-router";
import { Star, MessageCircle, ArrowLeft, ShoppingBag } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import LeadForm from "@/components/LeadForm";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  const { id: slug } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);
  const { addItem } = useCart();

  const { data: product, isLoading } = trpc.product.getBySlug.useQuery({ slug: slug || "" });
  const { data: allProducts = [] } = trpc.product.getAll.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Загрузка товара...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Товар не найден</h1>
          <Link to="/catalog" className="mt-4 inline-flex items-center gap-2 text-[#05C3D4] hover:underline">
            <ArrowLeft size={16} />
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = allProducts
    .filter((p) => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 4);

  const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Breadcrumbs */}
      <section className="bg-muted/30 py-4 border-b border-border">
        <div className="container-main">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            <Link to="/catalog" className="hover:text-[#05C3D4] transition-colors">Каталог</Link>
            <span className="text-muted-foreground/20">/</span>
            <span className="text-muted-foreground truncate max-w-[200px]">{product.name}</span>
          </div>
        </div>
      </section>

      {/* Product Detail */}
      <section className="py-12 md:py-20">
        <div className="container-main">
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-20">
            {/* Gallery */}
            <div className="lg:w-[50%]">
              <div className="relative group bg-white border border-border rounded-[2rem] p-8 md:p-16 flex items-center justify-center overflow-hidden shadow-sm">
                <img
                  src={product.image}
                  alt={product.name}
                  className="relative z-10 max-h-[450px] object-contain transform group-hover:scale-110 transition-transform duration-700"
                />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <span className="inline-block text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                {product.categoryName || "Аксессуар"}
              </span>
              <h1 className="text-3xl md:text-5xl font-black uppercase font-heading leading-[1.1] tracking-tighter text-foreground">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="mt-6 flex items-center gap-4">
                <div className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-lg border border-border">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={i < Math.round(Number(product.rating)) ? "fill-[#05C3D4] text-[#05C3D4]" : "text-muted-foreground/20"}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm font-black text-foreground">{product.rating}</span>
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">({product.reviewCount} отзывов)</span>
              </div>

              {/* Price */}
              <div className="mt-10 p-8 bg-card border border-border rounded-3xl relative overflow-hidden shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-[#05C3D4]/5 blur-3xl rounded-full" />
                <div className="relative z-10">
                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">Актуальная цена</span>
                  <div className="flex items-center gap-6">
                    <span className="text-4xl md:text-5xl font-black text-[#05C3D4] font-heading">
                      {formatPrice(product.price)}
                    </span>
                    {product.oldPrice && (
                      <div className="flex flex-col">
                        <span className="text-xl text-muted-foreground/40 line-through font-bold">
                          {formatPrice(product.oldPrice)}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#22c55e] mt-1">
                          Выгода {formatPrice(product.oldPrice - product.price)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="mt-8 flex items-center gap-3 px-4 py-3 bg-muted rounded-xl border border-border w-fit">
                <div className={`w-2 h-2 rounded-full ${product.inStock ? "bg-[#22c55e] animate-pulse" : "bg-muted-foreground/30"}`} />
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {product.inStock ? "В наличии в магазинах" : "Нет в наличии"}
                </span>
              </div>

              {/* Description */}
              <div className="mt-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">Описание</h3>
                <p className="text-base text-muted-foreground leading-relaxed font-medium">
                  {product.description}
                </p>
              </div>

              {/* Specs */}
              {product.specs && typeof product.specs === 'object' && (
                <div className="mt-10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">Характеристики</h3>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(product.specs as Record<string, string>).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex justify-between items-center py-3 border-b border-border px-1 group"
                      >
                        <span className="text-sm font-bold text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">{key}</span>
                        <span className="text-sm font-black text-foreground/80">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-12 flex flex-col gap-4">
                <Button 
                  size="lg" 
                  onClick={handleAddToCart}
                  className="w-full h-16 text-sm tracking-[0.2em] glow-cyan"
                >
                  <ShoppingBag size={20} className="mr-2" />
                  ДОБАВИТЬ В КОРЗИНУ
                </Button>
                
                <div className="flex flex-wrap gap-4">
                  <button
                    onClick={() => setShowForm(true)}
                    className="flex-1 min-w-[180px] h-14 bg-muted border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-[0.1em] hover:bg-muted/80 transition-all active:scale-95"
                  >
                    Узнать наличие
                  </button>
                  <a
                    href="https://t.me/tech_aks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 px-8 h-14 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-[0.1em] hover:bg-muted transition-all active:scale-95"
                  >
                    <MessageCircle size={18} className="text-[#05C3D4]" />
                    Вопрос
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowForm(false)} />
          <div className="relative w-full max-w-xl">
            <button
              onClick={() => setShowForm(false)}
              className="absolute -top-12 right-0 text-white/40 hover:text-white flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-colors"
            >
              Закрыть ✕
            </button>
            <LeadForm
              dark
              title={`ЗАЯВКА НА «${product.name.toUpperCase()}»`}
              subtitle="Оставьте контакты — мы проверим наличие и свяжемся с вами в течение 5 минут."
              type="availability"
              source="product_page"
              metadata={{ 
                productName: product.name, 
                productSlug: product.slug,
                productId: product.id 
              }}
              buttonText="ПРОВЕРИТЬ НАЛИЧИЕ"
            />
          </div>
        </div>
      )}

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="py-24 bg-card border-t border-border">
          <div className="container-main">
            <div className="flex items-end justify-between gap-6 mb-16">
              <div>
                <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">Рекомендации</span>
                <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                  ПОХОЖИЕ <span className="text-muted-foreground/30">ТОВАРЫ</span>
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p as any} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
