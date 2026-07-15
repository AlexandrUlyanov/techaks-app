const DEFAULT_SITE_ORIGIN = "https://techaks.ru";
const DEFAULT_MAX_ITEMS = 3;

export type SeoBreadcrumbSourceItem = {
  name: string;
  url: string;
};

type BuildSeoBreadcrumbOptions = {
  siteOrigin?: string;
  maxItems?: number;
};

export type SeoBreadcrumbStructuredData = {
  "@context": "https://schema.org";
  "@type": "BreadcrumbList";
  itemListElement: Array<{
    "@type": "ListItem";
    position: number;
    name: string;
    item: string;
    url: string;
  }>;
};

function normalizeBreadcrumbUrl(value: string, siteOrigin: string) {
  try {
    const origin = new URL(siteOrigin);
    const url = new URL(value, origin);

    if (url.origin !== origin.origin) return null;

    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function compactBreadcrumbs(
  items: SeoBreadcrumbSourceItem[],
  siteOrigin: string,
  maxItems: number
) {
  const normalized: SeoBreadcrumbSourceItem[] = [];
  const seenUrls = new Set<string>();

  for (const item of items) {
    const name = item.name.replace(/\s+/g, " ").trim();
    const url = normalizeBreadcrumbUrl(item.url, siteOrigin);
    if (!name || !url || seenUrls.has(url)) continue;

    seenUrls.add(url);
    normalized.push({ name, url });
  }

  if (normalized.length > 2) {
    const siteUrl = new URL(siteOrigin);
    const firstUrl = new URL(normalized[0].url);
    const isHomepage =
      firstUrl.origin === siteUrl.origin &&
      firstUrl.pathname === "/" &&
      !firstUrl.search;

    if (isHomepage) normalized.shift();
  }

  if (normalized.length <= maxItems) return normalized;

  return [normalized[0], ...normalized.slice(-(maxItems - 1))];
}

export function buildSeoBreadcrumbStructuredData(
  items: SeoBreadcrumbSourceItem[],
  options: BuildSeoBreadcrumbOptions = {}
): SeoBreadcrumbStructuredData | null {
  const siteOrigin = options.siteOrigin ?? DEFAULT_SITE_ORIGIN;
  const maxItems = Math.max(2, options.maxItems ?? DEFAULT_MAX_ITEMS);
  const breadcrumbs = compactBreadcrumbs(items, siteOrigin, maxItems);

  if (breadcrumbs.length < 2) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
      url: item.url,
    })),
  };
}
