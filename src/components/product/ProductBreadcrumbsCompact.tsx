import { Fragment } from "react";
import { Link } from "react-router";
import { ChevronRight, Home } from "lucide-react";

export type CompactBreadcrumbItem = {
  id?: number | string;
  label: string;
  to?: string;
};

export function shortenBreadcrumbLabel(label: string) {
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

export function shortenProductName(label: string) {
  return label
    .replace(/^Смартфон\s+/i, "")
    .replace(/^Samsung Galaxy\s+/i, "")
    .trim();
}

export default function ProductBreadcrumbsCompact({
  items,
  currentLabel,
  homeTo = "/",
  rootTo = "/",
  rootLabel = "Главная",
  compactRootLabel,
  shortenItemLabel = shortenBreadcrumbLabel,
  shortenCurrentLabel,
}: {
  items: CompactBreadcrumbItem[];
  currentLabel?: string;
  homeTo?: string;
  rootTo?: string;
  rootLabel?: string;
  compactRootLabel?: string;
  shortenItemLabel?: (label: string) => string;
  shortenCurrentLabel?: (label: string) => string;
}) {
  const visibleItems = items.slice(-2);
  const renderedCurrentLabel = currentLabel
    ? shortenCurrentLabel?.(currentLabel) ?? currentLabel
    : null;

  return (
    <nav className="bg-white">
      <div className="container-main">
        <div className="flex h-9 items-center">
          <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[11px] font-semibold text-[#7A7F87] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Link to={homeTo} className="shrink-0 text-[#464A50]" aria-label={rootLabel}>
              <Home size={14} />
            </Link>

            <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />

            {compactRootLabel ? (
              <Link to={rootTo} className="shrink-0">
                {compactRootLabel}
              </Link>
            ) : null}

            {visibleItems.map((item, index) => (
              <Fragment key={item.id ?? `${item.label}-${index}`}>
                {(compactRootLabel || index > 0) ? (
                  <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />
                ) : null}
                {item.to ? (
                  <Link
                    to={item.to}
                    className="max-w-[92px] shrink-0 truncate hover:text-[#1F2328]"
                  >
                    {shortenItemLabel(item.label)}
                  </Link>
                ) : (
                  <span className="max-w-[92px] shrink-0 truncate">
                    {shortenItemLabel(item.label)}
                  </span>
                )}
              </Fragment>
            ))}

            {renderedCurrentLabel ? (
              <>
                {(compactRootLabel || visibleItems.length > 0) ? (
                  <ChevronRight size={12} className="shrink-0 text-[#C0C5CC]" />
                ) : null}
                <span className="min-w-0 truncate text-[#1F2328]">
                  {renderedCurrentLabel}
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </nav>
  );
}
