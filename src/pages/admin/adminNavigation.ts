import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileText,
  FolderTree,
  Gift,
  Globe,
  History,
  LayoutDashboard,
  Layers3,
  MapPinned,
  MessageSquare,
  Package,
  Palette,
  RefreshCw,
  Rss,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Store,
  TrendingUp,
  Wallet,
} from "lucide-react";

export type AdminNavItem = {
  children?: AdminNavItem[];
  href: string;
  icon?: LucideIcon;
  id: string;
  match?: (pathname: string) => boolean;
  name: string;
};

export type AdminNavGroup = {
  items: AdminNavItem[];
  title: string;
};

type BuildAdminNavigationOptions = {
  canReadDesignSystem: boolean;
  canReadFeeds: boolean;
  canReadSearch: boolean;
  canReadSeo: boolean;
  canConfigureSettings: boolean;
};

const hrefStartsWith =
  (href: string) =>
  (pathname: string): boolean =>
    pathname === href || pathname.startsWith(`${href}/`);

export function buildAdminNavigation(
  options: BuildAdminNavigationOptions
): AdminNavGroup[] {
  return [
    {
      title: "Операции",
      items: [
        { id: "dashboard", name: "Дашборд", href: "/admin", icon: LayoutDashboard },
        { id: "orders", name: "Заказы", href: "/admin/leads", icon: MessageSquare },
        { id: "reservations", name: "Резервы", href: "/admin/reservations", icon: MapPinned },
        { id: "reviews", name: "Отзывы", href: "/admin/reviews", icon: Star },
        { id: "loyalty", name: "Лояльность", href: "/admin/loyalty", icon: Wallet },
        {
          id: "sync",
          name: "Синхронизации",
          href: "/admin/sync",
          icon: RefreshCw,
          match: hrefStartsWith("/admin/sync"),
          children: [
            {
              id: "sync-moysklad",
              name: "МойСклад",
              href: "/admin/sync/moysklad",
              match: hrefStartsWith("/admin/sync/moysklad"),
              children: [
                {
                  id: "sync-moysklad-orders",
                  name: "Заказы customerorder",
                  href: "/admin/sync/moysklad/orders",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      title: "Каталог",
      items: [
        { id: "categories", name: "Категории", href: "/admin/categories", icon: FolderTree },
        { id: "listings", name: "Листинги", href: "/admin/listings", icon: Layers3 },
        {
          id: "products",
          name: "Товары",
          href: "/admin/products",
          icon: Package,
          match: hrefStartsWith("/admin/products"),
          children: [
            { id: "products-list", name: "Список товаров", href: "/admin/products" },
            { id: "products-settings", name: "Настройки товаров", href: "/admin/products/settings" },
            { id: "products-specs", name: "Все характеристики", href: "/admin/products/specs" },
            {
              id: "products-manufacturers",
              name: "Производители",
              href: "/admin/products/manufacturers",
            },
          ],
        },
        { id: "stores", name: "Магазины", href: "/admin/stores", icon: Store },
        {
          id: "merchandising",
          name: "Мерчендайзинг",
          href: "/admin/merchandising",
          icon: TrendingUp,
          match: hrefStartsWith("/admin/merchandising"),
          children: [
            { id: "merch-badges", name: "Каталог бейджей", href: "/admin/merchandising/badges" },
            { id: "merch-ai", name: "AI-генерация", href: "/admin/merchandising/ai", icon: Bot },
            {
              id: "merch-assignments",
              name: "Назначения",
              href: "/admin/merchandising/assignments",
              icon: Sparkles,
            },
            {
              id: "merch-quality",
              name: "Качество",
              href: "/admin/merchandising/quality",
              icon: ShieldCheck,
            },
          ],
        },
        {
          id: "normalize-specs",
          name: "Нормализация",
          href: "/admin/normalize-specs",
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      title: "Контент и система",
      items: [
        { id: "banners", name: "Акции", href: "/admin/banners", icon: Gift },
        { id: "blog", name: "Блог", href: "/admin/blog", icon: FileText },
        ...(options.canReadSearch
          ? [
              {
                id: "search",
                name: "Поиск",
                href: "/admin/search/settings",
                icon: Search,
                match: hrefStartsWith("/admin/search"),
                children: [
                  { id: "search-settings", name: "Настройки", href: "/admin/search/settings" },
                  { id: "search-synonyms", name: "Синонимы", href: "/admin/search/synonyms" },
                  { id: "search-analytics", name: "Аналитика", href: "/admin/search/analytics" },
                ],
              },
            ]
          : []),
        ...(options.canReadDesignSystem
          ? [
              {
                id: "design-system",
                name: "Дизайн-система",
                href: "/admin/design-system",
                icon: Palette,
              },
            ]
          : []),
        ...(options.canConfigureSettings
          ? [{ id: "audit", name: "Журнал", href: "/admin/audit", icon: History }]
          : []),
        ...(options.canReadFeeds
          ? [{ id: "feeds", name: "Фиды", href: "/admin/feeds", icon: Rss }]
          : []),
        ...(options.canReadSeo
          ? [
              {
                id: "seo",
                name: "SEO и рост",
                href: "/admin/seo",
                icon: Globe,
                match: hrefStartsWith("/admin/seo"),
                children: [
                  {
                    id: "seo-overview",
                    name: "Обзор",
                    href: "/admin/seo",
                  },
                  {
                    id: "seo-wordstat",
                    name: "Wordstat и кластеры",
                    href: "/admin/seo/wordstat",
                  },
                ],
              },
            ]
          : []),
        {
          id: "settings",
          name: "Настройки",
          href: "/admin/settings/profile",
          icon: Settings,
          match: hrefStartsWith("/admin/settings"),
          children: [
            {
              id: "settings-profile",
              name: "Профиль",
              href: "/admin/settings/profile",
            },
            {
              id: "settings-access",
              name: "Доступ и роли",
              href: "/admin/settings/access",
            },
            {
              id: "settings-ai",
              name: "ИИ и сервисы",
              href: "/admin/settings/ai",
            },
            {
              id: "settings-integrations",
              name: "Интеграции",
              href: "/admin/settings/integrations",
            },
            {
              id: "settings-payments",
              name: "Платежи",
              href: "/admin/settings/payment",
              match: hrefStartsWith("/admin/settings/payment"),
              children: [
                {
                  id: "settings-payments-yookassa",
                  name: "YooKassa",
                  href: "/admin/settings/payment/yookassa",
                },
              ],
            },
            {
              id: "settings-site",
              name: "Сайт",
              href: "/admin/settings/site",
            },
          ],
        },
      ],
    },
  ];
}

export function matchAdminNavItem(item: AdminNavItem, pathname: string): boolean {
  if (item.match ? item.match(pathname) : pathname === item.href) {
    return true;
  }

  return item.children?.some(child => matchAdminNavItem(child, pathname)) ?? false;
}

export function findAdminNavPath(
  groups: AdminNavGroup[],
  pathname: string
): { group: string; items: AdminNavItem[] } | null {
  for (const group of groups) {
    for (const item of group.items) {
      const items = findNestedPath(item, pathname);
      if (items.length > 0) {
        return { group: group.title, items };
      }
    }
  }

  return null;
}

export function collectExpandedAdminNavIds(
  groups: AdminNavGroup[],
  pathname: string
): Set<string> {
  const expanded = new Set<string>();

  for (const group of groups) {
    for (const item of group.items) {
      markExpandedAncestors(item, pathname, expanded);
    }
  }

  return expanded;
}

function findNestedPath(item: AdminNavItem, pathname: string): AdminNavItem[] {
  const selfMatches = item.match ? item.match(pathname) : pathname === item.href;
  if (selfMatches) {
    for (const child of item.children ?? []) {
      const childPath = findNestedPath(child, pathname);
      if (childPath.length > 0) {
        return [item, ...childPath];
      }
    }
    return [item];
  }

  for (const child of item.children ?? []) {
    const childPath = findNestedPath(child, pathname);
    if (childPath.length > 0) {
      return [item, ...childPath];
    }
  }

  return [];
}

function markExpandedAncestors(
  item: AdminNavItem,
  pathname: string,
  expanded: Set<string>
): boolean {
  const childMatches =
    item.children?.some(child => markExpandedAncestors(child, pathname, expanded)) ?? false;
  const selfMatches = item.match ? item.match(pathname) : pathname === item.href;

  if (childMatches) {
    expanded.add(item.id);
  }

  return selfMatches || childMatches;
}
