import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";

declare global {
  interface Window {
    ym?: (...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

const COOKIE_CONSENT_KEY = "techaks_cookie_consent";
const METRIKA_ID = 109574553;

type ConsentMode = "accepted" | "necessary";

function setConsentCookie(mode: ConsentMode) {
  document.cookie = `cookie_consent=${mode}; path=/; max-age=${60 * 60 * 24 * 365}`;
}

function ensureMetrikaLoaded() {
  if (typeof window === "undefined") return;
  if (document.querySelector(`script[data-yandex-metrika="${METRIKA_ID}"]`)) return;

  window.dataLayer = window.dataLayer || [];

  (
    window as Window & {
      ym?: ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };
    }
  ).ym =
    (window as Window & {
      ym?: ((...args: unknown[]) => void) & { a?: unknown[]; l?: number };
    }).ym ||
    function (...args: unknown[]) {
      const current = window.ym as ((...args: unknown[]) => void) & {
        a?: unknown[];
        l?: number;
      };
      current.a = current.a || [];
      current.a.push(args);
    };

  if (window.ym) {
    (window.ym as ((...args: unknown[]) => void) & { l?: number }).l = Number(new Date());
    window.ym(METRIKA_ID, "init", {
      ssr: true,
      webvisor: true,
      clickmap: true,
      ecommerce: "dataLayer",
      referrer: document.referrer,
      url: location.href,
      accurateTrackBounce: true,
      trackLinks: true,
    });
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`;
  script.dataset.yandexMetrika = String(METRIKA_ID);
  document.head.appendChild(script);
}

export default function CookieConsentBanner() {
  const [consent, setConsent] = useState<ConsentMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(COOKIE_CONSENT_KEY) as ConsentMode | null;
    if (stored === "accepted" || stored === "necessary") {
      setConsent(stored);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (consent === "accepted") {
      ensureMetrikaLoaded();
    }
    if (consent) {
      window.localStorage.setItem(COOKIE_CONSENT_KEY, consent);
      setConsentCookie(consent);
    }
  }, [consent]);

  const isVisible = hydrated && !consent;

  const description = useMemo(
    () =>
      "Мы используем обязательные cookies для работы сайта и, с вашего согласия, аналитические cookies для улучшения сервиса.",
    []
  );

  if (!isVisible) return null;

  return (
    <div className="fixed inset-x-4 bottom-24 z-[80] md:bottom-6 md:left-6 md:right-6 md:inset-x-auto md:max-w-[560px]">
      <div className="rounded-[1.75rem] bg-background/96 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.12)] ring-1 ring-border/70 backdrop-blur-xl">
        <div className="space-y-3">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
            Cookies
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Подробнее — в{" "}
            <Link to="/privacy-policy" className="font-medium text-foreground hover:text-[#05C3D4]">
              политике обработки персональных данных
            </Link>
            .
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            className="h-11 rounded-full px-6"
            onClick={() => setConsent("accepted")}
          >
            Принять все
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-full px-6"
            onClick={() => setConsent("necessary")}
          >
            Только необходимые
          </Button>
        </div>
      </div>
    </div>
  );
}
