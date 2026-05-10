import { useParams, Link } from "react-router";
import { Star, MessageCircle, ArrowLeft, ShoppingBag } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import LeadForm from "@/components/LeadForm";
import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/hooks/use-cart";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function ProductPage() {
  const { id: slug } = useParams<{ id: string }>();
  const [showForm, setShowForm] = useState(false);
  const { addItem } = useCart();

  const { data: product, isLoading } = trpc.product.getBySlug.useQuery({
    slug: slug || "",
  });
  const { data: stock = [] } = trpc.product.getStockBySlug.useQuery({
    slug: slug || "",
  });
  const { data: productManufacturer } =
    trpc.manufacturer.getByProductSlug.useQuery(
      { slug: slug || "" },
      { enabled: Boolean(slug) }
    );
  const { data: categories = [] } = trpc.product.getCategories.useQuery();
  const { data: merchandisingRelated = [] } =
    trpc.merchandising.recommendations.useQuery(
      {
        placement: "product_related",
        limit: 4,
        categoryId: product?.categoryId,
        excludeProductId: product?.id,
      },
      { enabled: Boolean(product) }
    );

  const breadcrumbs = useMemo(() => {
    if (!product || !categories.length) return [];
    const trail = [];
    let curr: any = categories.find(c => c.id === product.categoryId);
    while (curr) {
      trail.unshift(curr);
      const pid = curr.parentId;
      curr = categories.find(c => c.id === pid);
    }
    return trail;
  }, [categories, product]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Загрузка товара...
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">
            Товар не найден
          </h1>
          <Link
            to="/catalog"
            className="mt-4 inline-flex items-center gap-2 text-[#05C3D4] hover:underline"
          >
            <ArrowLeft size={16} />
            Вернуться в каталог
          </Link>
        </div>
      </div>
    );
  }

  const relatedProducts = merchandisingRelated.slice(0, 4);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  const isManufacturerSpec = (key: string) =>
    ["производитель", "бренд"].includes(key.trim().toLowerCase());

  const handleAddToCart = () => {
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
    // CRO: Redirecting directly to checkout/cart page to reduce steps
    window.location.href = "/checkout";
  };

  return (
    <div className="min-h-screen pb-16 md:pb-0 bg-background text-foreground">
      {/* Breadcrumbs */}
      <section className="bg-muted/30 py-4 border-b border-border">
        <div className="container-main">
          <div className="flex items-center flex-wrap gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
            <Link
              to="/catalog"
              className="hover:text-[#05C3D4] transition-colors"
            >
              Каталог
            </Link>
            {breadcrumbs.map(bc => (
              <div key={bc.id} className="flex items-center gap-2">
                <span className="text-muted-foreground/20">/</span>
                <Link 
                  to={`/catalog?cat=${bc.slug}`}
                  className="hover:text-[#05C3D4] transition-colors"
                >
                  {bc.name}
                </Link>
              </div>
            ))}
            <span className="text-muted-foreground/20">/</span>
            <span className="text-muted-foreground truncate max-w-[150px] sm:max-w-[300px]">
              {product.name}
            </span>
          </div>
        </div>
      </section>

      {/* Header Title */}
      <section className="pt-12 pb-4">
        <div className="container-main">
          <h1 className="text-4xl md:text-6xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
            {product.name}
          </h1>
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
              {/* Rating */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-muted px-3 py-1.5 rounded-lg border border-border">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={14}
                        className={
                          i < Math.round(Number(product.rating))
                            ? "fill-[#05C3D4] text-[#05C3D4]"
                            : "text-muted-foreground/20"
                        }
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-sm font-black text-foreground">
                    {product.rating}
                  </span>
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  ({product.reviewCount} отзывов)
                </span>
              </div>

              {/* Price */}
              <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                  className={`p-6 bg-card border border-border rounded-3xl relative overflow-hidden shadow-sm ${
                    productManufacturer ? "md:col-span-3" : "md:col-span-4"
                  }`}
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-[#05C3D4]/5 blur-3xl rounded-full" />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2 block">
                      Актуальная цена
                    </span>
                    <div className="flex items-center gap-5">
                      <span className="text-4xl md:text-[42px] font-black text-[#05C3D4] font-heading leading-none">
                        {formatPrice(product.price)}
                      </span>
                      {product.oldPrice && (
                        <div className="flex flex-col">
                          <span className="text-lg text-muted-foreground/40 line-through font-bold">
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
                {productManufacturer && (
                  <Link
                    to={productManufacturer.href}
                    className="md:col-span-1 p-4 bg-card border border-border rounded-3xl transition-all hover:border-[#05C3D4]/60 hover:bg-[#05C3D4]/5 shadow-sm flex flex-col items-start justify-between gap-4 min-h-[160px]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white p-2.5 shrink-0">
                      {productManufacturer.logo ? (
                        <img
                          src={productManufacturer.logo}
                          alt={productManufacturer.title}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs font-black text-[#05C3D4]">
                          {productManufacturer.title.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 w-full">
                      <span className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Производитель
                      </span>
                      <span className="mt-1 block text-xl font-black text-foreground leading-tight break-words">
                        {productManufacturer.title}
                      </span>
                    </span>
                  </Link>
                )}
              </div>

              {/* Stock & FOMO */}
              <div className="mt-10 space-y-6">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">
                  Наличие в магазинах
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {stock.length > 0 ? (
                    stock.map((s, i) => (
                      <div
                        key={i}
                        className="flex flex-col p-4 bg-muted/30 border border-border rounded-2xl relative overflow-hidden group hover:border-[#05C3D4]/30 transition-all"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-black uppercase tracking-tight text-foreground/80 line-clamp-1" title={s.storeName}>
                            {s.storeName}
                          </span>
                          <div
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-md ${s.quantity > 0 ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-destructive/10 text-destructive"}`}
                          >
                            <div
                              className={`w-1.5 h-1.5 rounded-full ${s.quantity > 0 ? "bg-[#22c55e] animate-pulse" : "bg-destructive"}`}
                            />
                            <span className="text-[10px] font-black">
                              {s.quantity > 0 ? `${s.quantity} шт.` : "Нет"}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] font-medium text-muted-foreground leading-snug">
                          {s.storeAddress}
                        </p>

                        {s.quantity > 0 && s.quantity <= 3 && (
                          <div className="absolute top-0 right-0">
                            <div className="bg-orange-500 text-white text-[8px] font-black px-2 py-0.5 rounded-bl-lg uppercase tracking-tighter">
                              Мало
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="col-span-full py-4 px-6 bg-muted/20 border border-dashed border-border rounded-xl text-center">
                      <span className="text-xs font-bold text-muted-foreground uppercase">
                        Информацию о наличии уточняйте у менеджера
                      </span>
                    </div>
                  )}
                </div>

                {product.inStock &&
                  stock.some(s => s.quantity > 0 && s.quantity <= 3) && (
                    <div className="flex items-center gap-3 px-4 py-3 bg-orange-500/10 rounded-xl border border-orange-500/20 w-fit animate-in fade-in slide-in-from-left duration-700">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-500">
                        Товар заканчивается в некоторых магазинах!
                      </span>
                    </div>
                  )}
              </div>

              {/* Description */}
              <div className="mt-10">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">
                  Описание
                </h3>
                <p className="text-base text-muted-foreground leading-relaxed font-medium">
                  {product.description}
                </p>
              </div>

              {/* Specs */}
              {product.specs && typeof product.specs === "object" && (
                <div className="mt-10">
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40 mb-4">
                    Характеристики
                  </h3>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(
                      product.specs as Record<string, string>
                    ).map(([key, value]) => {
                      const showLogoValue =
                        productManufacturer && isManufacturerSpec(key);
                      return (
                        <div
                          key={key}
                          className="flex justify-between items-center gap-6 py-3 border-b border-border px-1 group"
                        >
                          <span className="text-sm font-bold text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                            {key}
                          </span>
                          {showLogoValue ? (
                            <Link
                              to={productManufacturer.href}
                              className="inline-flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-black text-foreground/80 transition-colors hover:bg-[#05C3D4]/10 hover:text-[#05C3D4]"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white p-1">
                                {productManufacturer.logo ? (
                                  <img
                                    src={productManufacturer.logo}
                                    alt={productManufacturer.title}
                                    className="h-full w-full object-contain"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="text-[8px] font-black text-[#05C3D4]">
                                    {productManufacturer.title
                                      .slice(0, 2)
                                      .toUpperCase()}
                                  </span>
                                )}
                              </span>
                              <span className="truncate">{value}</span>
                            </Link>
                          ) : (
                            <span className="text-right text-sm font-black text-foreground/80">
                              {value}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-12 flex flex-col gap-4">
                <Button
                  size="lg"
                  onClick={handleAddToCart}
                  className="magnetic w-full h-16 text-sm tracking-[0.2em] rounded-2xl bg-[#05C3D4] text-white dark:text-black hover:bg-[#27E6F2] transition-colors relative overflow-hidden group shadow-[0_4px_20px_rgba(5,195,212,0.3)] dark:shadow-[0_0_40px_rgba(5,195,212,0.3)]"
                >
                  <ShoppingBag size={20} className="mr-2" />
                  ДОБАВИТЬ В КОРЗИНУ
                </Button>

                <div className="flex flex-wrap gap-4">
                  <a
                    href="https://t.me/tech_aks"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-3 h-14 border border-border text-foreground rounded-xl text-xs font-black uppercase tracking-[0.1em] hover:bg-muted transition-all active:scale-95"
                  >
                    <MessageCircle size={18} className="text-[#05C3D4]" />
                    ЗАДАТЬ ВОПРОС В TELEGRAM
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
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={() => setShowForm(false)}
          />
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
                productId: product.id,
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
                <span className="text-[#05C3D4] text-[10px] font-black uppercase tracking-[0.3em] mb-3 block">
                  Рекомендации
                </span>
                <h2 className="text-4xl md:text-5xl font-black uppercase font-heading leading-none tracking-tighter text-foreground">
                  ПОХОЖИЕ{" "}
                  <span className="text-muted-foreground/30">ТОВАРЫ</span>
                </h2>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map(p => (
                <ProductCard key={p.id} product={p as any} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
