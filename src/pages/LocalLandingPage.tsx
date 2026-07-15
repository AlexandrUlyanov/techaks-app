import { Link, useParams } from "react-router";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  MoveRight,
  Sparkles,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";
import {
  buildBreadcrumbStructuredData,
  buildFaqStructuredData,
} from "@/lib/seo-structured";
import {
  buildBrandCatalogUrl,
  buildCatalogCategoryUrl,
  buildLocalLandingUrl,
  getLocalSeoLandingBySlug,
  localSeoLandings,
} from "@contracts/local-seo-landings";

function formatProductCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return `${count} товар`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} товара`;
  }

  return `${count} товаров`;
}

export default function LocalLandingPage() {
  const params = useParams<{ slug: string }>();
  const landing = getLocalSeoLandingBySlug(params.slug || "");
  const { data: manufacturers = [] } = trpc.manufacturer.getAll.useQuery(
    { onlyVisible: true, withProductsOnly: true },
    { staleTime: 5 * 60 * 1000 }
  );

  const faqStructuredData = buildFaqStructuredData(landing?.faqs ?? []);

  useSeo({
    title: landing?.title || "Подборка товаров в Пензе — ТЕХАКС",
    description:
      landing?.description ||
      "Локальная подборка категорий, брендов и переходов в каталог ТЕХАКС.",
    canonicalPath: landing ? buildLocalLandingUrl(landing.slug) : undefined,
    noindex: !landing,
    structuredData: landing
      ? [
          buildBreadcrumbStructuredData([
            { name: "Главная", path: "/" },
            { name: "Каталог", path: "/catalog" },
            { name: landing.h1, path: buildLocalLandingUrl(landing.slug) },
          ]),
          ...(faqStructuredData ? [faqStructuredData] : []),
        ]
      : undefined,
  });

  if (!landing) {
    return (
      <div className="bg-background text-foreground">
        <section className="container-main py-20 sm:py-24">
          <div className="max-w-2xl">
            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
              Пенза
            </span>
            <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-foreground">
              Подборка не найдена
            </h1>
            <p className="mt-4 text-[16px] leading-7 text-muted-foreground">
              Мы не нашли эту локальную страницу. Зато можно сразу перейти в каталог,
              бренды или магазины ТЕХАКС.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/catalog">
                  Перейти в каталог
                  <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/stores">Магазины</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const manufacturerMap = new Map(manufacturers.map(item => [item.slug, item] as const));
  const relatedLandings = landing.relatedSlugs
    .map(slug => getLocalSeoLandingBySlug(slug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="bg-background text-foreground">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="absolute inset-0">
          <div className="absolute left-[-10rem] top-[-9rem] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.14)_0%,rgba(5,195,212,0.03)_52%,transparent_76%)]" />
          <div className="absolute right-[-8rem] top-0 h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(5,195,212,0.1)_0%,rgba(5,195,212,0.02)_58%,transparent_78%)]" />
        </div>

        <div className="container-main relative py-20 sm:py-24 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:items-start">
            <div className="max-w-4xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_10%,transparent)] px-4 py-2 text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
                <MapPin className="h-4 w-4" />
                Пенза
              </span>
              <h1 className="mt-6 text-4xl font-black leading-[0.94] tracking-[-0.055em] text-foreground sm:text-5xl lg:text-[4.2rem]">
                {landing.h1}
              </h1>
              <p className="mt-5 max-w-3xl text-lg font-semibold leading-8 text-foreground/86">
                {landing.description}
              </p>
              <p className="mt-4 max-w-3xl text-[15px] leading-8 text-muted-foreground sm:text-[17px]">
                {landing.intro}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to={buildCatalogCategoryUrl(landing.primaryCategory.slug)}>
                    Открыть раздел
                    <ArrowRight />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/stores">Самовывоз и магазины</Link>
                </Button>
              </div>
            </div>

            <div className="rounded-[2rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-surface)_92%,transparent)_0%,color-mix(in_srgb,var(--tech-color-primary)_6%,var(--tech-color-surface-muted))_100%)] p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)] text-[#05C3D4]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                    Что здесь есть
                  </p>
                  <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                    Быстрый локальный вход в каталог
                  </p>
                </div>
              </div>
              <div className="mt-6 grid gap-3">
                {landing.supportPoints.map(point => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-[1.35rem] bg-background/76 px-4 py-4"
                  >
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#05C3D4]" />
                    <p className="text-[14px] leading-6 text-foreground/82">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-main py-14 sm:py-16 lg:py-20">
        <div className="flex items-end justify-between gap-6">
          <div className="max-w-3xl">
            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
              Категории
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-foreground sm:text-4xl">
              Куда перейти дальше
            </h2>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {landing.categoryLinks.map(item => {
            return (
              <Link
                key={item.slug}
                to={buildCatalogCategoryUrl(item.slug)}
                className="group flex min-h-[220px] flex-col rounded-[2rem] bg-[var(--tech-color-surface)] p-6 transition-[border-color] duration-200 hover:border-[color:color-mix(in_srgb,var(--tech-color-primary)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(5,195,212,0.35)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black leading-[1.05] tracking-[-0.03em] text-foreground">
                      {item.label}
                    </h3>
                    <p className="mt-4 text-[14px] leading-6 text-muted-foreground">
                      {item.note}
                    </p>
                  </div>
                  <MoveRight className="h-5 w-5 shrink-0 text-[#05C3D4]" />
                </div>
                <div className="mt-auto pt-6 text-[13px] font-semibold text-[#047987]">
                  Открыть подборку
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-main pb-14 sm:pb-16 lg:pb-20">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(280px,0.92fr)]">
          <div className="rounded-[2rem] bg-[var(--tech-color-surface)] p-6 sm:p-8">
            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
              Бренды
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-foreground sm:text-4xl">
              Подходящие производители
            </h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {landing.brandLinks.map(item => {
                const manufacturer = manufacturerMap.get(item.slug);
                return (
                  <Link
                    key={item.slug}
                    to={buildBrandCatalogUrl(item.slug)}
                    className="group rounded-[1.6rem] bg-background px-5 py-5 transition-[border-color] duration-200 hover:border-[color:color-mix(in_srgb,var(--tech-color-primary)_35%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(5,195,212,0.35)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black tracking-tight text-foreground">
                          {item.label}
                        </h3>
                        <p className="mt-3 text-[14px] leading-6 text-muted-foreground">
                          {item.note}
                        </p>
                      </div>
                      <MoveRight className="mt-1 h-4 w-4 shrink-0 text-[#05C3D4]" />
                    </div>
                    <div className="mt-5 text-[13px] font-semibold text-[#047987]">
                      {typeof manufacturer?.productCount === "number" &&
                      manufacturer.productCount > 0
                        ? formatProductCount(manufacturer.productCount)
                        : "Открыть бренд"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-[2rem] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--tech-color-primary)_6%,var(--tech-color-surface))_0%,color-mix(in_srgb,var(--tech-color-primary)_10%,var(--tech-color-surface-muted))_100%)] p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)] text-[#05C3D4]">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.24em] text-muted-foreground">
                  Самовывоз
                </p>
                <p className="mt-1 text-xl font-black tracking-tight text-foreground">
                  Магазины и получение
                </p>
              </div>
            </div>
            <p className="mt-5 text-[15px] leading-7 text-muted-foreground">
              Для локальных запросов важно быстро увидеть путь к получению: рядом
              всегда есть переход к магазинам ТЕХАКС, условиям самовывоза и
              подтверждению наличия.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/stores">Магазины ТЕХАКС</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/payment-delivery">Оплата и доставка</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="container-main pb-14 sm:pb-16 lg:pb-20">
        <div className="grid gap-4 lg:grid-cols-3">
          {landing.faqs.map(item => (
            <article
              key={item.question}
              className="rounded-[2rem] bg-[var(--tech-color-surface)] p-6"
            >
              <h2 className="text-xl font-black tracking-tight text-foreground">
                {item.question}
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      {relatedLandings.length > 0 ? (
        <section className="container-main pb-20 sm:pb-24">
          <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[#05C3D4]">
            Еще подборки
          </span>
          <div className="mt-4 flex flex-wrap gap-3">
            {relatedLandings.map(item => (
              <Link
                key={item.slug}
                to={buildLocalLandingUrl(item.slug)}
                className="inline-flex min-h-12 items-center rounded-full bg-[color:color-mix(in_srgb,var(--tech-color-primary)_9%,transparent)] px-5 text-sm font-bold text-foreground transition hover:bg-[color:color-mix(in_srgb,var(--tech-color-primary)_14%,transparent)]"
              >
                {item.h1}
              </Link>
            ))}
          </div>
          <div className="mt-8 text-sm text-muted-foreground">
            {localSeoLandings.length} локальных страницы первой волны уже готовы под
            коммерческий и answer-first спрос.
          </div>
        </section>
      ) : null}
    </div>
  );
}
