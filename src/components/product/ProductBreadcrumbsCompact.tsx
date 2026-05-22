import { Fragment } from "react";
import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";

type BreadcrumbItem = {
  id: number;
  slug: string;
  name: string;
};

function shortenBreadcrumbLabel(label: string) {
  const normalized = label.trim();

  const dictionary: Record<string, string> = {
    Каталог: "Кат.",
    "Смартфоны": "Смартф.",
    "Смартфоны и гаджеты": "Смартф.",
    "Смартфоны и телефоны": "Смартф.",
    Аксессуары: "Акс.",
    "Компьютеры и ноутбуки": "ПК",
    "Бытовая техника": "Быт. тех.",
  };

  return dictionary[normalized] ?? normalized;
}

function shortenProductName(label: string) {
  return label
    .replace(/^Смартфон\s+/i, "")
    .replace(/^Samsung Galaxy\s+/i, "")
    .trim();
}

export default function ProductBreadcrumbsCompact({
  breadcrumbs,
  productName,
}: {
  breadcrumbs: BreadcrumbItem[];
  productName: string;
}) {
  const tailBreadcrumbs = breadcrumbs.slice(-2);

  return (
    <nav className="bg-white">
      <div className="container-main">
        <div className="flex h-9 items-center">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[11px] font-semibold text-[#7A7F87] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link to="/" className="shrink-0 text-[#464A50]">
              <Home size={14} />
            </Link>

            <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />

            <Link to="/catalog" className="shrink-0">
              Кат.
            </Link>

            {tailBreadcrumbs.map(breadcrumb => (
              <Fragment key={breadcrumb.id}>
                <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />
                <Link
                  to={`/catalog?cat=${breadcrumb.slug}`}
                  className="max-w-[92px] shrink-0 truncate hover:text-[#1F2328]"
                >
                  {shortenBreadcrumbLabel(String(breadcrumb.name))}
                </Link>
              </Fragment>
            ))}

            <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />

            <span className="min-w-0 truncate text-[#1F2328]">
              {shortenProductName(productName)}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
