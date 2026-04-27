import { Link } from "react-router";

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
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  const badgeColors: Record<string, string> = {
    "Акция": "bg-[#00bcd4]",
    "Хит": "bg-[#f97316]",
    "Новинка": "bg-[#22c55e]",
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group bg-white border border-gray-200 rounded-xl overflow-hidden transition-all duration-250 hover:shadow-[0_4px_12px_rgba(0,0,0,0.12),0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1"
    >
      {/* Image */}
      <div className="relative h-[200px] bg-[#f8f8f8] flex items-center justify-center p-4">
        {product.badge && (
          <span
            className={`absolute top-3 left-3 ${badgeColors[product.badge] || "bg-gray-500"} text-white text-xs font-semibold px-2.5 py-1 rounded-md`}
          >
            {product.badge}
          </span>
        )}
        <img
          src={product.image}
          alt={product.name}
          className="max-w-[85%] max-h-[85%] object-contain"
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div className="p-4 pb-3">
        {product.categoryName && (
          <span className="text-xs font-semibold uppercase text-[#007c91] tracking-wide">
            {product.categoryName}
          </span>
        )}
        <h3 className="mt-1.5 text-sm font-semibold text-[#0a0a0a] line-clamp-2 leading-snug">
          {product.name}
        </h3>
        <div className="mt-3 flex items-center gap-2.5">
          <span className="text-lg font-bold text-[#0a0a0a]">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-sm text-gray-400 line-through">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="px-4 pb-4">
        <span className="block w-full text-center py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-[#0a0a0a] group-hover:border-[#00bcd4] group-hover:text-[#007c91] transition-colors">
          Подробнее
        </span>
      </div>
    </Link>
  );
}
