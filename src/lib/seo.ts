import { useEffect } from "react";
import { useLocation } from "react-router";

const SITE_URL = "https://techaks.ru";
const DEFAULT_TITLE = "ТЕХАКС — интернет-магазин техники и аксессуаров";
const DEFAULT_DESCRIPTION =
  "Техника и аксессуары: смартфоны, наушники, зарядные устройства, кабели, чехлы и гаджеты. Актуальные цены, наличие и доставка.";

type SeoInput = {
  title?: string;
  description?: string;
  canonicalPath?: string;
  noindex?: boolean;
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

function ensureCanonical() {
  let element = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
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
    canonical.setAttribute("href", `${SITE_URL}${path}`);
  }, [input.canonicalPath, input.description, input.noindex, input.title, location.pathname]);
}

export function buildCanonical(pathname: string) {
  return `${SITE_URL}${pathname}`;
}

