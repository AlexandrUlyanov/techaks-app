import { Link, useSearchParams } from "react-router";
import { useMemo, useState } from "react";
import ProductCard from "@/components/ProductCard";
import { trpc } from "@/providers/trpc";
import { ArrowRight, ChevronDown, Loader2, SlidersHorizontal } from "lucide-react";
import { useSeo } from "@/lib/seo";
import { formatRussianCount } from "@/lib/russian-plurals";
import {
  buildBreadcrumbStructuredData,
  getPublicSchemaAddress,
  buildOrganizationStructuredData,
} from "@/lib/seo-structured";

export default function PromotionsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const activeCategory = searchParams.get("category") || "all";
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: banners = [], isLoading } = trpc.banner.getActive.useQuery();
  const { data: promotionalData, isLoading: isPromotionalLoading } =
    trpc.product.getPromotionalProducts.useQuery({
      categorySlug: activeCategory,
    });

  const promotionalProducts = promotionalData?.products ?? [];
  const promotionalCategories = promotionalData?.categories ?? [];
  const promotionalProductsLabel = formatRussianCount(promotionalProducts.length, [
    "товар",
    "товара",
    "товаров",
  ]);
  const allPromotionalProductsLabel = useMemo(
    () =>
      formatRussianCount(
        promotionalCategories.reduce(
          (sum, category) => sum + category.productCount,
          0
        ),
        ["товар", "товара", "товаров"]
      ),
    [promotionalCategories]
  );

  const selectCategory = (categorySlug: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (categorySlug === "all") {
      nextParams.delete("category");
    } else {
      nextParams.set("category", categorySlug);
    }
    setSearchParams(nextParams, { replace: true });
    setMobileFilterOpen(false);
  };

  useSeo({
    title: "Акции и спецпредложения ТЕХАКС",
    description:
      "Актуальные акции, скидки и спецпредложения ТЕХАКС на технику и аксессуары.",
    canonicalPath: "/promotions",
    structuredData: [
      buildBreadcrumbStructuredData([
        { name: "Главная", path: "/" },
        { name: "Акции", path: "/promotions" },
      ]),
      buildOrganizationStructuredData({
        name: "ТЕХАКС",
        url: "https://techaks.ru",
        logo: "https://techaks.ru/images/logo-light.svg",
        email: siteProfile?.contacts.email || "tech.aks@yandex.ru",
        phone: siteProfile?.contacts.primaryPhoneDisplay || "+7 (927) 364-28-88",
        address: getPublicSchemaAddress({
          shortAddress: siteProfile?.contacts.shortAddress,
          fullAddress: siteProfile?.contacts.fullAddress,
          legalAddress: siteProfile?.seller.legalAddress,
        }),
      }),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Акции и спецпредложения ТЕХАКС",
        description:
          "Актуальные акции, скидки и спецпредложения ТЕХАКС на технику и аксессуары.",
        url: "https://techaks.ru/promotions",
      },
    ],
  });

  return (
    <div className="min-h-screen pb-20 bg-background text-foreground">
      {/* Hero */}
      <section className="relative overflow-hidden py-10 md:py-14">
        <div className="absolute inset-0 bg-background z-0" />
        <div className="absolute right-0 top-0 h-full w-[50%] rounded-full bg-[#05C3D4]/5 blur-[120px]" />
        <div className="container-main relative z-10 text-center">
          <span className="mb-3 block text-[9px] font-black uppercase tracking-[0.28em] text-[#05C3D4] md:text-[10px]">
            Digital Витрина
          </span>
          <h1 className="text-3xl font-black uppercase font-heading leading-none tracking-tighter text-foreground md:text-5xl lg:text-6xl">
            АКЦИИ <span className="text-muted-foreground/30">И ВЫГОДА</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-medium text-muted-foreground md:mt-5 md:text-base">
            Следите за нашими новостями, чтобы не пропустить лучшие цены на
            любимую технику и аксессуары.
          </p>
        </div>
      </section>

      {isLoading ? (
        <section className="py-24">
          <div className="container-main">
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-[#05C3D4]" size={48} />
            </div>
          </div>
        </section>
      ) : banners.length > 0 ? (
        <section className="py-12 md:py-20">
          <div className="container-main">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {banners.map(promo => (
                <Link
                  key={promo.id}
                  to={promo.slug ? `/promotions/${promo.slug}` : "#"}
                  className="group bg-card border border-border rounded-[2rem] overflow-hidden hover:border-[#05C3D4]/20 transition-all duration-300 flex flex-col h-full shadow-sm hover:shadow-xl"
                >
                  <div className="h-72 overflow-hidden bg-foreground/5 relative">
                    <img
                      src={promo.image}
                      alt={promo.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-60" />
                    <span className="absolute bottom-6 left-6 px-3 py-1 bg-[#05C3D4] text-white dark:text-black text-[10px] font-black uppercase tracking-widest rounded-md">
                      Акция
                    </span>
                  </div>
                  <div className="p-10 flex flex-col flex-1">
                    <h3 className="text-2xl md:text-3xl font-black uppercase font-heading tracking-tight leading-tight text-foreground mb-4 group-hover:text-[#05C3D4] transition-colors">
                      {promo.title}
                    </h3>
                    <p className="text-muted-foreground font-medium leading-relaxed mb-10 flex-1 line-clamp-3">
                      {promo.subtitle}
                    </p>
                    <div className="inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4] group-hover:gap-5 transition-all">
                      Узнать подробнее
                      <ArrowRight size={16} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="pb-20 md:pb-24">
        <div className="container-main">
          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileFilterOpen(current => !current)}
                className="flex w-full items-center justify-between rounded-[24px] bg-card/80 px-4 py-3 text-left ring-1 ring-border/60 backdrop-blur-sm transition-colors hover:bg-card"
                aria-expanded={mobileFilterOpen}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tech-color-primary)]/12 text-[var(--tech-color-primary)]">
                    <SlidersHorizontal size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                      Категории
                    </div>
                    <div className="truncate text-sm font-semibold text-foreground">
                      {activeCategory === "all"
                        ? "Все акционные товары"
                        : promotionalCategories.find(category => category.slug === activeCategory)
                            ?.name || "Все акционные товары"}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted-foreground transition-transform ${
                    mobileFilterOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {mobileFilterOpen ? (
                <div className="mt-3 space-y-2 rounded-[28px] bg-card/80 p-4 ring-1 ring-border/60 backdrop-blur-sm">
                  <button
                    type="button"
                    onClick={() => selectCategory("all")}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      activeCategory === "all"
                        ? "bg-[#05C3D4]/20 text-white ring-1 ring-[#05C3D4]/45"
                        : "text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                    }`}
                  >
                    <span>Все акционные товары</span>
                    <span className="text-xs font-bold text-[#05C3D4]">
                      {allPromotionalProductsLabel}
                    </span>
                  </button>

                  {promotionalCategories.map(category => (
                    <button
                      key={`mobile-${category.id}`}
                      type="button"
                      onClick={() => selectCategory(category.slug)}
                      className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                        activeCategory === category.slug
                          ? "bg-[#05C3D4]/20 text-white ring-1 ring-[#05C3D4]/45"
                          : "text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                      }`}
                    >
                      <span className="min-w-0 truncate">{category.name}</span>
                      <span className="shrink-0 text-xs font-bold text-[#05C3D4]">
                        {category.productCount}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
              <div className="space-y-2 rounded-[32px] bg-card/70 p-4 md:p-5">
                <button
                  type="button"
                  onClick={() => selectCategory("all")}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                    activeCategory === "all"
                      ? "bg-[#05C3D4]/18 text-foreground ring-1 ring-[#05C3D4]/40"
                      : "text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                  }`}
                >
                  <span>Все акционные товары</span>
                  <span className="text-xs font-bold text-[var(--tech-color-primary)]">
                    {allPromotionalProductsLabel}
                  </span>
                </button>

                {promotionalCategories.map(category => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => selectCategory(category.slug)}
                    className={`flex w-full items-center justify-between gap-4 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                      activeCategory === category.slug
                        ? "bg-[#05C3D4]/18 text-foreground ring-1 ring-[#05C3D4]/40"
                        : "text-[var(--tech-color-text-muted)] hover:bg-[var(--tech-color-surface-muted)] hover:text-[var(--tech-color-text-main)]"
                    }`}
                  >
                    <span className="min-w-0 truncate">{category.name}</span>
                    <span className="shrink-0 text-xs font-bold text-[var(--tech-color-primary)]">
                      {category.productCount}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-w-0">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
                <div className="space-y-2">
                  <span className="block text-[10px] font-black uppercase tracking-[0.3em] text-[#05C3D4]">
                    Товары со скидкой
                  </span>
                  <h2 className="text-2xl font-black uppercase tracking-tight text-foreground md:text-4xl">
                    Акционные товары
                  </h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    {promotionalProductsLabel}
                  </p>
                </div>
              </div>

              {isPromotionalLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="animate-spin text-[#05C3D4]" size={42} />
                </div>
              ) : promotionalProducts.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
                  {promotionalProducts.map(product => (
                    <ProductCard key={product.id} product={product as any} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[32px] bg-card/60 p-10 text-center">
                  <h3 className="text-xl font-black text-foreground">
                    Сейчас нет товаров со скидкой
                  </h3>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Попробуйте открыть другую категорию или вернуться в каталог.
                  </p>
                  <Link
                    to="/catalog"
                    className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--tech-color-primary)] px-6 py-3 text-sm font-bold text-[var(--tech-color-primary-foreground)] transition-opacity hover:opacity-90"
                  >
                    Перейти в каталог
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
