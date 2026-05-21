import { useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { applyThemeToElement } from "./theme-runtime";

export default function DesignThemeBridge() {
  const { data } = trpc.designSystem.getPublishedTheme.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!data?.theme || typeof document === "undefined") return;
    applyThemeToElement(document.documentElement, data.theme);
  }, [data?.theme]);

  return null;
}
