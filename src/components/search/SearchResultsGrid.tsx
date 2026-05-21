import ProductCard from "@/components/ProductCard";

export default function SearchResultsGrid({
  products,
  onProductClick,
}: {
  products: Array<any>;
  onProductClick?: (productId: number, url: string, position: number) => void | Promise<void>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          imagePriority={index < 4}
          onNavigate={
            onProductClick
              ? url => onProductClick(product.id, url, index)
              : undefined
          }
        />
      ))}
    </div>
  );
}
