import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { Heart, Minus, Plus, ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";
import {
  getMerchandisingBadgeLabel,
  getMerchandisingBadgeStyle,
  normalizeMerchandisingBadges,
} from "@/lib/merchandising-badges";
import { formatRussianCount } from "@/lib/russian-plurals";
import { applyProductImageFallback, resolveProductImageSrc } from "@/lib/product-images";

interface ProductCardProps {
  product: {
    id: number;
    slug: string;
    name: string;
    price: number;
    oldPrice?: number | null;
    badge?: string | null;
    badges?: unknown;
    merchandisingBadges?: unknown;
    image: string;
    categoryId: number;
    categoryName?: string;
    rating?: string | number | null;
    reviewCount?: number | null;
    inStock?: boolean | null;
    specs?: Record<string, unknown> | null;
  };
  variant?: "grid" | "list";
}

export default function ProductCard({ product, variant = "grid" }: ProductCardProps) {
  const { items, addItem, updateQuantity } = useCart();
  const cartItem = items.find(item => item.id === product.id);
  const isInStock = Boolean(product.inStock);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  const badgeColors: Record<string, string> = {
    Акция: "bg-[#05C3D4] text-black",
    Хит: "bg-white text-black",
    Новинка: "bg-[#05C3D4] text-black",
  };
  const merchandisingBadges = normalizeMerchandisingBadges(
    product.merchandisingBadges ?? product.badges
  ).slice(0, 3);
  const productImageSrc = resolveProductImageSrc(product.image);

  const rating = Number(product.rating ?? 0);
  const hasRating = Boolean(product.reviewCount && product.reviewCount > 0 && rating > 0);
  const reviewCountLabel = formatRussianCount(product.reviewCount ?? 0, [
    "отзыв",
    "отзыва",
    "отзывов",
  ]);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isInStock) {
      toast.error("Товара сейчас нет в наличии");
      return;
    }
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
  };

  const decreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem) updateQuantity(product.id, cartItem.quantity - 1);
  };

  const increaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (cartItem) updateQuantity(product.id, cartItem.quantity + 1);
  };

  const cartControl = !isInStock ? (
    <button
      type="button"
      disabled
      className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-[#D7E0E7] bg-[#F3F6F8] px-4 text-[10px] font-black uppercase tracking-widest text-[#7F8A96] cursor-not-allowed shadow-none"
      aria-label="Нет в наличии"
    >
      <ShoppingCart size={14} className="hidden sm:block opacity-70" />
      Нет в наличии
    </button>
  ) : cartItem ? (
    <div className="grid h-10 grid-cols-[36px_1fr_36px] overflow-hidden rounded-lg border border-[#05C3D4]/40 bg-[#05C3D4]/10">
      <button
        type="button"
        onClick={decreaseQuantity}
        className="flex items-center justify-center text-[#047987] hover:bg-[#05C3D4]/15"
        aria-label="Уменьшить количество"
      >
        <Minus size={14} />
      </button>
      <div className="flex items-center justify-center text-sm font-black text-foreground">
        {cartItem.quantity}
      </div>
      <button
        type="button"
        onClick={increaseQuantity}
        className="flex items-center justify-center text-[#047987] hover:bg-[#05C3D4]/15"
        aria-label="Увеличить количество"
      >
        <Plus size={14} />
      </button>
    </div>
  ) : (
    <button
      onClick={handleAddToCart}
      className="magnetic flex h-10 items-center justify-center gap-2 rounded-2xl bg-[#05C3D4] px-4 text-[10px] font-black uppercase tracking-widest text-white dark:text-black transition-all duration-300 hover:bg-[#27E6F2] active:scale-95 relative overflow-hidden group shadow-[0_4px_20px_rgba(5,195,212,0.3)] dark:shadow-[0_0_30px_rgba(5,195,212,0.3)]"
    >
      <ShoppingCart size={14} className="hidden sm:block" />
      В корзину
    </button>
  );

  if (variant === "list") {
    return (
      <div className="group bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:border-[#05C3D4]/30 shadow-sm relative after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:opacity-0 after:transition-opacity after:duration-500 after:bg-[linear-gradient(90deg,transparent,#05C3D4,transparent),linear-gradient(180deg,transparent,#05C3D4,transparent)] after:bg-[length:180%_1px,1px_180%] after:bg-[position:-180%_0,100%_-180%] after:bg-no-repeat group-hover:after:opacity-60 group-hover:after:animate-[electric-border_2.8s_linear_infinite]">
        <Link to={`/product/${product.slug}`} className="grid grid-cols-[112px_1fr] sm:grid-cols-[148px_1fr] gap-4 p-3 sm:p-4">
          <div className="relative h-[112px] sm:h-[132px] bg-white rounded-lg flex items-center justify-center p-3 overflow-hidden">
            {merchandisingBadges.length > 0 && (
              <div className="absolute left-2 top-2 z-10 flex max-w-[130px] flex-wrap gap-1">
                {merchandisingBadges.map(itemBadge => (
                  <span
                    key={itemBadge}
                    className={`${getMerchandisingBadgeStyle(itemBadge)} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
                  >
                    {getMerchandisingBadgeLabel(itemBadge)}
                  </span>
                ))}
              </div>
            )}
            {product.badge && (
              <span
                className={`absolute ${merchandisingBadges.length > 0 ? "left-2 top-11" : "left-2 top-2"} z-10 ${badgeColors[product.badge] || "bg-gray-500"} rounded px-2 py-0.5 text-[9px] font-black uppercase`}
              >
                {product.badge}
              </span>
            )}
            <img
              src={productImageSrc}
              alt={product.name}
              className="h-full w-full object-contain transition-all duration-300"
              loading="lazy"
              onError={applyProductImageFallback}
            />
          </div>

          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex items-center justify-end gap-3">
              <span className={!isInStock ? "text-[10px] font-bold text-muted-foreground" : "text-[10px] font-bold text-green-600"}>
                {!isInStock ? "Нет в наличии" : "В наличии"}
              </span>
            </div>
            <h3 className="line-clamp-2 text-sm sm:text-base font-bold leading-snug text-foreground">
              {product.name}
            </h3>
            {hasRating && (
              <div className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                <Star size={12} className="fill-[#05C3D4] text-[#05C3D4]" />
                {rating.toFixed(1)} · {reviewCountLabel}
              </div>
            )}
            <div className="mt-auto flex items-end justify-between gap-3">
              <div>
                <div className="text-lg sm:text-xl font-black text-[#05C3D4]">
                  {formatPrice(product.price)}
                </div>
                {product.oldPrice && (
                  <div className="text-xs text-muted-foreground/60 line-through font-bold">
                    {formatPrice(product.oldPrice)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {cartControl}
                <button
                  type="button"
                  className="hidden sm:flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-[#05C3D4] hover:text-[#05C3D4]"
                  aria-label="В избранное"
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <Heart size={15} />
                </button>
              </div>
            </div>
          </div>
        </Link>
      </div>
    );
  }

  return (
    <div className="group bg-card border border-border rounded-xl overflow-hidden transition-all duration-300 hover:border-[#05C3D4]/30 shadow-sm hover:shadow-lg relative flex flex-col h-full after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:opacity-0 after:transition-opacity after:duration-500 after:bg-[linear-gradient(90deg,transparent,#05C3D4,transparent),linear-gradient(180deg,transparent,#05C3D4,transparent)] after:bg-[length:180%_1px,1px_180%] after:bg-[position:-180%_0,100%_-180%] after:bg-no-repeat group-hover:after:opacity-60 group-hover:after:animate-[electric-border_2.8s_linear_infinite]">
      <Link to={`/product/${product.slug}`} className="flex-1 flex flex-col">
        <div className="relative h-[150px] sm:h-[180px] bg-white flex items-center justify-center p-3 sm:p-4 transition-all duration-300 overflow-hidden">
          {merchandisingBadges.length > 0 && (
            <div className="absolute left-2 top-2 z-10 flex max-w-[150px] flex-wrap gap-1">
              {merchandisingBadges.map(itemBadge => (
                <span
                  key={itemBadge}
                  className={`${getMerchandisingBadgeStyle(itemBadge)} rounded px-2 py-0.5 text-[9px] font-black uppercase shadow-sm`}
                >
                  {getMerchandisingBadgeLabel(itemBadge)}
                </span>
              ))}
            </div>
          )}
          {product.badge && (
            <span
              className={`absolute ${merchandisingBadges.length > 0 ? "left-2 top-11" : "left-2 top-2"} z-10 ${badgeColors[product.badge] || "bg-gray-500"} rounded px-2 py-0.5 text-[9px] font-black uppercase shadow-sm`}
            >
              {product.badge}
            </span>
          )}
          <img
            src={productImageSrc}
            alt={product.name}
            className="h-full w-full object-contain transition-all duration-300"
            loading="lazy"
            onError={applyProductImageFallback}
          />
        </div>

        <div className="p-3 sm:p-4 flex-1 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className={!isInStock ? "shrink-0 text-[10px] font-bold text-muted-foreground" : "shrink-0 text-[10px] font-bold text-green-600"}>
              {!isInStock ? "Нет в наличии" : "В наличии"}
            </span>
          </div>
          <h3 className="text-sm sm:text-[15px] font-bold text-foreground line-clamp-2 leading-snug min-h-[2.55rem]">
            {product.name}
          </h3>
          {hasRating && (
            <div className="mt-2 flex items-center gap-1">
                <Star size={10} className="fill-[#05C3D4] text-[#05C3D4]" />
                <span className="text-[10px] font-bold text-muted-foreground">
                  {rating.toFixed(1)} · {reviewCountLabel}
                </span>
            </div>
          )}
          <div className="mt-auto pt-3 flex items-end gap-2">
            <span className="text-lg sm:text-xl font-black text-[#05C3D4] leading-none">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground/60 line-through font-bold">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      <div className="p-3 sm:p-4 pt-0 grid grid-cols-[1fr_40px] gap-2">
        {cartControl}
        <button
          type="button"
          className="flex h-10 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-[#05C3D4] hover:text-[#05C3D4] transition-colors"
          aria-label="В избранное"
          onClick={e => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Heart size={15} />
        </button>
      </div>
    </div>
  );
}
