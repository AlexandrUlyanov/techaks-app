type BreadcrumbItem = {
  name: string;
  path: string;
};

const SITE_URL = "https://techaks.ru";

export function buildBreadcrumbStructuredData(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.path}`,
    })),
  };
}

export function buildOrganizationStructuredData(input: {
  name: string;
  url?: string;
  logo?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: input.url || SITE_URL,
    ...(input.logo ? { logo: input.logo.startsWith("http") ? input.logo : `${SITE_URL}${input.logo}` } : {}),
    ...(input.email ? { email: input.email } : {}),
    ...(input.phone ? { telephone: input.phone } : {}),
    ...(input.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: input.address,
            addressCountry: "RU",
          },
        }
      : {}),
  };
}

export function buildStoreStructuredData(store: {
  name: string;
  phone?: string | null;
  address?: string | null;
  image?: string | null;
  mapUrl?: string | null;
  hours?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    ...(store.image
      ? {
          image: store.image.startsWith("http")
            ? store.image
            : `${SITE_URL}${store.image}`,
        }
      : {}),
    ...(store.phone ? { telephone: store.phone } : {}),
    ...(store.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: store.address,
            addressCountry: "RU",
          },
        }
      : {}),
    ...(store.hours ? { openingHours: [store.hours] } : {}),
    ...(store.mapUrl ? { hasMap: store.mapUrl } : {}),
  };
}
