import {
  KeyRound,
  Loader2,
  Plus,
  RefreshCcw,
  Route,
  Save,
  ShieldCheck,
  Trash2,
  CreditCard,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Package2,
  Sparkles,
  Store,
  FolderKanban,
  Eye,
  EyeOff,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { trpc } from "@/providers/trpc";
import { Can } from "@/providers/AbilityProvider";
import AdminUsersPanel from "@/components/admin/AdminUsersPanel";
import AdminProfilePanel from "@/components/admin/AdminProfilePanel";
import AdminAuthSettingsPanel from "@/components/admin/AdminAuthSettingsPanel";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import HeroPromoDynamic, { type HeroData, type HeroSlide } from "@/components/HeroPromoDynamic";
import HeroPromoShowcase from "@/components/HeroPromoShowcase";
import HeroPromoShowcase3D from "@/components/HeroPromoShowcase3D";

type SettingsTab = "profile" | "access" | "ai" | "integrations" | "payment" | "site";

type HomepageHeroSlideType = "products" | "promo" | "categories" | "brands";
type HomepageHeroSlideTheme = "light" | "soft-cyan" | "mesh" | "dark";

type HomepageHeroSlideForm = {
  id: string;
  enabled: boolean;
  type: HomepageHeroSlideType;
  theme: HomepageHeroSlideTheme;
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  productSource: "manual" | "automatic";
  autoSource: "recommended" | "latest" | "fallback";
  itemsLimit: number;
  manualProductIds: number[];
  categorySlugs: string[];
  manufacturerSlugs: string[];
  activeFrom: string | null;
  activeTo: string | null;
};

type HomepagePromoShowcaseForm = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  accent: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  cardsPerTab: number;
  categoryLimit: number;
  pinnedProductIds: number[];
  excludedProductIds: number[];
};

const defaultHomepagePromoShowcaseForm = (): HomepagePromoShowcaseForm => ({
  eyebrow: "Лимитированные предложения",
  title: "Скидки, которые хочется открыть прямо сейчас",
  subtitle: "Чемпионы по выгоде, выбор ТЕХАКС и свежие скидки в одной витрине.",
  description:
    "Показываем только реальные товары с ценой, старой ценой и наличием. Можно быстро переключаться между сценариями покупки без лишней навигации.",
  accent: "успей купить",
  primaryCtaLabel: "Смотреть все скидки",
  primaryCtaHref: "/promotions",
  secondaryCtaLabel: "Перейти в каталог",
  secondaryCtaHref: "/catalog",
  cardsPerTab: 8,
  categoryLimit: 7,
  pinnedProductIds: [],
  excludedProductIds: [],
});

function createHeroSlideDraft(type: HomepageHeroSlideType): HomepageHeroSlideForm {
  const baseId = `hero-slide-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const shared = {
    id: baseId,
    enabled: true,
    theme: "soft-cyan" as HomepageHeroSlideTheme,
    eyebrow: "",
    title: "",
    subtitle: "",
    description: "",
    accent: "",
    primaryCtaLabel: "",
    primaryCtaHref: "",
    secondaryCtaLabel: "",
    secondaryCtaHref: "",
    productSource: "automatic" as const,
    autoSource: "recommended" as const,
    itemsLimit: 4,
    manualProductIds: [] as number[],
    categorySlugs: [] as string[],
    manufacturerSlugs: [] as string[],
    activeFrom: null as string | null,
    activeTo: null as string | null,
  };

  if (type === "products") {
    return {
      ...shared,
      type,
      eyebrow: "В наличии",
      title: "Новая товарная витрина",
      subtitle: "Актуальные позиции прямо на первом экране.",
      primaryCtaLabel: "Перейти в каталог",
      primaryCtaHref: "/catalog",
    };
  }

  if (type === "promo") {
    return {
      ...shared,
      type,
      eyebrow: "Акция",
      title: "Промо-слайд главной",
      subtitle: "Используйте hero для акций, запусков и сезонных кампаний.",
      primaryCtaLabel: "Открыть каталог",
      primaryCtaHref: "/catalog",
    };
  }

  if (type === "categories") {
    return {
      ...shared,
      type,
      theme: "light",
      eyebrow: "Быстрый выбор",
      title: "Главные разделы каталога",
      subtitle: "Покажем категории прямо в hero без лишней навигации.",
      primaryCtaLabel: "Смотреть разделы",
      primaryCtaHref: "/catalog",
      itemsLimit: 6,
    };
  }

  return {
    ...shared,
    type,
    theme: "mesh",
    eyebrow: "Производители",
    title: "Проверенные бренды",
    subtitle: "Соберите отдельный hero-слайд с брендами и логотипами.",
    primaryCtaLabel: "Все производители",
    primaryCtaHref: "/catalog?view=brands&brand=all",
    itemsLimit: 6,
  };
}

const heroSlideTypeMeta: Record<
  HomepageHeroSlideType,
  { label: string; icon: typeof Package2 }
> = {
  products: { label: "Товары", icon: Package2 },
  promo: { label: "Промо", icon: Sparkles },
  categories: { label: "Категории", icon: FolderKanban },
  brands: { label: "Бренды", icon: Store },
};

function buildHeroSlideWarnings(slide: HomepageHeroSlideForm) {
  const warnings: string[] = [];
  const titleLength = slide.title.trim().length;
  const subtitleLength = slide.subtitle.trim().length;
  const descriptionLength = slide.description.trim().length;

  if (!slide.enabled) {
    warnings.push("Слайд выключен и не попадёт на витрину.");
  }

  if (titleLength === 0) {
    warnings.push("Нет заголовка — storefront покажет fallback-текст.");
  } else if (titleLength > 96) {
    warnings.push("Заголовок слишком длинный для первого экрана.");
  }

  if (subtitleLength > 180) {
    warnings.push("Подзаголовок лучше сократить, иначе mobile станет тяжёлым.");
  }

  if (descriptionLength > 260) {
    warnings.push("Описание уже слишком длинное для hero-сцены.");
  }

  if (!slide.primaryCtaLabel.trim() || !slide.primaryCtaHref.trim()) {
    warnings.push("Нет основной CTA-кнопки или ссылки.");
  }

  if (slide.activeFrom && slide.activeTo && new Date(slide.activeFrom) > new Date(slide.activeTo)) {
    warnings.push("Диапазон показа задан некорректно: дата начала позже даты окончания.");
  }

  if (slide.type === "products") {
    if (slide.productSource === "manual" && slide.manualProductIds.length === 0) {
      warnings.push("Manual-режим выбран, но товары не добавлены.");
    }
  }

  if (slide.type === "categories" && slide.itemsLimit < 3) {
    warnings.push("Для категорий лучше держать не меньше 3 элементов.");
  }

  if (slide.type === "brands" && slide.itemsLimit < 4) {
    warnings.push("Брендовый слайд выглядит лучше с 4+ элементами.");
  }

  return warnings;
}

function mapSlideToHeroPreview(
  slide: HomepageHeroSlideForm,
  products: Array<{ id: number; slug: string; name: string; price: number; oldPrice?: number | null; imageUrl?: string | null; image?: string | null; inStock?: boolean; categoryName?: string | null }> | undefined
): HeroSlide {
  if (slide.type === "products") {
    const resolvedCards = slide.manualProductIds
      .map(productId => products?.find(product => product.id === productId))
      .filter(Boolean)
      .slice(0, slide.itemsLimit)
      .map(product => ({
        id: product!.id,
        slug: product!.slug,
        name: product!.name,
        price: product!.price,
        oldPrice: product!.oldPrice ?? null,
          image: product!.imageUrl || product!.image || "/images/placeholder.jpg",
        badge: slide.accent || null,
        inStock: Boolean(product!.inStock),
        categoryName: product!.categoryName ?? null,
      }));

    const previewCards =
      resolvedCards.length > 0
        ? resolvedCards
        : Array.from({ length: Math.max(3, Math.min(slide.itemsLimit, 4)) }, (_, index) => ({
            id: 10_000 + index,
            slug: `preview-product-${index + 1}`,
            name: `Товар витрины ${index + 1}`,
            price: 1_990 + index * 500,
            oldPrice: null,
            image: "/images/placeholder.jpg",
            badge: slide.accent || "Preview",
            inStock: true,
            categoryName: null,
          }));

    return {
      id: slide.id,
      type: "products",
      theme: slide.theme,
      eyebrow: slide.eyebrow,
      title: slide.title,
      subtitle: slide.subtitle,
      description: slide.description,
      accent: slide.accent,
      primaryCtaLabel: slide.primaryCtaLabel,
      primaryCtaHref: slide.primaryCtaHref,
      secondaryCtaLabel: slide.secondaryCtaLabel,
      secondaryCtaHref: slide.secondaryCtaHref,
      cards: previewCards,
    };
  }

  if (slide.type === "categories") {
    const previewSlugs =
      slide.categorySlugs.length > 0
        ? slide.categorySlugs.slice(0, slide.itemsLimit)
        : Array.from({ length: Math.max(3, Math.min(slide.itemsLimit, 6)) }, (_, index) =>
            `preview-category-${index + 1}`
          );
    return {
      id: slide.id,
      type: "categories",
      theme: slide.theme,
      eyebrow: slide.eyebrow,
      title: slide.title,
      subtitle: slide.subtitle,
      description: slide.description,
      accent: slide.accent,
      primaryCtaLabel: slide.primaryCtaLabel,
      primaryCtaHref: slide.primaryCtaHref,
      secondaryCtaLabel: slide.secondaryCtaLabel,
      secondaryCtaHref: slide.secondaryCtaHref,
      categories: previewSlugs.map((slug, index) => ({
        id: index + 1,
        slug,
        name: slug.replace(/-/g, " "),
        imageUrl: null,
        icon: null,
        productCount: 0,
        href: `/catalog?cat=${slug}`,
      })),
    };
  }

  if (slide.type === "brands") {
    const previewSlugs =
      slide.manufacturerSlugs.length > 0
        ? slide.manufacturerSlugs.slice(0, slide.itemsLimit)
        : Array.from({ length: Math.max(4, Math.min(slide.itemsLimit, 6)) }, (_, index) =>
            `preview-brand-${index + 1}`
          );
    return {
      id: slide.id,
      type: "brands",
      theme: slide.theme,
      eyebrow: slide.eyebrow,
      title: slide.title,
      subtitle: slide.subtitle,
      description: slide.description,
      accent: slide.accent,
      primaryCtaLabel: slide.primaryCtaLabel,
      primaryCtaHref: slide.primaryCtaHref,
      secondaryCtaLabel: slide.secondaryCtaLabel,
      secondaryCtaHref: slide.secondaryCtaHref,
      brands: previewSlugs.map((slug, index) => ({
        id: index + 1,
        slug,
        title: slug.replace(/-/g, " "),
        logo: "/images/logo-light.svg",
        productCount: 0,
        href: `/catalog?view=brands&brand=${slug}`,
      })),
    };
  }

  return {
    id: slide.id,
    type: "promo",
    theme: slide.theme,
    eyebrow: slide.eyebrow,
    title: slide.title,
    subtitle: slide.subtitle,
    description: slide.description,
    accent: slide.accent,
    primaryCtaLabel: slide.primaryCtaLabel,
    primaryCtaHref: slide.primaryCtaHref,
    secondaryCtaLabel: slide.secondaryCtaLabel,
    secondaryCtaHref: slide.secondaryCtaHref,
  };
}

export default function AdminSettings() {
  const location = useLocation();
  const utils = trpc.useUtils();
  const activeTab = resolveSettingsTab(location.pathname);
  const { data, isLoading } = trpc.settings.getGemini.useQuery();
  const { data: msData } = trpc.settings.getMoySklad.useQuery();
  const { data: loyaltyData } = trpc.settings.getLoyaltySettings.useQuery();
  const { data: maintenanceData } = trpc.settings.getMaintenanceStatus.useQuery();
  const { data: reservationSettings } = trpc.settings.getReservationSettings.useQuery();
  const { data: siteProfileSettings } = trpc.settings.getSiteProfileSettings.useQuery();
  const { data: homepageHeroSettings } = trpc.settings.getHomepageHeroSettings.useQuery(
    undefined,
    { enabled: activeTab === "site" }
  );
  const { data: homepageHeroAdminSettings } =
    trpc.settings.getHomepageHeroAdminSettings.useQuery(undefined, {
      enabled: activeTab === "site",
    });
  const { data: homepageSnapshotStatus } = trpc.home.getSnapshotStatus.useQuery(
    undefined,
    { enabled: activeTab === "site" }
  );
  const [heroProductSearch, setHeroProductSearch] = useState("");
  const { data: heroProductSearchResults } = trpc.product.getPaginated.useQuery(
    {
      page: 1,
      limit: 8,
      search: heroProductSearch.trim() || undefined,
      visibility: "site_active",
    },
    {
      enabled: activeTab === "site",
      staleTime: 30_000,
    }
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gemini-2.5-flash");
  const [proxyBaseUrl, setProxyBaseUrl] = useState("");
  const [proxyToken, setProxyToken] = useState("");
  const [manufacturerLogoProvider, setManufacturerLogoProvider] =
    useState("logo_dev");
  const [manufacturerLogoToken, setManufacturerLogoToken] = useState("");
  const [msToken, setMsToken] = useState("");
  const [msWebhookSecret, setMsWebhookSecret] = useState("");
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [loyaltyGroupName, setLoyaltyGroupName] = useState("техакс");
  const [loyaltyParticipantTag, setLoyaltyParticipantTag] = useState("техакс");
  const [loyaltyPosCashierUid, setLoyaltyPosCashierUid] = useState("");
  const [loyaltyPosStoreUid, setLoyaltyPosStoreUid] = useState("");
  const [loyaltyDefaultMaxWriteoffPercent, setLoyaltyDefaultMaxWriteoffPercent] =
    useState(30);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceReopenDate, setMaintenanceReopenDate] = useState("");
  const [reservationDurationMinutes, setReservationDurationMinutes] = useState(180);
  const [homepageHeroVariant, setHomepageHeroVariant] = useState<
    "classic" | "interactive" | "promo_showcase" | "promo_showcase_3d"
  >("classic");
  const [homepageHeroSlides, setHomepageHeroSlides] = useState<HomepageHeroSlideForm[]>(
    []
  );
  const [homepagePromoShowcase, setHomepagePromoShowcase] =
    useState<HomepagePromoShowcaseForm>(defaultHomepagePromoShowcaseForm);
  const [activeHeroSlideId, setActiveHeroSlideId] = useState<string | null>(null);

  const activeHeroSlide = useMemo(
    () => homepageHeroSlides.find(slide => slide.id === activeHeroSlideId) ?? null,
    [activeHeroSlideId, homepageHeroSlides]
  );
  const activeHeroSlideWarnings = useMemo(
    () => (activeHeroSlide ? buildHeroSlideWarnings(activeHeroSlide) : []),
    [activeHeroSlide]
  );
  const homepageHeroAllManualProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          homepageHeroSlides.flatMap(slide =>
            slide.type === "products" ? slide.manualProductIds : []
          )
        )
      ),
    [homepageHeroSlides]
  );
  const promoShowcaseManagedProductIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...homepagePromoShowcase.pinnedProductIds,
          ...homepagePromoShowcase.excludedProductIds,
        ])
      ),
    [homepagePromoShowcase.excludedProductIds, homepagePromoShowcase.pinnedProductIds]
  );
  const deferredHomepagePromoShowcase = useDeferredValue(homepagePromoShowcase);
  const { data: homepageHeroSelectedProducts } = trpc.product.getByIds.useQuery(
    { ids: homepageHeroAllManualProductIds },
    {
      enabled: activeTab === "site" && homepageHeroAllManualProductIds.length > 0,
      staleTime: 30_000,
    }
  );
  const { data: promoShowcaseManagedProducts } = trpc.product.getByIds.useQuery(
    { ids: promoShowcaseManagedProductIds },
    {
      enabled: activeTab === "site" && promoShowcaseManagedProductIds.length > 0,
      staleTime: 30_000,
    }
  );
  const { data: homepagePromoShowcasePreview, isFetching: isPromoShowcasePreviewFetching } =
    trpc.settings.getHomepagePromoShowcasePreview.useQuery(deferredHomepagePromoShowcase, {
      enabled:
        activeTab === "site" &&
        (homepageHeroVariant === "promo_showcase" ||
          homepageHeroVariant === "promo_showcase_3d"),
      staleTime: 0,
      gcTime: 0,
    });
  const activeHeroSlidePreview = useMemo<HeroData | null>(() => {
    if (!activeHeroSlide) return null;
    return {
      slides: [mapSlideToHeroPreview(activeHeroSlide, homepageHeroSelectedProducts as any)],
    };
  }, [activeHeroSlide, homepageHeroSelectedProducts]);
  const [siteProfileForm, setSiteProfileForm] = useState({
    contacts: {
      primaryPhone: "",
      primaryPhoneDisplay: "",
      secondaryPhone: "",
      email: "",
      workingHours: "",
      shortAddress: "",
      fullAddress: "",
    },
    seller: {
      legalForm: "ip" as "ip" | "ooo",
      fullName: "",
      shortName: "",
      signatoryName: "",
      signatoryLabel: "",
      signatoryBasis: "",
      legalAddress: "",
      actualAddress: "",
      inn: "",
      ogrnip: "",
      kpp: "",
      okpo: "",
      email: "",
      phone: "",
    },
    bank: {
      bankName: "",
      account: "",
      corrAccount: "",
      bik: "",
      inn: "",
      kpp: "",
    },
    legalTexts: {
      offerTitle: "",
      offerContent: "",
      privacyPolicyTitle: "",
      privacyPolicyContent: "",
      paymentDeliveryTitle: "",
      paymentDeliveryContent: "",
      returnsPolicyTitle: "",
      returnsPolicyContent: "",
    },
    documents: {
      signatureName: "",
      signatureLabel: "",
      requisitesFooter: "",
    },
  });

  useEffect(() => {
    if (!loyaltyData) return;
    setLoyaltyEnabled(Boolean(loyaltyData.enabled));
    setLoyaltyGroupName(loyaltyData.groupName || "техакс");
    setLoyaltyParticipantTag(loyaltyData.participantTag || loyaltyData.groupName || "техакс");
    setLoyaltyPosCashierUid(loyaltyData.posCashierUid || "");
    setLoyaltyPosStoreUid(loyaltyData.posStoreUid || "");
    setLoyaltyDefaultMaxWriteoffPercent(
      Number(loyaltyData.defaultMaxWriteoffPercent || 30)
    );
  }, [loyaltyData]);

  useEffect(() => {
    if (maintenanceData) {
      setMaintenanceEnabled(maintenanceData.isEnabled);
      setMaintenanceReopenDate(maintenanceData.reopenDate || "");
    }
  }, [maintenanceData]);

  useEffect(() => {
    if (reservationSettings) {
      setReservationDurationMinutes(reservationSettings.durationMinutes);
    }
  }, [reservationSettings]);

  useEffect(() => {
    if (!data) return;
    setApiKey("");
    setModel(data.model || "gemini-2.5-flash");
    setProxyBaseUrl(data.proxyBaseUrl || "");
    setProxyToken("");
    setManufacturerLogoProvider(data.manufacturerLogoProvider || "logo_dev");
    setManufacturerLogoToken("");
  }, [data]);

  useEffect(() => {
    if (!siteProfileSettings) return;
    setSiteProfileForm(siteProfileSettings);
  }, [siteProfileSettings]);

  useEffect(() => {
    if (!homepageHeroSettings?.variant) return;
    setHomepageHeroVariant(homepageHeroSettings.variant);
  }, [homepageHeroSettings]);

  useEffect(() => {
    if (!homepageHeroAdminSettings) return;
    setHomepageHeroVariant(homepageHeroAdminSettings.variant);
    setHomepageHeroSlides(homepageHeroAdminSettings.slides);
    setHomepagePromoShowcase({
      ...defaultHomepagePromoShowcaseForm(),
      ...homepageHeroAdminSettings.promoShowcase,
      pinnedProductIds: homepageHeroAdminSettings.promoShowcase?.pinnedProductIds ?? [],
      excludedProductIds: homepageHeroAdminSettings.promoShowcase?.excludedProductIds ?? [],
    });
    setActiveHeroSlideId(homepageHeroAdminSettings.slides[0]?.id ?? null);
  }, [homepageHeroAdminSettings]);

  const saveMaintenanceMutation = trpc.settings.saveMaintenanceSettings.useMutation({
    onSuccess: () => {
      utils.settings.getMaintenanceStatus.invalidate();
      alert("Настройки техобслуживания сохранены.");
    },
  });

  const saveMutation = trpc.settings.saveGemini.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Настройки Gemini сохранены.");
      setApiKey("");
      setProxyToken("");
    },
  });

  const saveMsMutation = trpc.settings.saveMoySklad.useMutation({
    onSuccess: () => {
      utils.settings.getMoySklad.invalidate();
      alert("Настройки МойСклад сохранены.");
      setMsToken("");
      setMsWebhookSecret("");
    },
  });

  const clearMsMutation = trpc.settings.clearMoySkladToken.useMutation({
    onSuccess: () => {
      utils.settings.getMoySklad.invalidate();
      alert("Токен МойСклад удален.");
      setMsToken("");
    },
  });

  const clearMsWebhookSecretMutation =
    trpc.settings.clearMoySkladWebhookSecret.useMutation({
      onSuccess: () => {
        utils.settings.getMoySklad.invalidate();
        alert("Секрет вебхука МойСклад удален.");
        setMsWebhookSecret("");
      },
    });

  const saveLoyaltyMutation = trpc.settings.saveLoyaltySettings.useMutation({
    onSuccess: () => {
      utils.settings.getLoyaltySettings.invalidate();
      alert("Настройки бонусной программы сохранены.");
    },
  });

  const saveReservationSettingsMutation =
    trpc.settings.saveReservationSettings.useMutation({
      onSuccess: () => {
        utils.settings.getReservationSettings.invalidate();
        alert("Настройки резерва сохранены.");
      },
    });
  const saveSiteProfileMutation =
    trpc.settings.saveSiteProfileSettings.useMutation({
      onSuccess: () => {
        utils.settings.getSiteProfileSettings.invalidate();
        utils.settings.getPublicSiteProfile.invalidate();
        utils.home.getSnapshotStatus.invalidate();
        alert("Профиль сайта и реквизиты сохранены.");
      },
    });
  const refreshHomepageSnapshotMutation = trpc.home.refreshSnapshot.useMutation({
    onSuccess: result => {
      utils.home.getPageData.invalidate();
      utils.home.getSnapshotStatus.invalidate();
      alert(
        `Главная пересобрана. Категорий: ${result.counts.categories}, товаров недели: ${result.counts.weekProducts}.`
      );
    },
  });
  const saveHomepageHeroMutation =
    trpc.settings.saveHomepageHeroAdminSettings.useMutation({
      onSuccess: () => {
        utils.settings.getHomepageHeroAdminSettings.invalidate();
        utils.settings.getHomepageHeroSettings.invalidate();
        utils.home.getPageData.invalidate();
        utils.home.getSnapshotStatus.invalidate();
        alert("Версия hero главной страницы сохранена.");
      },
    });

  const testMutation = trpc.settings.testGemini.useMutation({
    onSuccess: () => {
      alert("Подключение к Gemini успешно проверено.");
    },
  });

  const clearMutation = trpc.settings.clearGeminiApiKey.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Сохраненный API-ключ удален.");
      setApiKey("");
    },
  });

  const clearProxyMutation = trpc.settings.clearAiProxyToken.useMutation({
    onSuccess: () => {
      utils.settings.getGemini.invalidate();
      alert("Сохраненный токен роутера удален.");
      setProxyToken("");
    },
  });

  const saveManufacturerLogosMutation =
    trpc.settings.saveManufacturerLogoSettings.useMutation({
      onSuccess: () => {
        utils.settings.getGemini.invalidate();
        alert("Настройки поиска логотипов сохранены.");
        setManufacturerLogoToken("");
      },
    });

  const clearManufacturerLogoTokenMutation =
    trpc.settings.clearManufacturerLogoToken.useMutation({
      onSuccess: () => {
        utils.settings.getGemini.invalidate();
        alert("Токен Logo.dev удален.");
        setManufacturerLogoToken("");
      },
    });

  const statusCards = useMemo(
    () => [
      {
        label: "Gemini",
        value: data?.isConfigured ? "Подключено" : "Не подключено",
        hint: data?.proxyBaseUrl ? "Через AI Router" : "Прямой или .env fallback",
        tone: data?.isConfigured ? "success" : "warning",
      },
      {
        label: "МойСклад",
        value: msData?.hasToken ? "Токен сохранён" : "Токен не задан",
        hint: msData?.hasWebhookSecret ? "Секрет вебхука задан" : "Без секрета вебхука",
        tone: msData?.hasToken ? "success" : "warning",
      },
      {
        label: "Сайт",
        value: maintenanceEnabled ? "Техобслуживание" : "Онлайн",
        hint: maintenanceEnabled
          ? maintenanceReopenDate || "Дата открытия не указана"
          : "Обычный режим",
        tone: maintenanceEnabled ? "warning" : "accent",
      },
    ] as const,
    [data?.isConfigured, data?.proxyBaseUrl, maintenanceEnabled, maintenanceReopenDate, msData]
  );

  const updateContactField = <
    K extends keyof typeof siteProfileForm.contacts,
  >(
    key: K,
    value: (typeof siteProfileForm.contacts)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      contacts: { ...prev.contacts, [key]: value },
    }));
  };

  const updateSellerField = <
    K extends keyof typeof siteProfileForm.seller,
  >(
    key: K,
    value: (typeof siteProfileForm.seller)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      seller: { ...prev.seller, [key]: value },
    }));
  };

  const updateBankField = <K extends keyof typeof siteProfileForm.bank>(
    key: K,
    value: (typeof siteProfileForm.bank)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      bank: { ...prev.bank, [key]: value },
    }));
  };

  const updateLegalField = <
    K extends keyof typeof siteProfileForm.legalTexts,
  >(
    key: K,
    value: (typeof siteProfileForm.legalTexts)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      legalTexts: { ...prev.legalTexts, [key]: value },
    }));
  };

  const updateDocumentField = <
    K extends keyof typeof siteProfileForm.documents,
  >(
    key: K,
    value: (typeof siteProfileForm.documents)[K]
  ) => {
    setSiteProfileForm(prev => ({
      ...prev,
      documents: { ...prev.documents, [key]: value },
    }));
  };

  const updateHeroSlide = (
    slideId: string,
    updater: (slide: HomepageHeroSlideForm) => HomepageHeroSlideForm
  ) => {
    setHomepageHeroSlides(prev =>
      prev.map(slide => (slide.id === slideId ? updater(slide) : slide))
    );
  };

  const addHeroSlide = (type: HomepageHeroSlideType) => {
    const draft = createHeroSlideDraft(type);
    setHomepageHeroSlides(prev => [...prev, draft].slice(0, 8));
    setActiveHeroSlideId(draft.id);
  };

  const removeHeroSlide = (slideId: string) => {
    setHomepageHeroSlides(prev => {
      const next = prev.filter(slide => slide.id !== slideId);
      if (activeHeroSlideId === slideId) {
        setActiveHeroSlideId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const moveHeroSlide = (slideId: string, direction: -1 | 1) => {
    setHomepageHeroSlides(prev => {
      const index = prev.findIndex(slide => slide.id === slideId);
      if (index < 0) return prev;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const addHeroManualProduct = (slideId: string, productId: number) => {
    updateHeroSlide(slideId, slide => ({
      ...slide,
      manualProductIds: slide.manualProductIds.includes(productId)
        ? slide.manualProductIds
        : [...slide.manualProductIds, productId].slice(0, 8),
    }));
  };

  const removeHeroManualProduct = (slideId: string, productId: number) => {
    updateHeroSlide(slideId, slide => ({
      ...slide,
      manualProductIds: slide.manualProductIds.filter(item => item !== productId),
    }));
  };

  const moveHeroManualProduct = (
    slideId: string,
    productId: number,
    direction: -1 | 1
  ) => {
    updateHeroSlide(slideId, slide => {
      const index = slide.manualProductIds.indexOf(productId);
      if (index < 0) return slide;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= slide.manualProductIds.length) return slide;
      const next = [...slide.manualProductIds];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return {
        ...slide,
        manualProductIds: next,
      };
    });
  };

  const promoManagedProductsById = useMemo(
    () => new Map((promoShowcaseManagedProducts ?? []).map(product => [product.id, product])),
    [promoShowcaseManagedProducts]
  );

  const updateHomepagePromoShowcase = (
    updater: (current: HomepagePromoShowcaseForm) => HomepagePromoShowcaseForm
  ) => {
    setHomepagePromoShowcase(current => updater(current));
  };

  const addPromoManagedProduct = (
    target: "pinnedProductIds" | "excludedProductIds",
    productId: number
  ) => {
    updateHomepagePromoShowcase(current => ({
      ...current,
      [target]: current[target].includes(productId)
        ? current[target]
        : [...current[target], productId].slice(
            0,
            target === "pinnedProductIds" ? 24 : 120
          ),
    }));
  };

  const removePromoManagedProduct = (
    target: "pinnedProductIds" | "excludedProductIds",
    productId: number
  ) => {
    updateHomepagePromoShowcase(current => ({
      ...current,
      [target]: current[target].filter(id => id !== productId),
    }));
  };

  const movePromoManagedProduct = (
    target: "pinnedProductIds",
    productId: number,
    direction: -1 | 1
  ) => {
    updateHomepagePromoShowcase(current => {
      const index = current[target].indexOf(productId);
      if (index < 0) return current;
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current[target].length) return current;
      const next = [...current[target]];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return {
        ...current,
        [target]: next,
      };
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Контур управления"
        title="Настройки и интеграции"
        description="Настройки разложены по отдельным маршрутам. Навигация по разделам теперь идет через главное меню слева, без внутреннего дублирующего таб-бара."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {statusCards.map(card => (
          <AdminStatCard
            key={card.label}
            label={card.label}
            value={card.value}
            hint={card.hint}
            tone={card.tone}
          />
        ))}
      </div>

      {activeTab === "profile" ? (
        <div className="space-y-6">
          <AdminSection
            title="Личный профиль"
            description="Рабочая информация текущего администратора. Здесь нет сервисных интеграций и вторичных параметров."
          >
            <AdminProfilePanel />
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "access" ? (
        <div className="space-y-6">
          <Can I="read" a="User">
            <AdminSection
              title="Пользователи и роли"
              description="Управление доступом сотрудников. Здесь собраны роли, статусы и административные действия по пользователям."
            >
              <AdminUsersPanel />
            </AdminSection>
          </Can>

          <Can I="configure" a="Settings">
            <AdminSection
              title="Авторизация и безопасность"
              description="Настройки входа, ключей и рабочих параметров авторизации."
            >
              <AdminAuthSettingsPanel />
            </AdminSection>
          </Can>
        </div>
      ) : null}

      {activeTab === "ai" ? (
        <div className="space-y-6">
          <AdminSection
            title="Gemini API"
            description="Ключ нужен для предложений ИИ в стандартизации характеристик по категориям. Основные статусы показаны компактно, а опасные действия вынесены отдельно."
          >
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-gray-500">
                <Loader2 size={18} className="animate-spin" />
                Загружаю настройки...
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Модель</label>
                    <input
                      value={model}
                      onChange={e => setModel(e.target.value)}
                      placeholder="gemini-2.5-flash"
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      Сохраненный ключ
                    </label>
                    <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                      {data?.apiKeyMasked || "Ключ пока не задан"}
                    </div>
                  </div>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      AI Proxy URL
                    </label>
                    <div className="relative">
                      <Route
                        size={16}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      />
                      <input
                        value={proxyBaseUrl}
                        onChange={e => setProxyBaseUrl(e.target.value)}
                        placeholder="https://your-ai-router-xxxx.run.app"
                        className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">
                      Токен роутера
                    </label>
                    <div className="space-y-2">
                      <input
                        type="password"
                        value={proxyToken}
                        onChange={e => setProxyToken(e.target.value)}
                        placeholder={
                          data?.proxyTokenMasked
                            ? "Оставьте пустым, чтобы сохранить текущий токен"
                            : "Bearer token для AI Router"
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                      <div className="text-xs text-gray-500">
                        {data?.proxyTokenMasked || "Токен роутера пока не задан"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый API-ключ
                  </label>
                  <div className="relative">
                    <KeyRound
                      size={16}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder={
                        data?.hasApiKey
                          ? "Оставьте пустым, чтобы сохранить текущий ключ"
                          : "Вставьте Gemini API key"
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 pl-10 pr-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                {(saveMutation.error ||
                  testMutation.error ||
                  clearMutation.error ||
                  clearProxyMutation.error) && (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {saveMutation.error?.message ||
                      testMutation.error?.message ||
                      clearMutation.error?.message ||
                      clearProxyMutation.error?.message}
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() =>
                      saveMutation.mutate({
                        apiKey,
                        model,
                        proxyBaseUrl,
                        proxyToken,
                      })
                    }
                    disabled={saveMutation.isPending || !model.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                  >
                    {saveMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    Сохранить
                  </button>

                  <button
                    onClick={() =>
                      testMutation.mutate({
                        apiKey: apiKey.trim() || undefined,
                        model,
                        proxyBaseUrl: proxyBaseUrl.trim() || undefined,
                        proxyToken: proxyToken.trim() || undefined,
                      })
                    }
                    disabled={testMutation.isPending || !model.trim()}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-bold text-[#15171A] disabled:opacity-50"
                  >
                    {testMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    Проверить подключение
                  </button>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="mb-3 text-sm font-bold text-red-800">
                    Опасные действия
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => {
                        if (!confirm("Удалить сохраненный API-ключ Gemini?")) return;
                        clearMutation.mutate();
                      }}
                      disabled={clearMutation.isPending || data?.source === "env"}
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {clearMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Удалить ключ
                    </button>
                    <button
                      onClick={() => {
                        if (!confirm("Удалить сохраненный токен AI Router?")) return;
                        clearProxyMutation.mutate();
                      }}
                      disabled={
                        clearProxyMutation.isPending || data?.proxySource === "env"
                      }
                      className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                    >
                      {clearProxyMutation.isPending ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Trash2 size={16} />
                      )}
                      Удалить токен роутера
                    </button>
                  </div>
                </div>
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="Поиск логотипов производителей"
            description="Для кнопки «Собрать логотипы» в товарах. Сначала ищем логотип по домену бренда, затем — по названию производителя."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">Провайдер</label>
                  <select
                    value={manufacturerLogoProvider}
                    onChange={e => setManufacturerLogoProvider(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  >
                    <option value="logo_dev">Logo.dev</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный токен Logo.dev
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {data?.manufacturerLogoLogoDevTokenMasked || "Токен пока не задан"}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-[#15171A]">
                  Новый publishable token Logo.dev
                </label>
                <input
                  type="password"
                  value={manufacturerLogoToken}
                  onChange={e => setManufacturerLogoToken(e.target.value)}
                  placeholder={
                    data?.manufacturerLogoLogoDevTokenMasked
                      ? "Оставьте пустым, чтобы сохранить текущий токен"
                      : "Вставьте token для Logo.dev"
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                />
                <p className="text-xs leading-5 text-gray-500">
                  Если логотип не найден, система сохраняет аккуратную локальную
                  заглушку с инициалами бренда.
                </p>
              </div>

              {(saveManufacturerLogosMutation.error ||
                clearManufacturerLogoTokenMutation.error) && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveManufacturerLogosMutation.error?.message ||
                    clearManufacturerLogoTokenMutation.error?.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    saveManufacturerLogosMutation.mutate({
                      provider: manufacturerLogoProvider,
                      logoDevToken: manufacturerLogoToken,
                    })
                  }
                  disabled={saveManufacturerLogosMutation.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                >
                  {saveManufacturerLogosMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить настройки логотипов
                </button>

                <button
                  onClick={() => {
                    if (!confirm("Удалить сохраненный токен Logo.dev?")) return;
                    clearManufacturerLogoTokenMutation.mutate();
                  }}
                  disabled={clearManufacturerLogoTokenMutation.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                >
                  {clearManufacturerLogoTokenMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                  Удалить токен
                </button>
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "integrations" ? (
        <div className="space-y-6">
          <AdminSection
            title="МойСклад"
            description="API-токен используется для синхронизации товаров, остатков и цен. Секрет вебхука нужен для безопасного приема событий от МойСклад."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный токен
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {msData?.tokenMasked || "Токен пока не задан"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый API-токен
                  </label>
                  <input
                    type="password"
                    value={msToken}
                    onChange={e => setMsToken(e.target.value)}
                    placeholder={
                      msData?.hasToken
                        ? "Оставьте пустым, чтобы сохранить текущий токен"
                        : "Вставьте API-токен МойСклад"
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Сохраненный секрет вебхука
                  </label>
                  <div className="flex h-11 items-center rounded-xl border border-gray-200 px-3 text-sm text-gray-500">
                    {msData?.webhookSecretMasked || "Секрет вебхука пока не задан"}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Новый секрет вебхука
                  </label>
                  <input
                    type="password"
                    value={msWebhookSecret}
                    onChange={e => setMsWebhookSecret(e.target.value)}
                    placeholder={
                      msData?.hasWebhookSecret
                        ? "Оставьте пустым, чтобы сохранить текущий секрет"
                        : "Вставьте секрет для /api/webhooks/moysklad"
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              {(saveMsMutation.error ||
                clearMsMutation.error ||
                clearMsWebhookSecretMutation.error) && (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveMsMutation.error?.message ||
                    clearMsMutation.error?.message ||
                    clearMsWebhookSecretMutation.error?.message}
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    saveMsMutation.mutate({
                      token: msToken,
                      webhookSecret: msWebhookSecret,
                    })
                  }
                  disabled={
                    saveMsMutation.isPending ||
                    (!msToken.trim() && !msWebhookSecret.trim())
                  }
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                >
                  {saveMsMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить настройки МойСклад
                </button>
              </div>

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
                URL для вебхука МойСклад:{" "}
                <span className="font-mono">
                  https://techaks.ru/api/webhooks/moysklad
                </span>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                <div className="mb-3 text-sm font-bold text-red-800">
                  Опасные действия
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (!confirm("Удалить сохраненный токен МойСклад?")) return;
                      clearMsMutation.mutate();
                    }}
                    disabled={clearMsMutation.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    {clearMsMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Удалить токен
                  </button>

                  <button
                    onClick={() => {
                      if (!confirm("Удалить сохраненный секрет вебхука МойСклад?")) {
                        return;
                      }
                      clearMsWebhookSecretMutation.mutate();
                    }}
                    disabled={clearMsWebhookSecretMutation.isPending}
                    className="inline-flex h-11 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 text-sm font-bold text-red-600 disabled:opacity-50"
                  >
                    {clearMsWebhookSecretMutation.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Trash2 size={16} />
                    )}
                    Удалить секрет вебхука
                  </button>
                </div>
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Бонусная программа"
            description="Контур лояльности для сайта. Пользователи автоматически помечаются тегом участия в МойСклад, а базовое ограничение списания используется как fallback, пока правила не пришли из внешнего профиля."
          >
            <div className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    Программа включена
                  </span>
                  <button
                    type="button"
                    onClick={() => setLoyaltyEnabled(value => !value)}
                    className={`inline-flex h-11 w-full items-center justify-between rounded-xl border px-4 text-sm font-bold transition ${
                      loyaltyEnabled
                        ? "border-[#05C3D4] bg-[#E8FAFC] text-[#047987]"
                        : "border-gray-200 bg-white text-[#464A50]"
                    }`}
                  >
                    <span>{loyaltyEnabled ? "Включена" : "Выключена"}</span>
                    {loyaltyEnabled ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    Группа в МойСклад
                  </span>
                  <input
                    value={loyaltyGroupName}
                    onChange={e => setLoyaltyGroupName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    Тег участия
                  </span>
                  <input
                    value={loyaltyParticipantTag}
                    onChange={e => setLoyaltyParticipantTag(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    Fallback-лимит списания, %
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={loyaltyDefaultMaxWriteoffPercent}
                    onChange={e =>
                      setLoyaltyDefaultMaxWriteoffPercent(
                        Math.min(100, Math.max(1, Number(e.target.value) || 30))
                      )
                    }
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    UID кассира POS API
                  </span>
                  <input
                    value={loyaltyPosCashierUid}
                    onChange={e => setLoyaltyPosCashierUid(e.target.value)}
                    placeholder="Нужен для bonus detail из POS API"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-[#15171A]">
                    UID точки продаж / магазина
                  </span>
                  <input
                    value={loyaltyPosStoreUid}
                    onChange={e => setLoyaltyPosStoreUid(e.target.value)}
                    placeholder="Опционально"
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                </label>
              </div>

              {saveLoyaltyMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveLoyaltyMutation.error.message}
                </div>
              ) : null}

              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-600">
                Сейчас сайт использует безопасный fallback-предел списания и автоматически
                помечает клиентов как участников программы. По мере наполнения внешнего
                профиля в МойСклад эти данные будут подхватываться прямо в checkout и ЛК.
              </div>

              {loyaltyEnabled && !loyaltyData?.posDetailConfigured ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
                  Для получения реальных бонусных деталей из POS API нужно указать UID
                  кассира. Пока он не задан, сайт сможет работать с fallback-логикой, но
                  баланс, доступно к списанию и pending-начисления не будут подтягиваться
                  полноценно.
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    saveLoyaltyMutation.mutate({
                      enabled: loyaltyEnabled,
                      groupName: loyaltyGroupName,
                      participantTag: loyaltyParticipantTag,
                      posCashierUid: loyaltyPosCashierUid,
                      posStoreUid: loyaltyPosStoreUid,
                      defaultMaxWriteoffPercent: loyaltyDefaultMaxWriteoffPercent,
                    })
                  }
                  disabled={saveLoyaltyMutation.isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
                >
                  {saveLoyaltyMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  Сохранить бонусную программу
                </button>
              </div>
            </div>
          </AdminSection>
        </div>
      ) : null}

      {activeTab === "payment" ? (
        <div className="space-y-6">
          <Can I="manage_payment_settings" a="Settings">
            <AdminSection
              title="Оплата"
              description="Платежные провайдеры и безопасные ключи. Доступ к этому разделу есть только у администраторов с правом управления платежными настройками."
            >
              <div className="grid gap-4 md:grid-cols-2">
                <Link
                  to="/admin/settings/payment/yookassa"
                  className="group rounded-2xl bg-[#F6F7F8] p-5 transition-colors hover:bg-[#E8FAFC]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                        <CreditCard size={18} className="text-[#05C3D4]" />
                        YooKassa
                      </div>
                      <p className="mt-2 text-sm leading-6 text-gray-500">
                        Shop ID, Secret Key, режим оплаты, return URL и webhook.
                      </p>
                    </div>
                    <ArrowRight
                      size={18}
                      className="text-[#05C3D4] transition-transform group-hover:translate-x-1"
                    />
                  </div>
                </Link>
              </div>
            </AdminSection>
          </Can>
        </div>
      ) : null}

      {activeTab === "site" ? (
        <div className="space-y-6">
          <AdminSection
            title="Hero главной страницы"
            description="Здесь хранится безопасный классический hero и новый промо-режим: слева торговое предложение, справа живые карточки товаров. Контент и логика наполнения редактируются отдельно от классической версии."
            tone="accent"
            actions={
              <button
                onClick={() =>
                  saveHomepageHeroMutation.mutate({
                    variant: homepageHeroVariant,
                    slides: homepageHeroSlides,
                    promoShowcase: homepagePromoShowcase,
                  })
                }
                disabled={
                  saveHomepageHeroMutation.isPending || !homepageHeroVariant
                }
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveHomepageHeroMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить hero
              </button>
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                {(homepageHeroSettings?.options ?? []).map(option => {
                  const isActive = homepageHeroVariant === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setHomepageHeroVariant(option.value)}
                      className={`rounded-2xl border p-5 text-left transition ${
                        isActive
                          ? "border-[#05C3D4] bg-[#EAFBFD]"
                          : "border-gray-200 bg-white hover:border-[#05C3D4]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-black text-[#15171A]">
                            {option.label}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-gray-500">
                            {option.description}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                            isActive
                              ? "bg-[#05C3D4] text-black"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {isActive ? "Активно" : "Доступно"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {homepageHeroVariant === "interactive" ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap gap-3">
                    {(["products", "promo", "categories", "brands"] as HomepageHeroSlideType[]).map(
                      type => {
                        const meta = heroSlideTypeMeta[type];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => addHeroSlide(type)}
                            className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-black text-[#15171A] transition hover:border-[#05C3D4] hover:text-[#05C3D4]"
                          >
                            <Plus size={15} />
                            <Icon size={15} />
                            {meta.label}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <div className="space-y-4">
                    {homepageHeroSlides.map((slide, index) => {
                      const meta = heroSlideTypeMeta[slide.type];
                      const Icon = meta.icon;
                      const isPickerTarget = activeHeroSlideId === slide.id;
                      return (
                        <div
                          key={slide.id}
                          className={`rounded-2xl border p-5 transition ${
                            isPickerTarget
                              ? "border-[#05C3D4] bg-[#EAFBFD]"
                              : "border-gray-200 bg-white"
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                                  <Icon size={14} />
                                  {meta.label}
                                </span>
                                <span className="text-xs font-bold text-gray-500">
                                  Слайд {index + 1}
                                </span>
                              </div>
                              <div className="mt-3 text-lg font-black text-[#15171A]">
                                {slide.title || "Без заголовка"}
                              </div>
                              <div className="mt-1 text-sm text-gray-500">
                                {slide.subtitle || "Контент и визуальный сценарий этого слайда."}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setActiveHeroSlideId(slide.id)}
                                className={`rounded-xl px-3 py-2 text-xs font-black ${
                                  isPickerTarget
                                    ? "bg-[#05C3D4] text-black"
                                    : "border border-gray-200 text-gray-700"
                                }`}
                              >
                                {slide.type === "products"
                                  ? "Подбор товаров"
                                  : "Выбран для редактирования"}
                              </button>
                              <button
                                type="button"
                                onClick={() => moveHeroSlide(slide.id, -1)}
                                disabled={index === 0}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-40"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveHeroSlide(slide.id, 1)}
                                disabled={index === homepageHeroSlides.length - 1}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-black text-gray-700 disabled:opacity-40"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeHeroSlide(slide.id)}
                                className="rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-600"
                              >
                                Удалить
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">Тип</span>
                              <select
                                value={slide.type}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    type: e.target.value as HomepageHeroSlideType,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              >
                                <option value="products">Товары</option>
                                <option value="promo">Промо</option>
                                <option value="categories">Категории</option>
                                <option value="brands">Бренды</option>
                              </select>
                            </label>

                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">Тема</span>
                              <select
                                value={slide.theme}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    theme: e.target.value as HomepageHeroSlideTheme,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              >
                                <option value="soft-cyan">Soft cyan</option>
                                <option value="light">Light</option>
                                <option value="mesh">Mesh</option>
                                <option value="dark">Dark</option>
                              </select>
                            </label>

                            <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={slide.enabled}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    enabled: e.target.checked,
                                  }))
                                }
                              />
                              <span className="text-sm font-bold text-[#15171A]">
                                Слайд активен
                              </span>
                            </label>

                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Кол-во элементов
                              </span>
                              <input
                                type="number"
                                min={2}
                                max={8}
                                value={slide.itemsLimit}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    itemsLimit: Math.min(
                                      8,
                                      Math.max(2, Number(e.target.value) || 4)
                                    ),
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">Eyebrow</span>
                              <input
                                value={slide.eyebrow}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    eyebrow: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Акцент / плашка
                              </span>
                              <input
                                value={slide.accent}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    accent: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2 md:col-span-2">
                              <span className="text-sm font-bold text-[#15171A]">Заголовок</span>
                              <textarea
                                rows={2}
                                value={slide.title}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    title: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2 md:col-span-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Подзаголовок
                              </span>
                              <textarea
                                rows={2}
                                value={slide.subtitle}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    subtitle: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2 md:col-span-2">
                              <span className="text-sm font-bold text-[#15171A]">Описание</span>
                              <textarea
                                rows={3}
                                value={slide.description}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    description: e.target.value,
                                  }))
                                }
                                className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Основная кнопка
                              </span>
                              <input
                                value={slide.primaryCtaLabel}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    primaryCtaLabel: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Ссылка основной кнопки
                              </span>
                              <input
                                value={slide.primaryCtaHref}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    primaryCtaHref: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Вторичная кнопка
                              </span>
                              <input
                                value={slide.secondaryCtaLabel}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    secondaryCtaLabel: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Ссылка вторичной кнопки
                              </span>
                              <input
                                value={slide.secondaryCtaHref}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    secondaryCtaHref: e.target.value,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                          </div>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Показывать с
                              </span>
                              <input
                                type="datetime-local"
                                value={slide.activeFrom ?? ""}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    activeFrom: e.target.value || null,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                            <label className="space-y-2">
                              <span className="text-sm font-bold text-[#15171A]">
                                Показывать до
                              </span>
                              <input
                                type="datetime-local"
                                value={slide.activeTo ?? ""}
                                onChange={e =>
                                  updateHeroSlide(slide.id, current => ({
                                    ...current,
                                    activeTo: e.target.value || null,
                                  }))
                                }
                                className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                              />
                            </label>
                          </div>

                          {slide.type === "products" ? (
                            <div className="mt-4 space-y-4 rounded-2xl border border-gray-100 bg-gray-50 p-4">
                              <div className="grid gap-4 md:grid-cols-3">
                                <label className="space-y-2">
                                  <span className="text-sm font-bold text-[#15171A]">
                                    Источник товаров
                                  </span>
                                  <select
                                    value={slide.productSource}
                                    onChange={e =>
                                      updateHeroSlide(slide.id, current => ({
                                        ...current,
                                        productSource: e.target.value as "manual" | "automatic",
                                      }))
                                    }
                                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                                  >
                                    <option value="automatic">Автоматически</option>
                                    <option value="manual">Вручную</option>
                                  </select>
                                </label>
                                <label className="space-y-2 md:col-span-2">
                                  <span className="text-sm font-bold text-[#15171A]">
                                    Автоматическая выборка
                                  </span>
                                  <select
                                    value={slide.autoSource}
                                    onChange={e =>
                                      updateHeroSlide(slide.id, current => ({
                                        ...current,
                                        autoSource: e.target.value as
                                          | "recommended"
                                          | "latest"
                                          | "fallback",
                                      }))
                                    }
                                    disabled={slide.productSource === "manual"}
                                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4] disabled:bg-gray-100"
                                  >
                                    <option value="recommended">Рекомендованные товары</option>
                                    <option value="latest">Последние опубликованные</option>
                                    <option value="fallback">Fallback-выборка витрины</option>
                                  </select>
                                </label>
                              </div>

                              <div className="space-y-3">
                                <div className="text-sm font-black text-[#15171A]">
                                  Ручной список товаров
                                </div>
                                {slide.manualProductIds.length === 0 ? (
                                  <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
                                    Пока ничего не выбрано. Для manual-режима выберите этот
                                    слайд и добавьте товары ниже.
                                  </div>
                                ) : (
                                  slide.manualProductIds.map((productId, productIndex) => {
                                    const product = homepageHeroSelectedProducts?.find(
                                      item => item.id === productId
                                    );
                                    return (
                                      <div
                                        key={productId}
                                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                                      >
                                        <div className="min-w-0">
                                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                                            Карточка {productIndex + 1}
                                          </div>
                                          <div className="mt-1 truncate text-sm font-bold text-[#15171A]">
                                            {product?.name || `Товар #${productId}`}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveHeroManualProduct(slide.id, productId, -1)
                                            }
                                            disabled={productIndex === 0}
                                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 disabled:opacity-40"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              moveHeroManualProduct(slide.id, productId, 1)
                                            }
                                            disabled={
                                              productIndex === slide.manualProductIds.length - 1
                                            }
                                            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 disabled:opacity-40"
                                          >
                                            ↓
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeHeroManualProduct(slide.id, productId)
                                            }
                                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600"
                                          >
                                            Убрать
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          ) : null}

                          {slide.type === "categories" ? (
                            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600">
                              Если список slug пустой, storefront возьмёт верхние категории
                              каталога автоматически. Позже сюда можно добавить ручной подбор
                              разделов.
                            </div>
                          ) : null}

                          {slide.type === "brands" ? (
                            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4 text-sm leading-6 text-gray-600">
                              Брендовый слайд собирает витрину из производителей с логотипами.
                              Если slug-подбор не задан, покажем лидирующие бренды каталога.
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  {activeHeroSlide?.type === "products" ? (
                    <div className="rounded-2xl border border-gray-200 bg-white p-5">
                      <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                        <Package2 size={16} className="text-[#05C3D4]" />
                        Подобрать товары для выбранного слайда
                      </div>
                      <p className="mt-2 text-xs leading-5 text-gray-500">
                        Поиск работает по названию и slug. Добавляем только видимые карточки сайта.
                      </p>
                      <input
                        value={heroProductSearch}
                        onChange={e => setHeroProductSearch(e.target.value)}
                        placeholder="Например: iPhone, HOCO, колонка"
                        className="mt-4 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                      <div className="mt-4 space-y-2">
                        {(heroProductSearchResults?.items ?? []).map(product => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-[#15171A]">
                                {product.name}
                              </div>
                              <div className="mt-1 text-xs text-gray-500">
                                {product.slug} · {product.categoryName || "Без категории"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                activeHeroSlide &&
                                addHeroManualProduct(activeHeroSlide.id, product.id)
                              }
                              disabled={activeHeroSlide.manualProductIds.includes(product.id)}
                              className="shrink-0 rounded-xl bg-[#05C3D4] px-3 py-2 text-xs font-black text-black disabled:opacity-40"
                            >
                              {activeHeroSlide.manualProductIds.includes(product.id)
                                ? "Добавлен"
                                : "Добавить"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {activeHeroSlide ? (
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.36fr)_minmax(0,0.64fr)]">
                      <div className="rounded-2xl border border-gray-200 bg-white p-5">
                        <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                          <ShieldCheck size={16} className="text-[#05C3D4]" />
                          Проверка конфигурации
                        </div>
                        <div className="mt-4 space-y-3">
                          {activeHeroSlideWarnings.length > 0 ? (
                            activeHeroSlideWarnings.map(warning => (
                              <div
                                key={warning}
                                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800"
                              >
                                {warning}
                              </div>
                            ))
                          ) : (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                              Слайд выглядит валидно: можно публиковать без явных контентных рисков.
                            </div>
                          )}
                          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-6 text-gray-600">
                            Проверяем базовые риски: пустой anchor, слишком длинный текст,
                            битые CTA и ручные product-слайды без карточек.
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-white p-3 md:p-4">
                        <div className="mb-4 flex items-center justify-between gap-3 px-2">
                          <div>
                            <div className="text-sm font-black text-[#15171A]">Preview hero-слайда</div>
                            <div className="mt-1 text-xs leading-5 text-gray-500">
                              Быстрый storefront-preview без публикации.
                            </div>
                          </div>
                          <span className="inline-flex rounded-full bg-[#EAFBFD] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                            {heroSlideTypeMeta[activeHeroSlide.type].label}
                          </span>
                        </div>
                        {activeHeroSlidePreview ? (
                          <div className="overflow-hidden rounded-[28px] border border-gray-100">
                            <HeroPromoDynamic hero={activeHeroSlidePreview} preview />
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : homepageHeroVariant === "promo_showcase" ||
                homepageHeroVariant === "promo_showcase_3d" ? (
                <div className="space-y-5">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,0.42fr)_minmax(0,0.58fr)]">
                    <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                      <div>
                        <div className="text-sm font-black text-[#15171A]">
                          {homepageHeroVariant === "promo_showcase_3d"
                            ? "3D промо-витрина"
                            : "Умная промо-витрина"}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-gray-500">
                          {homepageHeroVariant === "promo_showcase_3d"
                            ? "Этот режим использует ту же подборку скидочных товаров, но выводит её в объёмной hero-сцене с плавающими карточками, ручным переключением табов и акцентом на вау-эффект."
                            : "Этот режим автоматически собирает hero из скидочных товаров. Сейчас витрина на главной показывает только табы сценариев и товарный слайдер в стиле блока «Товары недели» без category-rail, spotlight и лишнего текста."}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <label className="space-y-2">
                          <span className="text-sm font-bold text-[#15171A]">
                            Карточек в табе
                          </span>
                          <input
                            type="number"
                            min={4}
                            max={12}
                            value={homepagePromoShowcase.cardsPerTab}
                            onChange={e =>
                              updateHomepagePromoShowcase(current => ({
                                ...current,
                                cardsPerTab: Math.min(
                                  12,
                                  Math.max(4, Number(e.target.value) || 8)
                                ),
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-bold text-[#15171A]">
                            Eyebrow
                          </span>
                          <input
                            value={homepagePromoShowcase.eyebrow}
                            onChange={e =>
                              updateHomepagePromoShowcase(current => ({
                                ...current,
                                eyebrow: e.target.value,
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-sm font-bold text-[#15171A]">
                            Акцент
                          </span>
                          <input
                            value={homepagePromoShowcase.accent}
                            onChange={e =>
                              updateHomepagePromoShowcase(current => ({
                                ...current,
                                accent: e.target.value,
                              }))
                            }
                            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                          />
                        </label>
                      </div>

                      <div className="rounded-2xl border border-[#05C3D4]/16 bg-[#EAFBFD] px-4 py-4 text-sm leading-6 text-slate-700">
                        Закреплённые товары не выводятся отдельным главным блоком. Они
                        получают приоритет внутри витрины, а исключённые позиции не попадут
                        ни в один сценарий.
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-[#15171A]">
                            Preview промо-витрины
                          </div>
                          <div className="mt-1 text-xs leading-5 text-gray-500">
                            Живой storefront-preview на текущих настройках.
                          </div>
                        </div>
                        <span className="inline-flex rounded-full bg-[#EAFBFD] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                          {isPromoShowcasePreviewFetching ? "Обновляем" : "Актуально"}
                        </span>
                      </div>

                      {homepagePromoShowcasePreview ? (
                        <div className="overflow-hidden rounded-[28px] border border-gray-100">
                          {homepageHeroVariant === "promo_showcase_3d" ? (
                            <HeroPromoShowcase3D showcase={homepagePromoShowcasePreview} />
                          ) : (
                            <HeroPromoShowcase showcase={homepagePromoShowcasePreview} />
                          )}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
                          Пока нечего показать: promo-витрина не собрала достаточное количество
                          скидочных карточек для preview.
                        </div>
                      )}

                      {homepagePromoShowcasePreview ? (
                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                              Кандидатов
                            </div>
                            <div className="mt-2 text-lg font-black text-[#15171A]">
                              {homepagePromoShowcasePreview.diagnostics.candidateCount}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                              Табов
                            </div>
                            <div className="mt-2 text-lg font-black text-[#15171A]">
                              {homepagePromoShowcasePreview.diagnostics.activeTabs}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">
                              Карточек в первом табе
                            </div>
                            <div className="mt-2 text-lg font-black text-[#15171A]">
                              {homepagePromoShowcasePreview.tabs[0]?.products.length ?? 0}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                      <Package2 size={16} className="text-[#05C3D4]" />
                      Закрепления и исключения
                    </div>
                    <p className="mt-2 text-xs leading-5 text-gray-500">
                      Закрепляйте товары, которые должны попадать в hero первыми, и скрывайте
                      позиции, которые нельзя использовать в promo-витрине.
                    </p>

                    <input
                      value={heroProductSearch}
                      onChange={e => setHeroProductSearch(e.target.value)}
                      placeholder="Например: скидка, HOCO, смартфон, кабель"
                      className="mt-4 h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />

                    <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,0.56fr)_minmax(0,0.44fr)]">
                      <div className="space-y-2">
                        {(heroProductSearchResults?.items ?? []).map(product => {
                          const isPinned = homepagePromoShowcase.pinnedProductIds.includes(product.id);
                          const isExcluded = homepagePromoShowcase.excludedProductIds.includes(
                            product.id
                          );

                          return (
                            <div
                              key={product.id}
                              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-bold text-[#15171A]">
                                  {product.name}
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                  {product.slug} · {product.categoryName || "Без категории"}
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    isPinned
                                      ? removePromoManagedProduct("pinnedProductIds", product.id)
                                      : addPromoManagedProduct("pinnedProductIds", product.id)
                                  }
                                  className={`rounded-xl px-3 py-2 text-xs font-black ${
                                    isPinned
                                      ? "bg-[#05C3D4] text-black"
                                      : "border border-gray-200 text-gray-700"
                                  }`}
                                >
                                  {isPinned ? "Закреплён" : "Закрепить"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    isExcluded
                                      ? removePromoManagedProduct(
                                          "excludedProductIds",
                                          product.id
                                        )
                                      : addPromoManagedProduct("excludedProductIds", product.id)
                                  }
                                  className={`rounded-xl px-3 py-2 text-xs font-black ${
                                    isExcluded
                                      ? "bg-[#15171A] text-white"
                                      : "border border-gray-200 text-gray-700"
                                  }`}
                                >
                                  {isExcluded ? "Скрыт" : "Исключить"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="grid gap-4">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-[#15171A]">
                              Закреплённые товары
                            </div>
                            <span className="rounded-full bg-[#EAFBFD] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                              {homepagePromoShowcase.pinnedProductIds.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {homepagePromoShowcase.pinnedProductIds.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
                                Нет закреплений. Витрина будет полностью собираться автоматически.
                              </div>
                            ) : (
                              homepagePromoShowcase.pinnedProductIds.map((productId, index) => {
                                const product = promoManagedProductsById.get(productId);
                                return (
                                  <div
                                    key={productId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[#05C3D4]">
                                        Позиция {index + 1}
                                      </div>
                                      <div className="mt-1 truncate text-sm font-bold text-[#15171A]">
                                        {product?.name || `Товар #${productId}`}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          movePromoManagedProduct(
                                            "pinnedProductIds",
                                            productId,
                                            -1
                                          )
                                        }
                                        disabled={index === 0}
                                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 disabled:opacity-40"
                                      >
                                        ↑
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          movePromoManagedProduct(
                                            "pinnedProductIds",
                                            productId,
                                            1
                                          )
                                        }
                                        disabled={
                                          index ===
                                          homepagePromoShowcase.pinnedProductIds.length - 1
                                        }
                                        className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 disabled:opacity-40"
                                      >
                                        ↓
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removePromoManagedProduct("pinnedProductIds", productId)
                                        }
                                        className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600"
                                      >
                                        Убрать
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-black text-[#15171A]">
                              Исключённые товары
                            </div>
                            <span className="rounded-full bg-gray-200 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-gray-700">
                              {homepagePromoShowcase.excludedProductIds.length}
                            </span>
                          </div>
                          <div className="mt-3 space-y-2">
                            {homepagePromoShowcase.excludedProductIds.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
                                Исключений пока нет.
                              </div>
                            ) : (
                              homepagePromoShowcase.excludedProductIds.map(productId => {
                                const product = promoManagedProductsById.get(productId);
                                return (
                                  <div
                                    key={productId}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-bold text-[#15171A]">
                                        {product?.name || `Товар #${productId}`}
                                      </div>
                                      <div className="mt-1 text-xs text-gray-500">
                                        Не попадёт в spotlight и ни в один таб.
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removePromoManagedProduct("excludedProductIds", productId)
                                      }
                                      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600"
                                    >
                                      Вернуть
                                    </button>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <span className="font-black text-[#15171A]">Сейчас на сайте:</span>{" "}
                {homepageHeroVariant === "interactive"
                  ? "визуальный promo-hero со слайдами"
                  : homepageHeroVariant === "promo_showcase"
                    ? "умная promo-витрина скидочных товаров"
                    : homepageHeroVariant === "promo_showcase_3d"
                      ? "3D promo-витрина скидочных товаров"
                    : "классический hero (текущая версия)"}.
                {homepageHeroSettings?.isDefault ? (
                  <span>
                    {" "}
                    Настройка ещё не менялась вручную, поэтому используется сохранённый
                    базовый вариант.
                  </span>
                ) : null}
              </div>

              {saveHomepageHeroMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveHomepageHeroMutation.error.message}
                </div>
              ) : null}
            </div>
          </AdminSection>

          <AdminSection
            title="Snapshot главной страницы"
            description="Главная теперь может отдаваться из заранее собранного JSON-снимка. Это ускоряет первый ответ, переживает рестарты и даёт понятный ручной контроль."
            tone="accent"
            actions={
              <button
                onClick={() => refreshHomepageSnapshotMutation.mutate()}
                disabled={refreshHomepageSnapshotMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {refreshHomepageSnapshotMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCcw size={16} />
                )}
                Пересобрать главную
              </button>
            }
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Snapshot
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.hasSnapshot ? "Есть" : "Ещё не собран"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {homepageSnapshotStatus?.generatedAt
                    ? new Date(homepageSnapshotStatus.generatedAt).toLocaleString("ru-RU")
                    : "После первой сборки здесь появится время генерации"}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Состояние
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.refreshInProgress
                    ? "Пересобирается"
                    : homepageSnapshotStatus?.isStale
                      ? "Устарел"
                      : "Свежий"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  TTL: {homepageSnapshotStatus?.ttlMinutes ?? 5} минут
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Возраст
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.ageSeconds !== null &&
                  homepageSnapshotStatus?.ageSeconds !== undefined
                    ? `${Math.round(homepageSnapshotStatus.ageSeconds / 60)} мин`
                    : "—"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Пока snapshot свежий, главная не ждёт live-сборку
                </div>
              </div>
              <div className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-500">
                  Время сборки
                </div>
                <div className="mt-2 text-lg font-black text-[#15171A]">
                  {homepageSnapshotStatus?.buildMs !== null &&
                  homepageSnapshotStatus?.buildMs !== undefined
                    ? `${homepageSnapshotStatus.buildMs} мс`
                    : "—"}
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Версия: {homepageSnapshotStatus?.sourceVersion || "homepage_snapshot_v1"}
                </div>
              </div>
            </div>

            {homepageSnapshotStatus?.lastError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Последняя ошибка пересборки: {homepageSnapshotStatus.lastError}
              </div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                Публичная главная читает заранее собранный snapshot из базы. Если снимок устарел, витрина всё равно отдаёт его сразу и тихо запускает обновление в фоне.
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="Профиль сайта и продавца"
            description="Единый источник контактов, реквизитов и правовых текстов. Эти данные должны потом использоваться в Header, Footer, Контактах, checkout и документах без захардкоженных строк."
            tone="accent"
            actions={
              <button
                onClick={() => saveSiteProfileMutation.mutate(siteProfileForm)}
                disabled={saveSiteProfileMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveSiteProfileMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить профиль сайта
              </button>
            }
          >
            <div className="space-y-8">
              <div className="grid gap-8 xl:grid-cols-2">
                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Публичные контакты</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Эти данные пойдут в Header, Footer, Контакты, mobile bar и trust-блоки сайта.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон для ссылки</label>
                      <input
                        value={siteProfileForm.contacts.primaryPhone}
                        onChange={e => updateContactField("primaryPhone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон для показа</label>
                      <input
                        value={siteProfileForm.contacts.primaryPhoneDisplay}
                        onChange={e =>
                          updateContactField("primaryPhoneDisplay", e.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Доп. телефон</label>
                      <input
                        value={siteProfileForm.contacts.secondaryPhone}
                        onChange={e => updateContactField("secondaryPhone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="+7 (927) 364-28-88 (доб.3)"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Email</label>
                      <input
                        type="email"
                        value={siteProfileForm.contacts.email}
                        onChange={e => updateContactField("email", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="tech.aks@yandex.ru"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Часы работы</label>
                      <input
                        value={siteProfileForm.contacts.workingHours}
                        onChange={e => updateContactField("workingHours", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Ежедневно 9:00–21:00"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Короткий адрес</label>
                      <input
                        value={siteProfileForm.contacts.shortAddress}
                        onChange={e => updateContactField("shortAddress", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Пенза"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Полный адрес</label>
                      <textarea
                        value={siteProfileForm.contacts.fullAddress}
                        onChange={e => updateContactField("fullAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                        placeholder="Полный почтовый адрес"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Профиль продавца</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Эти данные нужны для оферты, реквизитов сторон, checkout и будущих документов.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Форма</label>
                      <select
                        value={siteProfileForm.seller.legalForm}
                        onChange={e =>
                          updateSellerField("legalForm", e.target.value as "ip" | "ooo")
                        }
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      >
                        <option value="ip">ИП</option>
                        <option value="ooo">ООО</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Короткое имя</label>
                      <input
                        value={siteProfileForm.seller.shortName}
                        onChange={e => updateSellerField("shortName", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Полное наименование</label>
                    <input
                      value={siteProfileForm.seller.fullName}
                      onChange={e => updateSellerField("fullName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Подписант</label>
                      <input
                        value={siteProfileForm.seller.signatoryName}
                        onChange={e => updateSellerField("signatoryName", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Подпись</label>
                      <input
                        value={siteProfileForm.seller.signatoryLabel}
                        onChange={e => updateSellerField("signatoryLabel", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Основание подписания</label>
                    <input
                      value={siteProfileForm.seller.signatoryBasis}
                      onChange={e => updateSellerField("signatoryBasis", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ИНН</label>
                      <input
                        value={siteProfileForm.seller.inn}
                        onChange={e => updateSellerField("inn", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">
                        {siteProfileForm.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН"}
                      </label>
                      <input
                        value={siteProfileForm.seller.ogrnip}
                        onChange={e => updateSellerField("ogrnip", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">КПП</label>
                      <input
                        value={siteProfileForm.seller.kpp}
                        onChange={e => updateSellerField("kpp", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ОКПО</label>
                      <input
                        value={siteProfileForm.seller.okpo}
                        onChange={e => updateSellerField("okpo", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Email продавца</label>
                      <input
                        type="email"
                        value={siteProfileForm.seller.email}
                        onChange={e => updateSellerField("email", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Телефон продавца</label>
                      <input
                        value={siteProfileForm.seller.phone}
                        onChange={e => updateSellerField("phone", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Юридический адрес</label>
                      <textarea
                        value={siteProfileForm.seller.legalAddress}
                        onChange={e => updateSellerField("legalAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Фактический адрес</label>
                      <textarea
                        value={siteProfileForm.seller.actualAddress}
                        onChange={e => updateSellerField("actualAddress", e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-8 xl:grid-cols-2">
                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Банк и реквизиты</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Используются в оферте, реквизитах сторон и будущих документных шаблонах.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Банк</label>
                    <input
                      value={siteProfileForm.bank.bankName}
                      onChange={e => updateBankField("bankName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">Р/с</label>
                      <input
                        value={siteProfileForm.bank.account}
                        onChange={e => updateBankField("account", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">К/с</label>
                      <input
                        value={siteProfileForm.bank.corrAccount}
                        onChange={e => updateBankField("corrAccount", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">БИК</label>
                      <input
                        value={siteProfileForm.bank.bik}
                        onChange={e => updateBankField("bik", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">ИНН банка</label>
                      <input
                        value={siteProfileForm.bank.inn}
                        onChange={e => updateBankField("inn", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#15171A]">КПП банка</label>
                      <input
                        value={siteProfileForm.bank.kpp}
                        onChange={e => updateBankField("kpp", e.target.value)}
                        className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <h3 className="text-sm font-black text-[#15171A]">Preview</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Быстрый контроль того, как выглядит профиль продавца и контактная карточка без переходов по сайту.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Контакты сайта
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[#15171A]">
                      <div className="font-black">{siteProfileForm.contacts.primaryPhoneDisplay}</div>
                      <div>{siteProfileForm.contacts.email}</div>
                      <div className="text-gray-500">{siteProfileForm.contacts.workingHours}</div>
                      <div className="text-gray-500">{siteProfileForm.contacts.fullAddress}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Реквизиты сторон
                    </div>
                    <div className="mt-3 space-y-1 text-sm text-[#15171A]">
                      <div className="font-black">{siteProfileForm.seller.fullName}</div>
                      <div>ИНН: {siteProfileForm.seller.inn}</div>
                      <div>
                        {siteProfileForm.seller.legalForm === "ip" ? "ОГРНИП" : "ОГРН"}:{" "}
                        {siteProfileForm.seller.ogrnip}
                      </div>
                      {siteProfileForm.seller.kpp ? <div>КПП: {siteProfileForm.seller.kpp}</div> : null}
                      {siteProfileForm.seller.okpo ? <div>ОКПО: {siteProfileForm.seller.okpo}</div> : null}
                      <div>{siteProfileForm.bank.bankName}</div>
                      <div>р/с: {siteProfileForm.bank.account}</div>
                      <div>к/с: {siteProfileForm.bank.corrAccount}</div>
                      <div>БИК: {siteProfileForm.bank.bik}</div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#05C3D4]">
                      Подпись и footer
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-[#15171A]">
                      <div>{siteProfileForm.documents.signatureName}</div>
                      <div className="font-black">______________ {siteProfileForm.documents.signatureLabel}</div>
                      <div className="text-gray-500">{siteProfileForm.documents.requisitesFooter}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                <div>
                  <h3 className="text-sm font-black text-[#15171A]">Правовые тексты</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Эти тексты используются для оферты, политики обработки данных, оплаты/доставки и возврата. В этой фазе храним их как безопасный форматированный текст без произвольного HTML.
                  </p>
                </div>
                <div className="grid gap-5 xl:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок оферты</label>
                    <input
                      value={siteProfileForm.legalTexts.offerTitle}
                      onChange={e => updateLegalField("offerTitle", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок политики</label>
                    <input
                      value={siteProfileForm.legalTexts.privacyPolicyTitle}
                      onChange={e => updateLegalField("privacyPolicyTitle", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Оферта</label>
                    <textarea
                      value={siteProfileForm.legalTexts.offerContent}
                      onChange={e => updateLegalField("offerContent", e.target.value)}
                      rows={9}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Политика обработки данных</label>
                    <textarea
                      value={siteProfileForm.legalTexts.privacyPolicyContent}
                      onChange={e => updateLegalField("privacyPolicyContent", e.target.value)}
                      rows={9}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок оплаты и доставки</label>
                    <input
                      value={siteProfileForm.legalTexts.paymentDeliveryTitle}
                      onChange={e =>
                        updateLegalField("paymentDeliveryTitle", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Заголовок возврата</label>
                    <input
                      value={siteProfileForm.legalTexts.returnsPolicyTitle}
                      onChange={e =>
                        updateLegalField("returnsPolicyTitle", e.target.value)
                      }
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Оплата и доставка</label>
                    <textarea
                      value={siteProfileForm.legalTexts.paymentDeliveryContent}
                      onChange={e =>
                        updateLegalField("paymentDeliveryContent", e.target.value)
                      }
                      rows={8}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Возврат и обмен</label>
                    <textarea
                      value={siteProfileForm.legalTexts.returnsPolicyContent}
                      onChange={e =>
                        updateLegalField("returnsPolicyContent", e.target.value)
                      }
                      rows={8}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Имя подписанта в документах</label>
                    <input
                      value={siteProfileForm.documents.signatureName}
                      onChange={e => updateDocumentField("signatureName", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#15171A]">Сокращённая подпись</label>
                    <input
                      value={siteProfileForm.documents.signatureLabel}
                      onChange={e => updateDocumentField("signatureLabel", e.target.value)}
                      className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-bold text-[#15171A]">Footer реквизитов</label>
                    <textarea
                      value={siteProfileForm.documents.requisitesFooter}
                      onChange={e => updateDocumentField("requisitesFooter", e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-[#05C3D4]"
                    />
                  </div>
                </div>

                {saveSiteProfileMutation.error ? (
                  <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {saveSiteProfileMutation.error.message}
                  </div>
                ) : null}
              </div>
            </div>
          </AdminSection>

          <AdminSection
            title="Резерв товара"
            description="Срок действия резерва используется на карточке товара и в админке. После истечения срока резерв перестаёт уменьшать доступный остаток."
          >
            <div className="space-y-5">
              <div className="max-w-md space-y-2">
                <label className="text-sm font-bold text-[#15171A]">
                  Срок действия резерва (в минутах)
                </label>
                <input
                  type="number"
                  min={15}
                  max={10080}
                  value={reservationDurationMinutes}
                  onChange={e =>
                    setReservationDurationMinutes(Math.max(15, Number(e.target.value) || 180))
                  }
                  className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                />
                <p className="text-xs text-gray-500">
                  По умолчанию резерв держится 180 минут. Истёкшие резервы больше не уменьшают доступный остаток.
                </p>
              </div>

              {saveReservationSettingsMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveReservationSettingsMutation.error.message}
                </div>
              ) : null}

              <button
                onClick={() =>
                  saveReservationSettingsMutation.mutate({
                    durationMinutes: reservationDurationMinutes,
                  })
                }
                disabled={saveReservationSettingsMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveReservationSettingsMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить срок резерва
              </button>
            </div>
          </AdminSection>

          <AdminSection
            title="Техническое обслуживание"
            description="Временное отключение сайта для пользователей. В это время показывается страница-заглушка с обратным отсчетом."
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={maintenanceEnabled}
                    onChange={e => setMaintenanceEnabled(e.target.checked)}
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#05C3D4] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#05C3D4]/20"></div>
                </label>
                <span className="text-sm font-bold text-[#15171A]">
                  {maintenanceEnabled ? "Сайт отключен" : "Сайт активен"}
                </span>
              </div>

              {maintenanceEnabled ? (
                <div className="max-w-md space-y-2">
                  <label className="text-sm font-bold text-[#15171A]">
                    Дата и время открытия
                  </label>
                  <input
                    type="datetime-local"
                    value={maintenanceReopenDate}
                    onChange={e => setMaintenanceReopenDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-[#05C3D4]"
                  />
                  <p className="text-xs text-gray-500">
                    Укажите время, когда сайт автоматически вернется в обычный режим.
                  </p>
                </div>
              ) : null}

              {saveMaintenanceMutation.error ? (
                <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {saveMaintenanceMutation.error.message}
                </div>
              ) : null}

              <button
                onClick={() =>
                  saveMaintenanceMutation.mutate({
                    isEnabled: maintenanceEnabled,
                    reopenDate: maintenanceReopenDate || null,
                  })
                }
                disabled={saveMaintenanceMutation.isPending}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#05C3D4] px-4 text-sm font-black text-black disabled:opacity-50"
              >
                {saveMaintenanceMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Save size={16} />
                )}
                Сохранить режим обслуживания
              </button>
            </div>
          </AdminSection>
        </div>
      ) : null}
    </div>
  );
}

function resolveSettingsTab(pathname: string): SettingsTab {
  if (pathname.startsWith("/admin/settings/access")) return "access";
  if (pathname.startsWith("/admin/settings/ai")) return "ai";
  if (pathname.startsWith("/admin/settings/integrations")) return "integrations";
  if (pathname.startsWith("/admin/settings/payment")) return "payment";
  if (pathname.startsWith("/admin/settings/site")) return "site";
  return "profile";
}
