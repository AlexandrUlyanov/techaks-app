import { useEffect, useRef, useState } from "react";
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
  const { data: siteProfile } = trpc.settings.getPublicSiteProfile.useQuery();
  const { data: yookassaStatus } = trpc.settings.getPublicYooKassaStatus.useQuery();

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
  const [address, setAddress] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "card" | "yookassa">(
    "cash"
  );
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const checkoutTrackedSignatureRef = useRef<string | null>(null);
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
    const normalizedAddress = address.trim();

    if (!fullName || !phone) {
      toast.error("Пожалуйста, заполните контактные данные");
      return;
    }
    if (deliveryType === "delivery" && !normalizedAddress) {
      toast.error("Пожалуйста, укажите адрес доставки");
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
      totalPrice: getTotalPrice(),
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
                          Курьером по городу (от 300 ₽)
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
                      <Input
                        value={address}
                        onChange={e => setAddress(e.target.value)}
                        placeholder="Улица, дом, квартира"
                        className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                      />
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
                  {[
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
                  ].map(p => (
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
              </div>
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
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-[#22c55e] font-bold">
                    {deliveryType === "pickup" ? "Бесплатно" : "От 300 ₽"}
                  </span>
                </div>
                <Separator className="my-6 bg-border/50" />
                <div className="flex justify-between items-end mb-8">
                  <span className="font-black uppercase tracking-widest text-xs">
                    К оплате
                  </span>
                  <span className="text-3xl font-black text-[#05C3D4] font-heading leading-none">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>

                <Button
                  onClick={handlePlaceOrder}
                  disabled={
                    placeOrder.isPending ||
                    (deliveryType === "pickup" && typedPickupStores.length === 0)
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
