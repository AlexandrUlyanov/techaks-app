import { useEffect } from "react";
import { useLocation } from "react-router";

const SITE_URL = "https://techaks.ru";
const DEFAULT_TITLE = "ТЕХАКС — интернет-магазин техники и аксессуаров";
const DEFAULT_DESCRIPTION =
  "Техника и аксессуары в Пензе: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, самовывоз в Пензе и доставка по России.";

type SeoInput = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
  image?: string;
  type?: "website" | "article";
  structuredData?:
    | Record<string, unknown>
    | Array<Record<string, unknown>>
    | null;
};

function ensureMeta(name: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }
  return element;
}

function ensurePropertyMeta(property: string) {
  let element = document.querySelector<HTMLMetaElement>(
    `meta[property="${property}"]`
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }
  return element;
}

function ensureCanonical() {
  let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  return element;
}

function ensureStructuredData() {
  let element = document.querySelector<HTMLScriptElement>(
    'script[data-seo="structured-data"]'
  );
  if (!element) {
    element = document.createElement("script");
    element.setAttribute("type", "application/ld+json");
    element.setAttribute("data-seo", "structured-data");
    document.head.appendChild(element);
  }
  return element;
}

export function useSeo(input: SeoInput) {
  const location = useLocation();

  useEffect(() => {
    const title = input.title?.trim() || DEFAULT_TITLE;
    const description = input.description?.trim() || DEFAULT_DESCRIPTION;

    document.title = title;

    const descriptionMeta = ensureMeta("description");
    descriptionMeta.setAttribute("content", description);

    const robotsMeta = ensureMeta("robots");
    robotsMeta.setAttribute(
      "content",
      input.noindex ? "noindex, nofollow" : "index, follow"
    );

    const canonical = ensureCanonical();
    const path = input.canonicalPath ?? location.pathname;
    const canonicalUrl = `${SITE_URL}${path}`;
    canonical.setAttribute("href", canonicalUrl);

    const ogTitle = ensurePropertyMeta("og:title");
    ogTitle.setAttribute("content", title);

    const ogDescription = ensurePropertyMeta("og:description");
    ogDescription.setAttribute("content", description);

    const ogType = ensurePropertyMeta("og:type");
    ogType.setAttribute("content", input.type || "website");

    const ogUrl = ensurePropertyMeta("og:url");
    ogUrl.setAttribute("content", canonicalUrl);

    const twitterCard = ensureMeta("twitter:card");
    twitterCard.setAttribute("content", input.image ? "summary_large_image" : "summary");

    const twitterTitle = ensureMeta("twitter:title");
    twitterTitle.setAttribute("content", title);

    const twitterDescription = ensureMeta("twitter:description");
    twitterDescription.setAttribute("content", description);

    const image = input.image?.trim();
    const ogImage = ensurePropertyMeta("og:image");
    const twitterImage = ensureMeta("twitter:image");
    if (image) {
      const fullImage = image.startsWith("http") ? image : `${SITE_URL}${image}`;
      ogImage.setAttribute("content", fullImage);
      twitterImage.setAttribute("content", fullImage);
    } else {
      ogImage.remove();
      twitterImage.remove();
    }

    const structuredDataNode = ensureStructuredData();
    if (input.structuredData) {
      structuredDataNode.textContent = JSON.stringify(input.structuredData);
    } else {
      structuredDataNode.textContent = "";
    }
  }, [
    input.canonicalPath,
    input.description,
    input.image,
    input.noindex,
    input.structuredData,
    input.title,
    input.type,
    location.pathname,
  ]);
}

export function buildCanonical(pathname: string) {
  return `${SITE_URL}${pathname}`;
}
