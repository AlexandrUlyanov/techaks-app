import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

function normalizeSearchWithoutProductTab(search: string) {
  const params = new URLSearchParams(search);
  params.delete("tab");

  const normalized = params.toString();
  return normalized ? `?${normalized}` : "";
}

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();
  const previousLocationRef = useRef<{
    pathname: string;
    search: string;
    hash: string;
  } | null>(null);

  useEffect(() => {
    const previousLocation = previousLocationRef.current;

    if (previousLocation) {
      const isProductTabNavigation =
        pathname === previousLocation.pathname &&
        pathname.startsWith("/product/") &&
        normalizeSearchWithoutProductTab(search) ===
          normalizeSearchWithoutProductTab(previousLocation.search);

      if (isProductTabNavigation) {
        previousLocationRef.current = { pathname, search, hash };
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: "auto" });

    previousLocationRef.current = { pathname, search, hash };
  }, [pathname, search, hash]);

  return null;
}
