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
    "Акция": "bg-[#05C3D4] text-black",
    "Хит": "bg-white text-black",
    "Новинка": "bg-[#05C3D4] text-black",
  };

  return (
    <Link
      to={`/product/${product.slug}`}
      className="group bg-card border border-border rounded-2xl overflow-hidden transition-all duration-300 hover:border-[#05C3D4]/30 hover:-translate-y-1 shadow-sm hover:shadow-xl"
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
      <div className="p-6">
        {product.categoryName && (
          <span className="text-[10px] font-black uppercase text-[#05C3D4] tracking-[0.2em]">
            {product.categoryName}
          </span>
        )}
        <h3 className="mt-2 text-base font-bold text-foreground line-clamp-2 leading-snug min-h-[3rem]">
          {product.name}
        </h3>
        <div className="mt-4 flex items-center gap-4">
          <span className="text-xl font-black text-[#05C3D4]">
            {formatPrice(product.price)}
          </span>
          {product.oldPrice && (
            <span className="text-sm text-muted-foreground/60 line-through font-bold">
              {formatPrice(product.oldPrice)}
            </span>
          )}
        </div>
        
        <div className="mt-6">
          <span className="flex items-center justify-center w-full py-3.5 bg-muted border border-border rounded-xl text-[11px] font-black uppercase tracking-widest text-foreground group-hover:bg-[#05C3D4] group-hover:text-white dark:group-hover:text-black group-hover:border-[#05C3D4] transition-all">
            Подробнее
          </span>
        </div>
      </div>
    </Link>
  );
}
