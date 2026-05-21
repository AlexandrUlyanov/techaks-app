import ProductCard from "@/components/ProductCard";

export default function SearchResultsGrid({
  products,
}: {
  products: Array<any>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          imagePriority={index < 4}
        />
      ))}
    </div>
  );
}
