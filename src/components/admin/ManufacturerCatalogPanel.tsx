import { useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { slugify } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

type ManufacturerEdit = {
  name: string;
  slug: string;
  website: string;
  logoUrl: string;
  isVisible: boolean;
  sortOrder: number;
};

export default function ManufacturerCatalogPanel() {
  const utils = trpc.useUtils();
  const manufacturersQuery = trpc.manufacturer.getAll.useQuery();
  const rawManufacturersQuery = trpc.product.getManufacturersFromProducts.useQuery();
  const [edits, setEdits] = useState<Record<number, ManufacturerEdit>>({});

  const syncCatalog = trpc.manufacturer.syncCatalog.useMutation({
    onSuccess: result => {
      utils.manufacturer.getAll.invalidate();
      rawManufacturersQuery.refetch();
      alert(
        `Каталог производителей собран: найдено ${result.found}, создано ${result.created}, обновлено ${result.updated}.`
      );
    },
  });

  const collectLogos = trpc.manufacturer.collectLogos.useMutation({
    onSuccess: result => {
      utils.manufacturer.getAll.invalidate();
      alert(
        `Логотипы обновлены: ${result.updated}. Без изменений оставлено ${result.preserved}.`
      );
    },
  });

  const updateManufacturer = trpc.manufacturer.update.useMutation({
    onSuccess: () => {
      utils.manufacturer.getAll.invalidate();
    },
  });

  const manufacturers = manufacturersQuery.data ?? [];

  useEffect(() => {
    if (!manufacturers.length) return;

    setEdits(prev => {
      const next = { ...prev };
      for (const manufacturer of manufacturers) {
        if (next[manufacturer.id]) continue;
        next[manufacturer.id] = {
          name: manufacturer.name,
          slug: manufacturer.slug,
          website: manufacturer.website ?? "",
          logoUrl: manufacturer.logoUrl ?? "",
          isVisible: manufacturer.isVisible,
          sortOrder: manufacturer.sortOrder,
        };
      }
      return next;
    });
  }, [manufacturers]);

  const totals = useMemo(() => {
    const visibleCount = manufacturers.filter(item => item.isVisible).length;
    const withLogoCount = manufacturers.filter(item => item.logoUrl).length;
    const totalProducts = manufacturers.reduce(
      (sum, item) => sum + item.productCount,
      0
    );
    return {
      visibleCount,
      withLogoCount,
      totalProducts,
    };
  }, [manufacturers]);

  const patchEdit = (id: number, patch: Partial<ManufacturerEdit>) => {
    setEdits(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        ...patch,
      },
    }));
  };

  const saveRow = async (id: number) => {
    const edit = edits[id];
    if (!edit) return;
    await updateManufacturer.mutateAsync({
      id,
      name: edit.name.trim(),
      slug: edit.slug.trim(),
      website: edit.website.trim() || null,
      logoUrl: edit.logoUrl.trim() || null,
      isVisible: edit.isVisible,
      sortOrder: edit.sortOrder,
    });
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <Accordion type="single" collapsible defaultValue="manufacturers">
        <AccordionItem value="manufacturers" className="border-b-0">
          <AccordionTrigger className="py-0 hover:no-underline">
            <div className="pr-4 text-left">
              <h2 className="text-lg font-black text-[#0a0a0a]">
                Каталог производителей
              </h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Собираем всех производителей из номенклатуры, готовим логотипы
                для меню каталога и открываем отдельный брендовый режим витрины.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-5">
            <div className="grid gap-3 md:grid-cols-4">
              <StatCard
                label="В каталоге"
                value={manufacturers.length}
                helper="брендов"
              />
              <StatCard
                label="Видимых"
                value={totals.visibleCount}
                helper="для витрины"
              />
              <StatCard
                label="С логотипами"
                value={totals.withLogoCount}
                helper="заполнено"
              />
              <StatCard
                label="Товаров"
                value={totals.totalProducts}
                helper="привязано"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => syncCatalog.mutate()}
                disabled={syncCatalog.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#05C3D4] px-4 text-sm font-bold text-white hover:bg-[#0097a7] disabled:opacity-50"
              >
                {syncCatalog.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                Собрать производителей
              </button>
              <button
                type="button"
                onClick={() => collectLogos.mutate({ force: false })}
                disabled={collectLogos.isPending || manufacturers.length === 0}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
              >
                {collectLogos.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                Собрать логотипы
              </button>
              <button
                type="button"
                onClick={() => {
                  manufacturersQuery.refetch();
                  rawManufacturersQuery.refetch();
                }}
                disabled={manufacturersQuery.isFetching}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={manufacturersQuery.isFetching ? "animate-spin" : ""}
                />
                Обновить
              </button>
              {rawManufacturersQuery.data && rawManufacturersQuery.data.length > 0 && (
                <div className="text-xs text-gray-500">
                  В товарах сейчас найдено {rawManufacturersQuery.data.length}{" "}
                  уникальных производителей.
                </div>
              )}
            </div>

            <div className="mt-5 overflow-hidden rounded-xl border border-gray-200">
              <div className="max-h-[620px] overflow-auto">
                <table className="w-full min-w-[980px] text-left">
                  <thead className="sticky top-0 bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Лого
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Производитель
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Slug
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Сайт
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Показ
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Товаров
                      </th>
                      <th className="px-4 py-3 text-xs font-black uppercase text-gray-500">
                        Действие
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {manufacturers.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-gray-500"
                        >
                          Пока пусто. Сначала нажми «Собрать производителей».
                        </td>
                      </tr>
                    ) : (
                      manufacturers.map(manufacturer => {
                        const edit = edits[manufacturer.id];
                        if (!edit) return null;

                        return (
                          <tr key={manufacturer.id} className="align-top">
                            <td className="px-4 py-3">
                              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-white">
                                {edit.logoUrl ? (
                                  <img
                                    src={edit.logoUrl}
                                    alt={edit.name}
                                    className="h-10 w-10 object-contain"
                                  />
                                ) : (
                                  <span className="text-[10px] font-black text-gray-400">
                                    Нет
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={edit.name}
                                onChange={event => {
                                  const nextName = event.target.value;
                                  patchEdit(manufacturer.id, {
                                    name: nextName,
                                    slug: slugify(nextName),
                                  });
                                }}
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
                              />
                              <input
                                value={edit.logoUrl}
                                onChange={event =>
                                  patchEdit(manufacturer.id, {
                                    logoUrl: event.target.value,
                                  })
                                }
                                placeholder="URL логотипа"
                                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-xs outline-none focus:border-[#05C3D4]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={edit.slug}
                                onChange={event =>
                                  patchEdit(manufacturer.id, {
                                    slug: slugify(event.target.value),
                                  })
                                }
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                value={edit.website}
                                onChange={event =>
                                  patchEdit(manufacturer.id, {
                                    website: event.target.value,
                                  })
                                }
                                placeholder="brand.com"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                                <input
                                  type="checkbox"
                                  checked={edit.isVisible}
                                  onChange={event =>
                                    patchEdit(manufacturer.id, {
                                      isVisible: event.target.checked,
                                    })
                                  }
                                />
                                Показывать
                              </label>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-sm font-bold text-[#0a0a0a]">
                                {manufacturer.productCount}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => saveRow(manufacturer.id)}
                                disabled={updateManufacturer.isPending}
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-bold text-[#0a0a0a] disabled:opacity-50"
                              >
                                {updateManufacturer.isPending ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Save size={14} />
                                )}
                                Сохранить
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
      <div className="text-[11px] font-black uppercase tracking-widest text-gray-500">
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-[#0a0a0a]">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{helper}</div>
    </div>
  );
}
