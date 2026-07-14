import { useLayoutEffect } from "react";
import { useLocation } from "react-router";
import { useTheme } from "next-themes";
import { trpc } from "@/providers/trpc";
import { applyThemeToElement, clearThemeFromElement } from "./theme-runtime";

export default function DesignThemeBridge() {
  const { pathname } = useLocation();
  const { resolvedTheme } = useTheme();
  const { data } = trpc.designSystem.getPublishedTheme.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    const root = document.documentElement;
    const isAdminRoute = pathname.startsWith("/admin");
    const isDarkSiteTheme = resolvedTheme === "dark";

    // Themes are applied as inline variables, so changing only the `dark` class
    // leaves the previous storefront palette active until the API query resolves.
    clearThemeFromElement(root);

    if (isAdminRoute) {
      root.classList.remove("dark");
      root.dataset.themeScope = "admin";
      // next-themes writes color-scheme as an inline style. Without resetting it,
      // native inputs and selects remain dark even after the storefront palette
      // and the `dark` class have been removed.
      root.style.colorScheme = "light";
      if (data?.theme) {
        applyThemeToElement(root, data.theme.admin);
      }
      return;
    }

    root.dataset.themeScope = "site";
    root.classList.toggle("dark", isDarkSiteTheme);
    root.style.colorScheme = isDarkSiteTheme ? "dark" : "light";
    if (data?.theme) {
      applyThemeToElement(root, isDarkSiteTheme ? data.theme.siteDark : data.theme.siteLight);
    }
  }, [data?.theme, pathname, resolvedTheme]);

  return null;
}
