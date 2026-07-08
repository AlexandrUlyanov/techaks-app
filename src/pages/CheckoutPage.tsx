import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  CreditCard,
  CheckCircle2,
  Truck,
  Building2,
  ShieldCheck,
  ShoppingCart,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import { useSeo } from "@/lib/seo";
import { useAuth } from "@/hooks/use-auth";
import { useCartAvailability } from "@/hooks/use-cart-availability";
import { applyProductImageFallback, resolveProductImageSrc } from "@/lib/product-images";
import PersonalDataConsent from "@/components/PersonalDataConsent";
import { trackBeginCheckout } from "@/lib/yandex-metrika";
import { storeCheckoutOrderSnapshot } from "@/lib/checkout-order-session";

type CheckoutPickupStore = {
  storeId: number;
  storeName: string;
  storeAddress: string;
  storePhone?: string | null;
  storeHours?: string | null;
  rawStockQty: number;
  activeReservedQty: number;
  availableQty: number;
  hasConflict: boolean;
};

type DeliveryAddressSuggestion = {
  label: string;
  street: string;
  house: string;
  coordinates: [number, number] | null;
};

type DeliveryStreetSuggestion = {
  label: string;
  street: string;
};

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

const DELIVERY_STREET_PREFIXES = new Set([
  "ул",
  "улица",
  "пр",
  "проспект",
  "пр-кт",
  "переулок",
  "пер",
  "проезд",
  "площадь",
  "пл",
  "бульвар",
  "бул",
  "шоссе",
  "ш",
  "набережная",
  "наб",
  "аллея",
  "линия",
  "тракт",
  "тупик",
  "туп",
  "мкр",
  "микрорайон",
]);

function normalizeDeliveryStreetName(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(part => !DELIVERY_STREET_PREFIXES.has(part))
    .join(" ");
}

function isLikelyValidDeliveryStreet(value: string) {
  const street = normalizeWhitespace(value);
  if (street.length < 4 || street.length > 80) return false;
  if (!/[A-Za-zА-Яа-яЁё]/.test(street)) return false;
  if (/^\d+$/.test(street)) return false;
  return true;
}

function isLikelyValidDeliveryHouse(value: string) {
  const house = normalizeWhitespace(value);
  if (!house) return false;
  return /^\d{1,4}[A-Za-zА-Яа-яЁё]?(?:[\/-]\d{1,4}[A-Za-zА-Яа-яЁё]?)?(?:\s?(?:к|корп|корпус|стр|строение)\.?\s?\d{1,3}[A-Za-zА-Яа-яЁё]?)?$/i.test(
    house,
  );
}

function buildCheckoutDeliveryAddress(params: {
  street: string;
  house: string;
  apartment: string;
}) {
  const street = normalizeWhitespace(params.street);
  const house = normalizeWhitespace(params.house);
  const apartment = normalizeWhitespace(params.apartment);

  const base = [street, house].filter(Boolean).join(", ");
  if (!base) return "";

  return apartment ? `${base}, кв./офис ${apartment}` : base;
}

export default function CheckoutPage() {
  useSeo({
    title: "Оформление заказа — ТЕХАКС",
    description: "Оформление заказа в интернет-магазине ТЕХАКС.",
    canonicalPath: "/checkout",
    noindex: true,
  });

  const {
    items,
    getTotalPrice,
    getItemCount,
    updateQuantity,
    removeItem,
    clearCart,
  } = useCart();
  const cartAvailability = useCartAvailability();
  const [orderId, setOrderId] = useState<number | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { user, isAuthenticated } = useAuth();
  const { data: yookassaStatus } = trpc.settings.getPublicYooKassaStatus.useQuery();
  const [useBonuses, setUseBonuses] = useState(false);
  const [bonusAmountInput, setBonusAmountInput] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Form States
  const [customer, setCustomer] = useState({
    fullName: "",
    phone: "",
    email: "",
  });

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    setCustomer(prev => ({
      fullName: prev.fullName || user.fullName || "",
      phone: prev.phone || user.phone || "",
      email: prev.email || user.email || "",
    }));
  }, [isAuthenticated, user]);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">(
    "pickup"
  );
  const [pickupStoreId, setPickupStoreId] = useState<number | null>(null);
  const [deliveryStreet, setDeliveryStreet] = useState("");
  const [deliveryHouse, setDeliveryHouse] = useState("");
  const [deliveryApartment, setDeliveryApartment] = useState("");
  const [deliveryStreetFocused, setDeliveryStreetFocused] = useState(false);
  const [deliveryStreetActiveIndex, setDeliveryStreetActiveIndex] = useState(-1);
  const [debouncedDeliveryAddress, setDebouncedDeliveryAddress] = useState("");
  const [confirmedDeliveryStreet, setConfirmedDeliveryStreet] = useState<string | null>(null);
  const [pendingDeliverySuggestion, setPendingDeliverySuggestion] =
    useState<DeliveryAddressSuggestion | null>(null);
  const [confirmedDeliverySuggestion, setConfirmedDeliverySuggestion] =
    useState<DeliveryAddressSuggestion | null>(null);
  const [paymentType, setPaymentType] = useState<"cash" | "card" | "yookassa">(
    "cash"
  );
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const checkoutTrackedSignatureRef = useRef<string | null>(null);
  const deliveryStreetFieldRef = useRef<HTMLDivElement | null>(null);
  const deliveryHouseInputRef = useRef<HTMLInputElement | null>(null);
  const { data: pickupStores = [], isFetching: pickupStoresLoading } =
    trpc.ecommerce.getCheckoutPickupStores.useQuery(
      {
        items: items.map(item => ({
          productId: item.id,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        })),
      },
      {
        enabled: items.length > 0,
        refetchOnWindowFocus: false,
      }
    );

  const typedPickupStores = pickupStores as CheckoutPickupStore[];
  const subtotal = getTotalPrice();
  const parsedBonusAmount = Math.max(0, Number.parseInt(bonusAmountInput || "0", 10) || 0);
  const { data: loyaltyState, isFetching: loyaltyStateRefreshing } =
    trpc.ecommerce.getMyLoyaltyState.useQuery(
      { refresh: false },
      {
        enabled: isAuthenticated,
        refetchOnWindowFocus: false,
      }
    );
  const { data: loyaltyPreview, isFetching: loyaltyPreviewLoading } =
    trpc.ecommerce.previewBonusWriteoff.useQuery(
      {
        subtotal,
        requestedAmount: useBonuses ? parsedBonusAmount : 0,
      },
      {
        enabled: isAuthenticated && Boolean(loyaltyState?.enabled),
        refetchOnWindowFocus: false,
      }
    );
  const effectiveBonusSpent = useBonuses
    ? Math.max(0, loyaltyPreview?.appliedAmount ?? 0)
    : 0;

  useEffect(() => {
    if (deliveryType !== "delivery") {
      setDebouncedDeliveryAddress("");
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedDeliveryAddress(normalizedDeliveryAddress);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [deliveryType, deliveryStreet, deliveryHouse, deliveryApartment]);

  useEffect(() => {
    if (deliveryType === "delivery" && paymentType !== "yookassa") {
      setPaymentType("yookassa");
    }
  }, [deliveryType, paymentType]);

  const normalizedDeliveryAddress = buildCheckoutDeliveryAddress({
    street: deliveryStreet,
    house: deliveryHouse,
    apartment: deliveryApartment,
  });
  const deliveryAddressSearchStreet = normalizeWhitespace(deliveryStreet);
  const deliveryAddressSearchHouse = normalizeWhitespace(deliveryHouse);
  const canSearchDeliveryStreetSuggestions =
    deliveryType === "delivery" &&
    deliveryAddressSearchStreet.length >= 2 &&
    /[A-Za-zА-Яа-яЁё]/.test(deliveryAddressSearchStreet) &&
    !/^\d+$/.test(deliveryAddressSearchStreet);
  const isDeliveryStreetValid = isLikelyValidDeliveryStreet(deliveryStreet);
  const isDeliveryHouseValid = isLikelyValidDeliveryHouse(deliveryHouse);
  const hasStartedDeliveryAddress =
    deliveryAddressSearchStreet.length > 0 || deliveryAddressSearchHouse.length > 0;
  const isDeliveryAddressInputValid =
    isDeliveryStreetValid && isDeliveryHouseValid;
  const confirmedStreetMatchesCurrentInput =
    confirmedDeliveryStreet !== null &&
    normalizeDeliveryStreetName(confirmedDeliveryStreet) ===
      normalizeDeliveryStreetName(deliveryAddressSearchStreet);
  const confirmedSuggestionMatchesCurrentInput =
    confirmedDeliverySuggestion !== null &&
    normalizeDeliveryStreetName(confirmedDeliverySuggestion.street) ===
      normalizeDeliveryStreetName(deliveryAddressSearchStreet) &&
    normalizeWhitespace(confirmedDeliverySuggestion.house) ===
      deliveryAddressSearchHouse;
  const pendingSuggestionMatchesCurrentInput =
    pendingDeliverySuggestion !== null &&
    normalizeDeliveryStreetName(pendingDeliverySuggestion.street) ===
      normalizeDeliveryStreetName(deliveryAddressSearchStreet) &&
    normalizeWhitespace(pendingDeliverySuggestion.house) ===
      deliveryAddressSearchHouse;
  const isDeliveryQuoteCurrent =
    deliveryType !== "delivery" ||
    normalizedDeliveryAddress.length === 0 ||
    normalizedDeliveryAddress === debouncedDeliveryAddress.trim();
  const shouldSearchDeliveryAddressSuggestions =
    deliveryType === "delivery" &&
    deliveryAddressSearchStreet.length >= 3 &&
    deliveryAddressSearchHouse.length >= 1 &&
    isDeliveryStreetValid &&
    confirmedStreetMatchesCurrentInput;

  const {
    data: deliveryStreetSuggestions = [],
    isFetching: deliveryStreetSuggestionsLoading,
  } = trpc.ecommerce.searchPenzaDeliveryStreets.useQuery(
    {
      street: deliveryAddressSearchStreet,
    },
    {
      enabled: canSearchDeliveryStreetSuggestions,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );
  const typedDeliveryStreetSuggestions =
    deliveryStreetSuggestions as DeliveryStreetSuggestion[];

  const selectDeliveryStreetSuggestion = useCallback((street: string) => {
    setDeliveryStreet(street);
    setConfirmedDeliveryStreet(street);
    setPendingDeliverySuggestion(null);
    setConfirmedDeliverySuggestion(null);
    setDeliveryStreetFocused(false);
    setDeliveryStreetActiveIndex(-1);
    window.setTimeout(() => {
      deliveryHouseInputRef.current?.focus();
      deliveryHouseInputRef.current?.select();
    }, 0);
  }, []);

  const renderHighlightedStreetLabel = useCallback(
    (label: string) => {
      const query = deliveryAddressSearchStreet.trim();
      if (!query) return label;

      const labelLower = label.toLocaleLowerCase("ru");
      const queryLower = query.toLocaleLowerCase("ru");
      const matchIndex = labelLower.indexOf(queryLower);

      if (matchIndex < 0) return label;

      const matchEnd = matchIndex + query.length;

      return (
        <>
          {label.slice(0, matchIndex)}
          <span className="text-[#05C3D4]">{label.slice(matchIndex, matchEnd)}</span>
          {label.slice(matchEnd)}
        </>
      );
    },
    [deliveryAddressSearchStreet]
  );

  const {
    data: deliveryAddressSuggestions = [],
    isFetching: deliveryAddressSuggestionsLoading,
  } = trpc.ecommerce.searchPenzaDeliveryAddresses.useQuery(
    {
      street: deliveryAddressSearchStreet,
      house: deliveryAddressSearchHouse,
    },
    {
      enabled:
        shouldSearchDeliveryAddressSuggestions &&
        !confirmedSuggestionMatchesCurrentInput,
      refetchOnWindowFocus: false,
      retry: false,
    }
  );

  const hasConfirmedDeliveryAddress =
    deliveryType === "delivery" &&
    confirmedSuggestionMatchesCurrentInput &&
    isDeliveryAddressInputValid;
  const shouldFetchYandexQuote =
    deliveryType === "delivery" &&
    items.length > 0 &&
    isDeliveryAddressInputValid &&
    confirmedSuggestionMatchesCurrentInput &&
    debouncedDeliveryAddress.trim().length >= 6;
  const canConfirmTypedDeliveryAddress =
    deliveryType === "delivery" &&
    confirmedStreetMatchesCurrentInput &&
    isDeliveryAddressInputValid &&
    !confirmedSuggestionMatchesCurrentInput &&
    !deliveryAddressSuggestionsLoading &&
    !pendingSuggestionMatchesCurrentInput &&
    deliveryAddressSuggestions.length === 0;

  useEffect(() => {
    if (deliveryType !== "delivery") {
      setConfirmedDeliveryStreet(null);
      setPendingDeliverySuggestion(null);
      setConfirmedDeliverySuggestion(null);
      return;
    }

    if (confirmedDeliveryStreet && !confirmedStreetMatchesCurrentInput) {
      setConfirmedDeliveryStreet(null);
    }

    if (pendingDeliverySuggestion && !pendingSuggestionMatchesCurrentInput) {
      setPendingDeliverySuggestion(null);
    }

    if (
      confirmedDeliverySuggestion &&
      !confirmedSuggestionMatchesCurrentInput
    ) {
      setConfirmedDeliverySuggestion(null);
    }
  }, [
    confirmedDeliveryStreet,
    confirmedStreetMatchesCurrentInput,
    confirmedDeliverySuggestion,
    confirmedSuggestionMatchesCurrentInput,
    deliveryType,
    pendingDeliverySuggestion,
    pendingSuggestionMatchesCurrentInput,
  ]);

  useEffect(() => {
    if (!deliveryStreetFocused || deliveryStreetSuggestionsLoading) {
      setDeliveryStreetActiveIndex(-1);
      return;
    }

    if (typedDeliveryStreetSuggestions.length === 0) {
      setDeliveryStreetActiveIndex(-1);
      return;
    }

    setDeliveryStreetActiveIndex(currentIndex => {
      if (currentIndex < 0) return 0;
      return Math.min(currentIndex, typedDeliveryStreetSuggestions.length - 1);
    });
  }, [
    deliveryStreetFocused,
    typedDeliveryStreetSuggestions,
    deliveryStreetSuggestionsLoading,
  ]);

  useEffect(() => {
    if (!deliveryStreetFocused) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (deliveryStreetFieldRef.current?.contains(target)) return;
      setDeliveryStreetFocused(false);
      setDeliveryStreetActiveIndex(-1);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [deliveryStreetFocused]);

  useEffect(() => {
    if (deliveryType !== "delivery") return;
    if (!deliveryAddressSearchStreet || typedDeliveryStreetSuggestions.length === 0) {
      return;
    }

    const normalizedTypedStreet =
      normalizeDeliveryStreetName(deliveryAddressSearchStreet);
    if (!normalizedTypedStreet) return;

    const exactStreetMatch = typedDeliveryStreetSuggestions.find(suggestion => {
      return (
        normalizeDeliveryStreetName(suggestion.street) ===
        normalizedTypedStreet
      );
    });

    if (!exactStreetMatch) return;
    if (
      confirmedDeliveryStreet &&
      normalizeWhitespace(confirmedDeliveryStreet) ===
        normalizeWhitespace(exactStreetMatch.street)
    ) {
      return;
    }

    setConfirmedDeliveryStreet(exactStreetMatch.street);
  }, [
    confirmedDeliveryStreet,
    deliveryAddressSearchStreet,
    deliveryType,
    typedDeliveryStreetSuggestions,
  ]);

  const { data: yandexDeliveryQuote, isFetching: yandexDeliveryQuoteLoading, error: yandexDeliveryQuoteError } =
    trpc.ecommerce.getYandexDeliveryQuote.useQuery(
      {
        items: items.map(item => ({
          productId: item.id,
          variantId: item.variantId ?? null,
          quantity: item.quantity,
        })),
        street: normalizeWhitespace(deliveryStreet),
        house: normalizeWhitespace(deliveryHouse),
        apartment: normalizeWhitespace(deliveryApartment) || null,
        storeId: pickupStoreId,
      },
      {
        enabled: shouldFetchYandexQuote,
        refetchOnWindowFocus: false,
        retry: false,
      }
    );

  const hasResolvedDeliveryQuote =
    hasConfirmedDeliveryAddress &&
    isDeliveryQuoteCurrent &&
    Boolean(yandexDeliveryQuote?.available) &&
    typeof yandexDeliveryQuote?.price === "number";
  const deliveryPrice = hasResolvedDeliveryQuote
    ? Math.max(0, Number(yandexDeliveryQuote?.price ?? 0))
    : 0;
  const totalWithBonuses = Math.max(0, subtotal - effectiveBonusSpent + deliveryPrice);
  const canSubmitDeliveryOrder =
    deliveryType !== "delivery" ||
    (isDeliveryQuoteCurrent &&
      shouldFetchYandexQuote &&
      !yandexDeliveryQuoteLoading &&
      hasResolvedDeliveryQuote);

  useEffect(() => {
    if (items.length === 0) {
      checkoutTrackedSignatureRef.current = null;
      return;
    }

    const signature = items
      .map(item => `${item.cartKey}:${item.quantity}:${item.price}`)
      .join("|");

    if (checkoutTrackedSignatureRef.current === signature) return;
    checkoutTrackedSignatureRef.current = signature;

    trackBeginCheckout(
      items.map(item => ({
        itemId: String(item.variantId ?? item.id),
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        variant: item.variantName ?? null,
      }))
    );
  }, [items]);

  useEffect(() => {
    if (typedPickupStores.length === 0) {
      setPickupStoreId(null);
      return;
    }

    if (
      pickupStoreId &&
      typedPickupStores.some(store => store.storeId === pickupStoreId)
    ) {
      return;
    }

    setPickupStoreId(typedPickupStores[0]?.storeId ?? null);
  }, [pickupStoreId, typedPickupStores]);

  const placeOrder = trpc.ecommerce.placeOrder.useMutation({
    onSuccess: data => {
      storeCheckoutOrderSnapshot(data.orderId, items);

      if (data.payment?.confirmationUrl) {
        clearCart();
        toast.success("Заказ создан. Переходим к безопасной оплате YooKassa.");
        window.location.href = data.payment.confirmationUrl;
        return;
      }

      if (data.payment?.confirmationToken) {
        clearCart();
        toast.success(
          "Заказ создан. Платёж YooKassa подготовлен, но embedded-форма ещё не подключена."
        );
        setOrderId(data.orderId);
        setIsSuccess(true);
        return;
      }

      setOrderId(data.orderId);
      setIsSuccess(true);
      clearCart();
      toast.success("Заказ успешно оформлен!");
    },
    onError: err => {
      if (err.message.includes("Некоторые товары стали недоступны")) {
        cartAvailability.refetch();
      }
      toast.error(err.message || "Ошибка при оформлении заказа");
    },
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  const handlePlaceOrder = () => {
    const fullName = customer.fullName.trim();
    const phone = customer.phone.trim();
    const email = customer.email.trim() || user?.email?.trim() || "";
    const normalizedAddress =
      confirmedDeliverySuggestion && confirmedSuggestionMatchesCurrentInput
        ? buildCheckoutDeliveryAddress({
            street: confirmedDeliverySuggestion.label,
            house: "",
            apartment: deliveryApartment,
          })
        : normalizedDeliveryAddress;

    if (!fullName || !phone) {
      toast.error("Пожалуйста, заполните контактные данные");
      return;
    }
    if (deliveryType === "delivery" && !normalizedAddress) {
      toast.error("Пожалуйста, укажите адрес доставки");
      return;
    }
    if (
      deliveryType === "delivery" &&
      !confirmedSuggestionMatchesCurrentInput
    ) {
      toast.error("Подтвердите адрес из подсказок перед расчётом и оформлением");
      return;
    }
    if (deliveryType === "pickup" && !pickupStoreId) {
      toast.error("Пожалуйста, выберите магазин для самовывоза");
      return;
    }
    if (!personalDataConsent) {
      toast.error("Подтвердите согласие на обработку персональных данных");
      return;
    }
    if (cartAvailability.isFetching) {
      toast.message("Подождите, проверяем актуальность товаров в корзине");
      return;
    }

    placeOrder.mutate({
      customer: {
        fullName,
        phone,
        email: email.length > 0 ? email : undefined,
      },
      items: items.map(i => ({
        productId: i.id,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
        price: i.price,
      })),
      deliveryType,
      storeId: deliveryType === "pickup" ? pickupStoreId : null,
      address:
        deliveryType === "delivery"
          ? normalizedAddress
          : "Самовывоз из магазина",
      paymentType,
      totalPrice: totalWithBonuses,
      deliveryPrice,
      loyaltyBonusAmount: useBonuses ? effectiveBonusSpent : 0,
    });
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-[#05C3D4]/10 rounded-full flex items-center justify-center mx-auto border border-[#05C3D4]/20">
            <CheckCircle2 size={48} className="text-[#05C3D4]" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black uppercase font-heading tracking-tighter text-foreground">
              Заказ принят!
            </h1>
            <p className="text-muted-foreground font-medium">
              Номер вашего заказа:{" "}
              <span className="text-foreground font-black">#{orderId}</span>.{" "}
              <br />
              Мы свяжемся с вами в течение 5 минут для подтверждения.
            </p>
          </div>
          <div className="pt-8">
            <Link to="/catalog">
              <Button
                size="lg"
                className="w-full h-14 tracking-[0.2em] glow-cyan"
              >
                Вернуться в магазин
                <ArrowLeft size={18} className="rotate-180" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingCart size={32} className="text-muted-foreground/20" />
        </div>
        <h2 className="text-xl font-black uppercase font-heading text-foreground mb-4">
          Ваша корзина пуста
        </h2>
        <Link to="/catalog">
          <Button variant="outline" className="h-12 px-10">
            В каталог товаров
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Simple Header for Zero Distraction */}
      <div className="border-b border-border bg-card/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container-main h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={
                mounted && theme === "dark"
                  ? "/images/logo-color.svg"
                  : "/images/logo-light.svg"
              }
              alt="ТЕХАКС"
              className="h-7 w-auto"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden sm:inline border-l border-border pl-4">
              Оформление заказа
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <ShieldCheck size={16} className="text-[#05C3D4]" />
            Безопасная оплата
          </div>
        </div>
      </div>

      <div className="container-main py-12">
        <h1 className="text-3xl md:text-4xl font-black uppercase font-heading tracking-tighter mb-12">
          ВАША КОРЗИНА{" "}
          <span className="text-muted-foreground/30">И ОФОРМЛЕНИЕ</span>
        </h1>

        {cartAvailability.isFetching && items.length > 0 && (
          <div className="mb-6 rounded-2xl border border-[#05C3D4]/30 bg-[#05C3D4]/8 px-5 py-4 text-sm font-medium text-foreground">
            Проверяем актуальность товаров и цен перед оформлением заказа...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Cart Items & Order Form */}
          <div className="lg:col-span-8 space-y-12">
            {/* 1. Cart Items Management */}
            <div className="bg-card border border-border rounded-3xl overflow-hidden">
              <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h2 className="text-lg font-black uppercase font-heading tracking-tight flex items-center gap-3">
                  <ShoppingCart size={20} className="text-[#05C3D4]" />
                  Состав заказа ({getItemCount()})
                </h2>
              </div>
              <div className="divide-y divide-border">
                {items.map(item => (
                  <div
                    key={item.cartKey}
                    className="p-8 flex flex-col sm:flex-row gap-6 group transition-colors hover:bg-muted/10"
                  >
                    <div className="w-24 h-24 rounded-2xl bg-white border border-border p-3 flex items-center justify-center shrink-0">
                      <img
                        src={resolveProductImageSrc(item.image)}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain"
                        onError={applyProductImageFallback}
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <Link
                          to={`/product/${item.slug}`}
                          className="text-lg font-bold text-foreground hover:text-[#05C3D4] transition-colors line-clamp-1"
                        >
                          {item.name}
                        </Link>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">
                          Артикул: {item.article || item.id + 1000}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-2 bg-muted rounded-xl p-1.5 border border-border">
                          <button
                            onClick={() =>
                              updateQuantity(item.cartKey, item.quantity - 1)
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background text-muted-foreground transition-all"
                          >
                            <Minus size={16} />
                          </button>
                          <span className="w-10 text-center font-black">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.cartKey, item.quantity + 1)
                            }
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background text-muted-foreground transition-all"
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="block text-lg font-black text-[#05C3D4]">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                            {item.quantity > 1 && (
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                {formatPrice(item.price)} / шт.
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeItem(item.cartKey)}
                            className="p-2.5 rounded-xl bg-destructive/5 text-destructive/40 hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 2. Order Form */}
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="p-8 rounded-3xl border border-border bg-card shadow-sm">
                <h2 className="text-xl font-black uppercase font-heading tracking-tight mb-8 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#05C3D4] text-black flex items-center justify-center text-sm">
                    1
                  </div>
                  Контактные данные
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                      Имя и Фамилия
                    </Label>
                    <Input
                      value={customer.fullName}
                      onChange={e =>
                        setCustomer({ ...customer, fullName: e.target.value })
                      }
                      placeholder="Александр Ульянов"
                      className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                      Телефон
                    </Label>
                    <Input
                      value={customer.phone}
                      onChange={e =>
                        setCustomer({ ...customer, phone: e.target.value })
                      }
                      placeholder="+7 (999) 000-00-00"
                      className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                    />
                  </div>
                </div>
              </div>

              {/* Delivery */}
              <div className="p-8 rounded-3xl border border-border bg-card shadow-sm">
                <h2 className="text-xl font-black uppercase font-heading tracking-tight mb-8 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#05C3D4] text-black flex items-center justify-center text-sm">
                    2
                  </div>
                  Способ получения
                </h2>
                <div className="space-y-8">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setDeliveryType("pickup")}
                      className={`flex items-center gap-4 p-6 rounded-2xl border transition-all text-left ${deliveryType === "pickup" ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                    >
                      <Building2
                        size={24}
                        className={
                          deliveryType === "pickup"
                            ? "text-[#05C3D4]"
                            : "text-muted-foreground"
                        }
                      />
                      <div>
                        <p className="font-black uppercase text-xs tracking-tight">
                          Самовывоз
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1">
                          {pickupStoreId
                            ? typedPickupStores.find(store => store.storeId === pickupStoreId)?.storeAddress ||
                              "Выберите магазин"
                            : "Выберите магазин"}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => setDeliveryType("delivery")}
                      className={`flex items-center gap-4 p-6 rounded-2xl border transition-all text-left ${deliveryType === "delivery" ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                    >
                      <Truck
                        size={24}
                        className={
                          deliveryType === "delivery"
                            ? "text-[#05C3D4]"
                            : "text-muted-foreground"
                        }
                      />
                      <div>
                        <p className="font-black uppercase text-xs tracking-tight">
                          Доставка
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1">
                          {deliveryType === "delivery" && hasResolvedDeliveryQuote
                            ? `Доставка · ${formatPrice(deliveryPrice)}${
                                yandexDeliveryQuote.etaLabel
                                  ? ` · ${yandexDeliveryQuote.etaLabel}`
                                  : ""
                              }`
                            : "Доставка по адресу"}
                        </p>
                      </div>
                    </button>
                  </div>

                  {deliveryType === "pickup" && (
                    <div className="space-y-3 animate-in fade-in zoom-in duration-300">
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                          Магазин для самовывоза
                        </Label>
                        {pickupStoresLoading ? (
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Обновляем остатки...
                          </span>
                        ) : null}
                      </div>

                      {typedPickupStores.length === 0 ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                          Для текущей корзины сейчас нет магазина, где все товары доступны для самовывоза. Выберите доставку или измените состав заказа.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3">
                          {typedPickupStores.map(store => {
                            const isActive = pickupStoreId === store.storeId;
                            return (
                              <button
                                key={store.storeId}
                                type="button"
                                onClick={() => setPickupStoreId(store.storeId)}
                                className={`rounded-2xl border px-5 py-4 text-left transition-all ${
                                  isActive
                                    ? "border-[#05C3D4] bg-[#05C3D4]/5"
                                    : "border-border bg-background hover:border-muted-foreground/30"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1">
                                    <div className="font-bold text-sm text-foreground">
                                      {store.storeName}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      {store.storeAddress}
                                    </div>
                                    {store.storeHours ? (
                                      <div className="text-[11px] font-medium text-muted-foreground">
                                        {store.storeHours}
                                      </div>
                                    ) : null}
                                    {store.storePhone ? (
                                      <div className="text-[11px] font-medium text-muted-foreground">
                                        {store.storePhone}
                                      </div>
                                    ) : null}
                                  </div>
                                  {isActive ? (
                                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#05C3D4]" />
                                  ) : null}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {deliveryType === "delivery" && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                      <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                        Адрес доставки
                      </Label>
                      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_180px] gap-4">
                        <div ref={deliveryStreetFieldRef} className="relative">
                          <Input
                            value={deliveryStreet}
                            onFocus={() => setDeliveryStreetFocused(true)}
                            onKeyDown={event => {
                              if (
                                event.key === "ArrowDown" &&
                                typedDeliveryStreetSuggestions.length > 0
                              ) {
                                event.preventDefault();
                                setDeliveryStreetFocused(true);
                                setDeliveryStreetActiveIndex(currentIndex =>
                                  currentIndex < 0
                                    ? 0
                                    : Math.min(
                                        currentIndex + 1,
                                        typedDeliveryStreetSuggestions.length - 1
                                      )
                                );
                                return;
                              }

                              if (
                                event.key === "ArrowUp" &&
                                typedDeliveryStreetSuggestions.length > 0
                              ) {
                                event.preventDefault();
                                setDeliveryStreetFocused(true);
                                setDeliveryStreetActiveIndex(currentIndex =>
                                  currentIndex <= 0 ? 0 : currentIndex - 1
                                );
                                return;
                              }

                              if (
                                event.key === "Enter" &&
                                deliveryStreetFocused &&
                                typedDeliveryStreetSuggestions.length > 0
                              ) {
                                event.preventDefault();
                                const suggestion =
                                  typedDeliveryStreetSuggestions[
                                    deliveryStreetActiveIndex >= 0
                                      ? deliveryStreetActiveIndex
                                      : 0
                                  ];
                                if (suggestion) {
                                  selectDeliveryStreetSuggestion(
                                    suggestion.street
                                  );
                                }
                                return;
                              }

                              if (event.key === "Escape") {
                                setDeliveryStreetFocused(false);
                                setDeliveryStreetActiveIndex(-1);
                              }
                            }}
                            onBlur={() => {
                              window.setTimeout(() => {
                                setDeliveryStreetFocused(false);
                                setDeliveryStreetActiveIndex(-1);
                              }, 120);
                            }}
                            onChange={e => {
                              setDeliveryStreet(e.target.value);
                              setConfirmedDeliveryStreet(null);
                              setPendingDeliverySuggestion(null);
                              setConfirmedDeliverySuggestion(null);
                              setDeliveryStreetActiveIndex(-1);
                            }}
                            placeholder="Улица"
                            autoComplete="address-line1"
                            className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                          />
                          {deliveryStreetFocused && canSearchDeliveryStreetSuggestions ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-border bg-background">
                              {deliveryStreetSuggestionsLoading ? (
                                <div className="px-4 py-3 text-sm text-muted-foreground">
                                  Ищем улицы в Пензе...
                                </div>
                              ) : typedDeliveryStreetSuggestions.length > 0 ? (
                                <div className="max-h-72 overflow-y-auto p-2">
                                  <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Подсказки улиц
                                  </div>
                                  <div className="space-y-1">
                                    {typedDeliveryStreetSuggestions.map(suggestion => (
                                      <button
                                        key={suggestion.street}
                                        type="button"
                                        onMouseDown={event => event.preventDefault()}
                                        onMouseEnter={() => {
                                          const nextIndex =
                                            typedDeliveryStreetSuggestions.findIndex(
                                              item =>
                                                item.street === suggestion.street
                                            );
                                          setDeliveryStreetActiveIndex(nextIndex);
                                        }}
                                        onClick={() =>
                                          selectDeliveryStreetSuggestion(
                                            suggestion.street
                                          )
                                        }
                                        className={`w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#05C3D4]/5 ${
                                          typedDeliveryStreetSuggestions[
                                            deliveryStreetActiveIndex
                                          ]?.street === suggestion.street
                                            ? "bg-[#05C3D4]/8"
                                            : ""
                                        }`}
                                      >
                                        <div className="font-medium text-foreground">
                                          {renderHighlightedStreetLabel(
                                            suggestion.label
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="px-4 py-3 text-sm text-muted-foreground">
                                  Не нашли улицу. Попробуйте другой вариант написания.
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>
                        <Input
                          ref={deliveryHouseInputRef}
                          value={deliveryHouse}
                          onChange={e => {
                            setDeliveryHouse(e.target.value);
                            setPendingDeliverySuggestion(null);
                            setConfirmedDeliverySuggestion(null);
                          }}
                          placeholder="Дом"
                          className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                        />
                      </div>
                      <Input
                        value={deliveryApartment}
                        onChange={e => setDeliveryApartment(e.target.value)}
                        placeholder="Квартира, офис или подъезд (необязательно)"
                        className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                      />
                      {deliveryType === "delivery" &&
                      hasStartedDeliveryAddress &&
                      (!normalizeWhitespace(deliveryStreet) ||
                        !normalizeWhitespace(deliveryHouse)) ? (
                        <div className="text-xs text-muted-foreground">
                          Для точного расчёта укажите и улицу, и номер дома.
                        </div>
                      ) : null}
                      {deliveryType === "delivery" &&
                      hasStartedDeliveryAddress &&
                      normalizeWhitespace(deliveryStreet) &&
                      !isDeliveryStreetValid ? (
                        <div className="text-xs text-amber-700">
                          Укажите улицу в нормальном формате, например: Суворова или улица Клары Цеткин.
                        </div>
                      ) : null}
                      {deliveryType === "delivery" &&
                      hasStartedDeliveryAddress &&
                      normalizeWhitespace(deliveryHouse) &&
                      !isDeliveryHouseValid ? (
                        <div className="text-xs text-amber-700">
                          Укажите корректный номер дома, например: 192, 14А или 7/1.
                        </div>
                      ) : null}
                      {confirmedSuggestionMatchesCurrentInput &&
                      confirmedDeliverySuggestion ? (
                        <div className="text-xs text-muted-foreground">
                          Подтверждённый адрес:{" "}
                          <span className="font-medium text-foreground">
                            {confirmedDeliverySuggestion.label}
                          </span>
                        </div>
                      ) : null}
                      {shouldSearchDeliveryAddressSuggestions &&
                      !confirmedSuggestionMatchesCurrentInput &&
                      deliveryAddressSuggestionsLoading ? (
                        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          Ищем адреса в Пензе...
                        </div>
                      ) : null}
                      {shouldSearchDeliveryAddressSuggestions &&
                      !confirmedSuggestionMatchesCurrentInput &&
                      !deliveryAddressSuggestionsLoading &&
                      pendingSuggestionMatchesCurrentInput &&
                      pendingDeliverySuggestion ? (
                        <div className="rounded-2xl border border-[#05C3D4]/25 bg-[#05C3D4]/5 px-4 py-4 text-sm">
                          <div className="font-semibold text-foreground">
                            Нашли адрес: {pendingDeliverySuggestion.label}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Подтвердите адрес, и мы рассчитаем стоимость доставки.
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full"
                              onClick={() =>
                                setConfirmedDeliverySuggestion(
                                  pendingDeliverySuggestion,
                                )
                              }
                            >
                              Подтвердить адрес
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="rounded-full"
                              onClick={() => setPendingDeliverySuggestion(null)}
                            >
                              Выбрать другой
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {shouldSearchDeliveryAddressSuggestions &&
                      !confirmedSuggestionMatchesCurrentInput &&
                      !deliveryAddressSuggestionsLoading &&
                      !pendingSuggestionMatchesCurrentInput &&
                      deliveryAddressSuggestions.length > 0 ? (
                        <div className="rounded-2xl border border-border bg-background p-2">
                          <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Подсказки адреса
                          </div>
                          <div className="space-y-1">
                            {deliveryAddressSuggestions.map(suggestion => (
                              <button
                                key={`${suggestion.street}-${suggestion.house}`}
                                type="button"
                                onClick={() => {
                                  setDeliveryStreet(suggestion.street);
                                  setDeliveryHouse(suggestion.house);
                                  setPendingDeliverySuggestion(suggestion);
                                  setConfirmedDeliverySuggestion(null);
                                }}
                                className="w-full rounded-xl px-3 py-3 text-left transition-colors hover:bg-[#05C3D4]/5"
                              >
                                <div className="font-medium text-foreground">
                                  {suggestion.label}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  Нажмите, чтобы выбрать и подтвердить этот адрес.
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {shouldSearchDeliveryAddressSuggestions &&
                      !confirmedSuggestionMatchesCurrentInput &&
                      !deliveryAddressSuggestionsLoading &&
                      !pendingSuggestionMatchesCurrentInput &&
                      deliveryAddressSuggestions.length === 0 &&
                      isDeliveryAddressInputValid &&
                      !confirmedStreetMatchesCurrentInput ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          Сначала выберите улицу из подсказок, чтобы мы смогли точно рассчитать доставку.
                        </div>
                      ) : null}
                      {canConfirmTypedDeliveryAddress ? (
                        <div className="rounded-2xl border border-[#05C3D4]/25 bg-[#05C3D4]/5 px-4 py-4 text-sm">
                          <div className="font-semibold text-foreground">
                            Улица подтверждена: {confirmedDeliveryStreet}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            Дом не найден в справочнике адресов, но мы можем рассчитать доставку по адресу{" "}
                            <span className="font-medium text-foreground">
                              {`${deliveryAddressSearchStreet}, ${deliveryAddressSearchHouse}`}
                            </span>
                            , если вы подтвердите его вручную.
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full"
                              onClick={() =>
                                setConfirmedDeliverySuggestion({
                                  label: `Пенза, ${deliveryAddressSearchStreet}, ${deliveryAddressSearchHouse}`,
                                  street: deliveryAddressSearchStreet,
                                  house: deliveryAddressSearchHouse,
                                  coordinates: null,
                                })
                              }
                            >
                              Подтвердить адрес
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      {deliveryType === "delivery" &&
                      isDeliveryAddressInputValid &&
                      !confirmedSuggestionMatchesCurrentInput ? (
                        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          Стоимость доставки появится только после подтверждения адреса.
                        </div>
                      ) : null}
                      {deliveryType === "delivery" &&
                      confirmedSuggestionMatchesCurrentInput &&
                      normalizedDeliveryAddress.length >= 6 &&
                      !isDeliveryQuoteCurrent ? (
                        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          Обновляем расчёт доставки для нового адреса...
                        </div>
                      ) : null}
                      {confirmedSuggestionMatchesCurrentInput &&
                      yandexDeliveryQuoteLoading ? (
                        <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                          Рассчитываем доставку...
                        </div>
                      ) : null}
                      {!yandexDeliveryQuoteLoading &&
                      deliveryType === "delivery" &&
                      isDeliveryQuoteCurrent &&
                      shouldFetchYandexQuote &&
                      hasResolvedDeliveryQuote ? (
                        <div className="rounded-2xl border border-[#05C3D4]/20 bg-[#05C3D4]/5 px-4 py-3 text-sm">
                          <div className="font-semibold text-foreground">
                            Доставка: {formatPrice(deliveryPrice)}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {yandexDeliveryQuote.etaLabel
                              ? `Ориентировочно ${yandexDeliveryQuote.etaLabel}.`
                              : "Тариф найден и готов к оформлению заказа."}
                          </div>
                        </div>
                      ) : null}
                      {!yandexDeliveryQuoteLoading &&
                      deliveryType === "delivery" &&
                      isDeliveryQuoteCurrent &&
                      shouldFetchYandexQuote &&
                      !hasResolvedDeliveryQuote ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {yandexDeliveryQuote?.message ||
                            "Сейчас не удалось найти подходящий тариф доставки по этому адресу. Проверьте написание улицы и номер дома."}
                        </div>
                      ) : null}
                      {!yandexDeliveryQuoteLoading &&
                      deliveryType === "delivery" &&
                      isDeliveryQuoteCurrent &&
                      confirmedSuggestionMatchesCurrentInput &&
                      yandexDeliveryQuoteError ? (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                          {yandexDeliveryQuoteError.message}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>

              {/* Payment */}
              <div className="p-8 rounded-3xl border border-border bg-card shadow-sm">
                <h2 className="text-xl font-black uppercase font-heading tracking-tight mb-8 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-[#05C3D4] text-black flex items-center justify-center text-sm">
                    3
                  </div>
                  Способ оплаты
                </h2>
                <div className="grid grid-cols-1 gap-3">
                  {(
                    deliveryType === "delivery"
                      ? [
                          ...(yookassaStatus?.enabled
                            ? [
                                {
                                  id: "yookassa",
                                  label: yookassaStatus.testMode
                                    ? "Онлайн-оплата (тест)"
                                    : "Онлайн-оплата",
                                  icon: CreditCard,
                                },
                              ]
                            : []),
                        ]
                      : [
                          {
                            id: "cash",
                            label: "Наличными при получении",
                            icon: ShoppingCart,
                          },
                          {
                            id: "card",
                            label: "Картой в магазине / курьеру",
                            icon: CreditCard,
                          },
                          ...(yookassaStatus?.enabled
                            ? [
                                {
                                  id: "yookassa",
                                  label: yookassaStatus.testMode
                                    ? "Онлайн-оплата (тест)"
                                    : "Онлайн-оплата",
                                  icon: CreditCard,
                                },
                              ]
                            : []),
                        ]
                  ).map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPaymentType(p.id as any)}
                      className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left ${paymentType === p.id ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                    >
                      <p.icon
                        size={20}
                        className={
                          paymentType === p.id
                            ? "text-[#05C3D4]"
                            : "text-muted-foreground"
                        }
                      />
                      <span className="font-bold text-sm">{p.label}</span>
                      {paymentType === p.id && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-[#05C3D4]" />
                      )}
                    </button>
                  ))}
                </div>
                {deliveryType === "delivery" ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    Для доставки доступна только онлайн-оплата.
                  </p>
                ) : null}
              </div>

              {isAuthenticated && loyaltyState?.enabled ? (
                <div className="p-8 rounded-3xl border border-border bg-card shadow-sm">
                  <h2 className="text-xl font-black uppercase font-heading tracking-tight mb-8 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg bg-[#05C3D4] text-black flex items-center justify-center text-sm">
                      4
                    </div>
                    Бонусы
                  </h2>

                  <div className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-background px-5 py-4">
                        <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                          Баланс
                        </div>
                        <div className="mt-2 text-2xl font-black text-foreground">
                          {formatPrice(loyaltyState.balance)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-background px-5 py-4">
                        <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                          Можно списать
                        </div>
                        <div className="mt-2 text-2xl font-black text-[#05C3D4]">
                          {formatPrice(loyaltyPreview?.maxWriteoffAmount ?? 0)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-background px-5 py-4">
                        <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                          Лимит программы
                        </div>
                        <div className="mt-2 text-2xl font-black text-foreground">
                          {loyaltyPreview?.maxWriteoffPercent ?? loyaltyState.maxWriteoffPercent}%
                        </div>
                      </div>
                    </div>

                    <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-background px-5 py-4">
                      <div>
                        <div className="text-sm font-bold text-foreground">
                          Использовать бонусы
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Участвуют только покупатели из группы «{loyaltyState.groupName}».
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={useBonuses}
                        onChange={e => setUseBonuses(e.target.checked)}
                        className="h-5 w-5 rounded border-border"
                      />
                    </label>

                    {useBonuses ? (
                      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                        <div className="space-y-2">
                          <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">
                            Сколько бонусов списать
                          </Label>
                          <Input
                            type="number"
                            min={0}
                            max={loyaltyPreview?.maxWriteoffAmount ?? loyaltyState.availableToSpend}
                            value={bonusAmountInput}
                            onChange={e => setBonusAmountInput(e.target.value)}
                            placeholder={`До ${loyaltyPreview?.maxWriteoffAmount ?? 0}`}
                            className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                          />
                        </div>
                        <div className="rounded-2xl border border-border bg-background px-5 py-4">
                          <div className="text-[10px] uppercase tracking-widest font-black text-muted-foreground">
                            Спишется сейчас
                          </div>
                          <div className="mt-2 text-2xl font-black text-[#05C3D4]">
                            {formatPrice(effectiveBonusSpent)}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {loyaltyPreview?.warning ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {loyaltyPreview.warning}
                      </div>
                    ) : null}
                    {loyaltyState.lastError ? (
                      <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {loyaltyState.lastError}
                      </div>
                    ) : null}
                    {(loyaltyPreviewLoading || loyaltyStateRefreshing) && (
                      <div className="text-xs font-medium text-muted-foreground">
                        Обновляем бонусный профиль...
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Right Column: Order Summary (Amazon Style) */}
          <aside className="lg:col-span-4 sticky top-28 space-y-6">
            <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-black uppercase font-heading tracking-tight mb-6">
                Итого
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">
                    Товары ({getItemCount()})
                  </span>
                  <span className="font-bold">
                    {formatPrice(subtotal)}
                  </span>
                </div>
                {effectiveBonusSpent > 0 ? (
                  <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">Списание бонусов</span>
                    <span className="font-bold text-[#05C3D4]">
                      − {formatPrice(effectiveBonusSpent)}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-[#22c55e] font-bold">
                    {deliveryType === "pickup"
                      ? "Бесплатно"
                      : !hasConfirmedDeliveryAddress
                        ? "Уточняется"
                        : yandexDeliveryQuoteLoading || !isDeliveryQuoteCurrent
                        ? "Расчёт..."
                        : hasResolvedDeliveryQuote
                          ? formatPrice(deliveryPrice)
                          : "Уточняется"}
                  </span>
                </div>
                <Separator className="my-6 bg-border/50" />
                <div className="flex justify-between items-end mb-8">
                  <span className="font-black uppercase tracking-widest text-xs">
                    К оплате
                  </span>
                  <span className="text-3xl font-black text-[#05C3D4] font-heading leading-none">
                    {formatPrice(totalWithBonuses)}
                  </span>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={
                    placeOrder.isPending ||
                    (deliveryType === "pickup" && typedPickupStores.length === 0) ||
                    !canSubmitDeliveryOrder
                  }
                  className="w-full h-16 text-lg tracking-[0.2em] glow-cyan"
                >
                  {placeOrder.isPending
                    ? paymentType === "yookassa"
                      ? "СОЗДАЁМ ОПЛАТУ..."
                      : "ОФОРМЛЕНИЕ..."
                    : paymentType === "yookassa"
                      ? "ПЕРЕЙТИ К ОПЛАТЕ"
                      : "ПОДТВЕРДИТЬ ЗАКАЗ"}
                </Button>

                <PersonalDataConsent
                  checked={personalDataConsent}
                  onCheckedChange={setPersonalDataConsent}
                  withOffer
                  className="mt-4"
                />

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-muted-foreground">
                  <Link to="/payment-delivery" className="transition-colors hover:text-[#05C3D4]">
                    Оплата и доставка
                  </Link>
                  <Link to="/returns" className="transition-colors hover:text-[#05C3D4]">
                    Возврат и обмен
                  </Link>
                  <Link to="/contacts" className="transition-colors hover:text-[#05C3D4]">
                    Контакты магазина
                  </Link>
                </div>
              </div>
            </div>

            {/* CRO Trust Block */}
            <div className="space-y-4">
              <div className="bg-[#05C3D4]/5 border border-[#05C3D4]/10 rounded-2xl p-6 flex gap-4 items-start">
                <ShieldCheck className="text-[#05C3D4] shrink-0" size={20} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed tracking-wider">
                  Ваши данные зашифрованы и защищены. Мы не передаем информацию
                  третьим лицам.
                </p>
              </div>
              <div className="bg-muted/30 border border-border rounded-2xl p-6 flex gap-4 items-start">
                <CheckCircle2 className="text-[#05C3D4] shrink-0" size={20} />
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed tracking-wider">
                  Гарантия 1 год на всю электронику. Возврат и обмен без
                  проблем.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
