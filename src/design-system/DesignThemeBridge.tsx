import { useEffect } from "react";
import { useLocation } from "react-router";
import { useTheme } from "next-themes";
import { trpc } from "@/providers/trpc";
import { applyThemeToElement } from "./theme-runtime";

export default function DesignThemeBridge() {
  const { pathname } = useLocation();
  const { resolvedTheme } = useTheme();
  const { data } = trpc.designSystem.getPublishedTheme.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data?.theme || typeof document === "undefined") return;

    const root = document.documentElement;
    const isAdminRoute = pathname.startsWith("/admin");
    const isDarkSiteTheme = resolvedTheme === "dark";

    if (isAdminRoute) {
      root.classList.remove("dark");
      applyThemeToElement(root, data.theme.admin);
      return;
    }

    root.classList.toggle("dark", isDarkSiteTheme);
    applyThemeToElement(root, isDarkSiteTheme ? data.theme.siteDark : data.theme.siteLight);
  }, [data?.theme, pathname, resolvedTheme]);

  return null;
}
