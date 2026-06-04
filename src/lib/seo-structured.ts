type BreadcrumbItem = {
  name: string;
  path: string;
};

const SITE_URL = "https://techaks.ru";

function guessAddressLocality(address?: string | null) {
  const normalized = address?.toLowerCase() ?? "";
  if (normalized.includes("пенз")) return "Пенза";
  if (normalized.includes("зареч")) return "Заречный";
  return undefined;
}

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
    ...(input.phone || input.email
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            telephone: input.phone || undefined,
            email: input.email || undefined,
            availableLanguage: ["ru"],
            areaServed: ["RU", "Пенза"],
          },
        }
      : {}),
    areaServed: ["RU", "Пенза"],
    ...(input.address
      ? {
          address: {
            "@type": "PostalAddress",
            streetAddress: input.address,
            addressLocality: guessAddressLocality(input.address),
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
            addressLocality: guessAddressLocality(store.address),
            addressCountry: "RU",
          },
        }
      : {}),
    ...(store.hours ? { openingHours: [store.hours] } : {}),
    ...(store.mapUrl ? { hasMap: store.mapUrl } : {}),
    areaServed: ["RU", "Пенза"],
  };
}
