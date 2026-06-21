import { Link } from "react-router";
import { FolderKanban, ScanSearch, SlidersHorizontal } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";

const cards = [
  {
    title: "Все характеристики",
    description:
      "Общая витрина всех характеристик по категориям: что показывается на сайте, что скрыто и что участвует в фильтрах.",
    href: "/admin/products/specs",
    icon: ScanSearch,
    cta: "Открыть характеристики",
  },
  {
    title: "Производители каталога",
    description:
      "Собираем производителей из номенклатуры, управляем логотипами, slug и видимостью брендовых страниц.",
    href: "/admin/products/manufacturers",
    icon: FolderKanban,
    cta: "Открыть производителей",
  },
  {
    title: "Нормализация характеристик",
    description:
      "Переносим пары «ключ: значение» из описаний товаров в характеристики и обновляем индекс свойств.",
    href: "/admin/normalize-specs",
    icon: SlidersHorizontal,
    cta: "Открыть нормализацию",
  },
];

export default function AdminProductSettings() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Каталог"
        title="Настройки товаров"
        description="Здесь живут служебные инструменты каталога. Список товаров больше не перегружен системными панелями и остаётся чистым рабочим экраном."
      />

      <AdminSection
        title="Инструменты каталога"
        description="Разделили настройки по отдельным страницам: обзор характеристик, брендовый каталог и нормализация."
      >
        <div className="grid gap-4 xl:grid-cols-3">
          {cards.map(card => {
            const Icon = card.icon;
            return (
              <Link
                key={card.href}
                to={card.href}
                className="group flex min-h-[220px] flex-col justify-between rounded-3xl border border-gray-200 bg-white p-6 transition-colors hover:border-[#05C3D4]"
              >
                <div className="space-y-4">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#05C3D4]/10 text-[#05C3D4]">
                    <Icon size={22} />
                  </span>
                  <div className="space-y-2">
                    <h2 className="text-lg font-black text-[#15171A]">{card.title}</h2>
                    <p className="text-sm leading-6 text-gray-500">{card.description}</p>
                  </div>
                </div>
                <div className="pt-5 text-sm font-bold text-[#05C3D4]">{card.cta}</div>
              </Link>
            );
          })}
        </div>
      </AdminSection>
    </div>
  );
}
