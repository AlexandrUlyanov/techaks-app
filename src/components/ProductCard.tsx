import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { ShoppingCart, Star } from "lucide-react";
import { toast } from "sonner";

interface ProductCardProps {
  product: {
    id: number;
    slug: string;
    name: string;
    price: number;
    oldPrice?: number | null;
    badge?: string | null;
    image: string;
    categoryId: number;
    categoryName?: string;
    rating?: string | number | null;
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  const badgeColors: Record<string, string> = {
    "Акция": "bg-[#05C3D4] text-black",
    "Хит": "bg-white text-black",
    "Новинка": "bg-[#05C3D4] text-black",
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    toast.success("Товар добавлен в корзину");
    // CRO: Redirect directly to checkout
    window.location.href = "/checkout";
  };

  return (
    <div className="group bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#05C3D4]/30 hover:-translate-y-1 shadow-sm hover:shadow-xl relative flex flex-col h-full">
      <Link
        to={`/product/${product.slug}`}
        className="flex-1 flex flex-col"
      >
        {/* Image */}
        <div className="relative h-[220px] bg-white flex items-center justify-center p-6 transition-all duration-500 overflow-hidden">
          {product.badge && (
            <span
              className={`absolute top-4 left-4 z-10 ${badgeColors[product.badge] || "bg-gray-500"} text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md shadow-lg`}
            >
              {product.badge}
            </span>
          )}
          <img
            src={product.image}
            alt={product.name}
            className="max-w-[90%] max-h-[90%] object-contain group-hover:scale-110 transition-transform duration-500"
            loading="lazy"
          />
        </div>

        {/* Info */}
        <div className="p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            {product.categoryName && (
              <span className="text-[10px] font-black uppercase text-[#05C3D4] tracking-[0.2em]">
                {product.categoryName}
              </span>
            )}
            {product.rating && (
              <div className="flex items-center gap-1">
                <Star size={10} className="fill-[#05C3D4] text-[#05C3D4]" />
                <span className="text-[10px] font-black text-foreground">{product.rating}</span>
              </div>
            )}
          </div>
          <h3 className="text-base font-bold text-foreground line-clamp-2 leading-snug min-h-[3rem]">
            {product.name}
          </h3>
          <div className="mt-auto pt-4 flex items-center gap-4">
            <span className="text-xl font-black text-[#05C3D4]">
              {formatPrice(product.price)}
            </span>
            {product.oldPrice && (
              <span className="text-sm text-muted-foreground/60 line-through font-bold">
                {formatPrice(product.oldPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* CRO: Direct Add to Cart Button */}
      <div className="px-6 pb-6">
        <button
          onClick={handleAddToCart}
          className="flex items-center justify-center gap-3 w-full py-4 bg-[#05C3D4] text-white dark:text-black rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#27E6F2] transition-all glow-cyan active:scale-95"
        >
          <ShoppingCart size={16} />
          В корзину
        </button>
      </div>
    </div>
  );
}
