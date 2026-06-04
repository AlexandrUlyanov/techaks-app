import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FolderTree,
  Globe,
  ImageIcon,
  Loader2,
  Package,
  RefreshCw,
  Rss,
  ScrollText,
  Store,
  Tags,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

function IssueBadge({ issue }: { issue: string }) {
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700">
      {issue}
    </span>
  );
}

function SampleCard({
  title,
  subtitle,
  issues,
  to,
}: {
  title: string;
  subtitle?: string;
  issues: string[];
  to?: string;
}) {
  const content = (
    <div className="space-y-3 rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-4 transition-colors hover:bg-[color:color-mix(in_srgb,var(--tech-color-surface-muted)_72%,white)]">
      <div className="space-y-1">
        <div className="font-semibold text-[var(--tech-color-text-main)]">{title}</div>
        {subtitle ? (
          <div className="text-sm text-[var(--tech-color-text-muted)]">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {issues.map(issue => (
          <IssueBadge key={issue} issue={issue} />
        ))}
      </div>
    </div>
  );

  if (!to) return content;

  return (
    <Link to={to} className="block">
      {content}
    </Link>
  );
}

export default function AdminSeoDashboard() {
  const utils = trpc.useUtils();
  const query = trpc.settings.getSeoHealth.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контент и система"
        title="SEO"
        description="Здесь мы держим под контролем индексацию, качество контента и коммерческие сигналы под Яндекс. Дашборд показывает не абстрактные советы, а реальные проблемы витрины."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--tech-radius-button)] border border-border bg-background px-5 text-[11px] font-black uppercase tracking-widest text-foreground transition hover:bg-muted"
            >
              <Globe size={16} />
              Sitemap
            </a>
            <a
              href="/feeds/yandex-business.yml"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center gap-2 rounded-[var(--tech-radius-button)] border border-border bg-background px-5 text-[11px] font-black uppercase tracking-widest text-foreground transition hover:bg-muted"
            >
              <Rss size={16} />
              YML
            </a>
            <Button
              variant="outline"
              onClick={() => utils.settings.getSeoHealth.invalidate()}
              disabled={query.isFetching}
            >
              <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} />
              Обновить
            </Button>
          </div>
        }
      />

      {query.isLoading ? (
        <AdminSection title="Загрузка" description="Собираю сводку по SEO и индексации.">
          <div className="flex items-center gap-3 rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-5 text-sm text-[var(--tech-color-text-muted)]">
            <Loader2 size={18} className="animate-spin" />
            Загружаем SEO health dashboard...
          </div>
        </AdminSection>
      ) : null}

      {query.error ? (
        <AdminSection title="Ошибка" description="Не удалось собрать SEO-метрики.">
          <div className="rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-700">
            {query.error.message}
          </div>
        </AdminSection>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminStatCard
              label="Публичных товаров"
              value={data.products.visible}
              hint={`Всего товаров: ${data.products.total}`}
              icon={Package}
              tone="success"
            />
            <AdminStatCard
              label="Проблем по товарам"
              value={
                data.products.withoutDescription +
                data.products.withoutImage +
                data.products.withoutArticle +
                data.products.withoutBarcode +
                data.products.withoutBrand
              }
              hint="Описание, изображения, коды, бренд"
              icon={AlertTriangle}
              tone="warning"
            />
            <AdminStatCard
              label="Пустые leaf-категории"
              value={data.categories.emptyLeafCount}
              hint={`Категорий без описания: ${data.categories.withoutDescription}`}
              icon={FolderTree}
              tone={data.categories.emptyLeafCount > 0 ? "warning" : "default"}
            />
            <AdminStatCard
              label="Yandex YML"
              value={data.feed.enabled ? "Включён" : "Выключен"}
              hint={data.feed.baseUrl}
              icon={Rss}
              tone={data.feed.enabled ? "accent" : "default"}
            />
          </div>

          <AdminSection
            title="Товары"
            description="Критичные SEO-дыры по карточкам товаров: контент, изображения, коды, бренд."
            actions={
              <Link
                to="/admin/products"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--tech-color-primary)]"
              >
                К товарам
                <ArrowRight size={16} />
              </Link>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <AdminStatCard label="Без описания" value={data.products.withoutDescription} icon={ScrollText} tone={data.products.withoutDescription > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без изображения" value={data.products.withoutImage} icon={ImageIcon} tone={data.products.withoutImage > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без артикула" value={data.products.withoutArticle} icon={Tags} tone={data.products.withoutArticle > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без штрихкода" value={data.products.withoutBarcode} icon={FileSearch} tone={data.products.withoutBarcode > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без бренда" value={data.products.withoutBrand} icon={AlertTriangle} tone={data.products.withoutBrand > 0 ? "warning" : "default"} />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {data.products.samples.length > 0 ? (
                data.products.samples.map(product => (
                  <SampleCard
                    key={product.id}
                    title={product.name}
                    subtitle={`/product/${product.slug}`}
                    issues={product.issues}
                    to="/admin/products"
                  />
                ))
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 size={16} />
                    По товарам критичных примеров не найдено.
                  </div>
                </div>
              )}
            </div>
          </AdminSection>

          <div className="grid gap-6 xl:grid-cols-2">
            <AdminSection
              title="Категории"
              description="Смотрим пустые конечные категории и категории без описания."
              actions={
                <Link
                  to="/admin/categories"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--tech-color-primary)]"
                >
                  Открыть категории
                  <ArrowRight size={16} />
                </Link>
              }
            >
              <div className="grid gap-4 md:grid-cols-2">
                <AdminStatCard label="Всего категорий" value={data.categories.total} icon={FolderTree} />
                <AdminStatCard label="Без описания" value={data.categories.withoutDescription} icon={ScrollText} tone={data.categories.withoutDescription > 0 ? "warning" : "default"} />
                <AdminStatCard label="Без SEO title" value={data.categories.withoutMetaTitle} icon={Tags} tone={data.categories.withoutMetaTitle > 0 ? "warning" : "default"} />
                <AdminStatCard label="Без SEO description" value={data.categories.withoutMetaDescription} icon={FileSearch} tone={data.categories.withoutMetaDescription > 0 ? "warning" : "default"} />
              </div>

              <div className="mt-5 space-y-3">
                {data.categories.samples.length > 0 ? (
                  data.categories.samples.map(category => (
                    <SampleCard
                      key={category.id}
                      title={category.name}
                      subtitle={`/catalog?cat=${category.slug}`}
                      issues={category.issues}
                      to="/admin/categories"
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} />
                      Пустых и проблемных категорий в выборке не найдено.
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 rounded-2xl bg-[var(--tech-color-surface-muted)] px-4 py-4 text-sm text-[var(--tech-color-text-muted)]">
                <div className="font-semibold text-[var(--tech-color-text-main)]">Индексная политика категорий</div>
                <div className="mt-2">
                  Базовые категории индексируем. Фильтры, сортировки и layout-режимы канонизируются на базовый URL категории и не должны раздувать индекс Яндекса.
                </div>
                <div className="mt-3 text-xs">
                  Повторяющихся названий категорий: <span className="font-bold text-[var(--tech-color-text-main)]">{data.categories.duplicateNames}</span>
                </div>
              </div>
            </AdminSection>

            <AdminSection
              title="Блог"
              description="Проверяем базовые SEO-поля редакционного контура: meta title, meta description и изображение."
              actions={
                <Link
                  to="/admin/blog"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--tech-color-primary)]"
                >
                  Открыть блог
                  <ArrowRight size={16} />
                </Link>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminStatCard label="Всего материалов" value={data.blog.total} icon={ScrollText} />
                <AdminStatCard label="Опубликованы" value={data.blog.published} icon={CheckCircle2} tone="success" />
                <AdminStatCard label="Без meta title" value={data.blog.withoutMetaTitle} icon={FileSearch} tone={data.blog.withoutMetaTitle > 0 ? "warning" : "default"} />
                <AdminStatCard label="Без meta description" value={data.blog.withoutMetaDescription} icon={AlertTriangle} tone={data.blog.withoutMetaDescription > 0 ? "warning" : "default"} />
              </div>

              <div className="mt-5 space-y-3">
                {data.blog.samples.length > 0 ? (
                  data.blog.samples.map(post => (
                    <SampleCard
                      key={post.id}
                      title={post.title}
                      subtitle={`/blog/${post.slug}`}
                      issues={post.issues}
                      to="/admin/blog"
                    />
                  ))
                ) : (
                  <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={16} />
                      У материалов блога базовые SEO-поля заполнены.
                    </div>
                  </div>
                )}
              </div>
            </AdminSection>
          </div>

          <AdminSection
            title="Магазины и коммерческие сигналы"
            description="Для Яндекса важны реальные адреса, контакты, часы работы и доступность офлайн-точек."
            actions={
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/admin/stores"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--tech-color-primary)]"
                >
                  Магазины
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="/stores"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--tech-color-primary)]"
                >
                  Витрина
                  <ExternalLink size={16} />
                </a>
              </div>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminStatCard label="Магазинов" value={data.stores.total} icon={Store} />
              <AdminStatCard label="Без карты" value={data.stores.withoutMapUrl} icon={Globe} tone={data.stores.withoutMapUrl > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без телефона" value={data.stores.withoutPhone} icon={Store} tone={data.stores.withoutPhone > 0 ? "warning" : "default"} />
              <AdminStatCard label="Без часов работы" value={data.stores.withoutHours} icon={Store} tone={data.stores.withoutHours > 0 ? "warning" : "default"} />
            </div>
          </AdminSection>
        </>
      ) : null}
    </div>
  );
}
