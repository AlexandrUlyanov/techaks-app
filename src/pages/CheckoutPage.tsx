import { useState } from "react";
import { Link } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  ArrowLeft, 
  MapPin, 
  CreditCard, 
  CheckCircle2, 
  ChevronRight,
  Truck,
  Building2,
  ShieldCheck,
  ShoppingBag
} from "lucide-react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

type CheckoutStep = "address" | "shipping" | "payment" | "review" | "success";

export default function CheckoutPage() {
  const { items, getTotalPrice, clearCart } = useCart();
  const [step, setStep] = useState<CheckoutStep>("address");
  const [orderId, setOrderId] = useState<number | null>(null);

  // Form States
  const [customer, setCustomer] = useState({
    fullName: "",
    phone: "",
    email: "",
  });
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">("pickup");
  const [address, setAddress] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "card" | "sbp">("cash");

  const placeOrder = trpc.ecommerce.placeOrder.useMutation({
    onSuccess: (data) => {
      setOrderId(data.orderId);
      setStep("success");
      clearCart();
      toast.success("Заказ успешно оформлен!");
    },
    onError: (err) => {
      toast.error(err.message || "Ошибка при оформлении заказа");
    },
  });

  const formatPrice = (price: number) => new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  const handlePlaceOrder = () => {
    placeOrder.mutate({
      customer,
      items: items.map(i => ({
        productId: i.id,
        quantity: i.quantity,
        price: i.price
      })),
      deliveryType,
      address: deliveryType === "delivery" ? address : "Самовывоз из магазина",
      paymentType,
      totalPrice: getTotalPrice(),
    });
  };

  if (step === "success") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="w-24 h-24 bg-[#05C3D4]/10 rounded-full flex items-center justify-center mx-auto border border-[#05C3D4]/20">
            <CheckCircle2 size={48} className="text-[#05C3D4]" />
          </div>
          <div className="space-y-4">
            <h1 className="text-3xl font-black uppercase font-heading tracking-tighter text-foreground">Заказ принят!</h1>
            <p className="text-muted-foreground font-medium">
              Номер вашего заказа: <span className="text-foreground font-black">#{orderId}</span>. <br />
              Мы свяжемся с вами в течение 5 минут для подтверждения.
            </p>
          </div>
          <div className="pt-8">
            <Link to="/catalog">
              <Button size="lg" className="w-full h-14 tracking-[0.2em] glow-cyan">
                Вернуться в магазин
                <ArrowLeft size={18} className="rotate-180" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0 && step !== "success") {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4 bg-background">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
          <ShoppingBag size={32} className="text-muted-foreground/20" />
        </div>
        <h2 className="text-xl font-black uppercase font-heading text-foreground mb-4">Ваша корзина пуста</h2>
        <Link to="/catalog">
          <Button variant="outline" className="h-12 px-10">В каталог товаров</Button>
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
            <img src="/images/logo-color.svg" alt="ТЕХАКС" className="h-7 w-auto" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden sm:inline border-l border-border pl-4">Оформление заказа</span>
          </Link>
          <div className="flex items-center gap-4 text-xs font-black uppercase tracking-widest text-muted-foreground">
            <ShieldCheck size={16} className="text-[#05C3D4]" />
            Безопасная оплата
          </div>
        </div>
      </div>

      <div className="container-main py-12">
        <div className="flex flex-col lg:flex-row gap-12 items-start">
          {/* Main Checkout Content */}
          <div className="flex-1 space-y-6 w-full">
            
            {/* Step 1: Address & Info */}
            <div className={`p-8 rounded-3xl border transition-all duration-300 ${step === "address" ? "bg-card border-[#05C3D4]/20 shadow-xl" : "bg-card/30 border-border"}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${step === "address" ? "bg-[#05C3D4] text-black" : "bg-muted text-muted-foreground"}`}>1</div>
                  <h2 className="text-xl font-black uppercase font-heading tracking-tight">Контакты и доставка</h2>
                </div>
                {step !== "address" && (
                  <button onClick={() => setStep("address")} className="text-xs font-black uppercase text-[#05C3D4] tracking-widest hover:underline">Изменить</button>
                )}
              </div>

              {step === "address" && (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Имя и Фамилия</Label>
                      <Input 
                        value={customer.fullName}
                        onChange={(e) => setCustomer({...customer, fullName: e.target.value})}
                        placeholder="Александр Ульянов" 
                        className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Телефон</Label>
                      <Input 
                        value={customer.phone}
                        onChange={(e) => setCustomer({...customer, phone: e.target.value})}
                        placeholder="+7 (999) 000-00-00" 
                        className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Способ получения</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button 
                        onClick={() => setDeliveryType("pickup")}
                        className={`flex items-center gap-4 p-6 rounded-2xl border transition-all text-left ${deliveryType === "pickup" ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                      >
                        <Building2 size={24} className={deliveryType === "pickup" ? "text-[#05C3D4]" : "text-muted-foreground"} />
                        <div>
                          <p className="font-black uppercase text-xs tracking-tight">Самовывоз</p>
                          <p className="text-[10px] font-bold text-muted-foreground mt-1">Пенза, пр. Строителей 50А</p>
                        </div>
                      </button>
                      <button 
                        onClick={() => setDeliveryType("delivery")}
                        className={`flex items-center gap-4 p-6 rounded-2xl border transition-all text-left ${deliveryType === "delivery" ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                      >
                        <Truck size={24} className={deliveryType === "delivery" ? "text-[#05C3D4]" : "text-muted-foreground"} />
                        <div>
                          <p className="font-black uppercase text-xs tracking-tight">Доставка</p>
                          <p className="text-[10px] font-bold text-muted-foreground mt-1">Курьером по городу (от 300 ₽)</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {deliveryType === "delivery" && (
                    <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                      <Label className="text-[10px] uppercase tracking-widest font-black text-muted-foreground ml-1">Адрес доставки</Label>
                      <Input 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Улица, дом, квартира" 
                        className="h-14 rounded-xl border-border bg-background focus:ring-2 focus:ring-[#05C3D4]/20"
                      />
                    </div>
                  )}

                  <Button 
                    onClick={() => setStep("payment")} 
                    disabled={!customer.fullName || !customer.phone || (deliveryType === "delivery" && !address)}
                    className="w-full md:w-auto px-12 h-14 tracking-widest"
                  >
                    ПРОДОЛЖИТЬ
                    <ChevronRight size={18} />
                  </Button>
                </div>
              )}
            </div>

            {/* Step 2: Payment */}
            <div className={`p-8 rounded-3xl border transition-all duration-300 ${step === "payment" ? "bg-card border-[#05C3D4]/20 shadow-xl" : "bg-card/30 border-border"}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${step === "payment" ? "bg-[#05C3D4] text-black" : "bg-muted text-muted-foreground"}`}>2</div>
                  <h2 className="text-xl font-black uppercase font-heading tracking-tight">Способ оплаты</h2>
                </div>
                {step !== "payment" && step !== "address" && (
                  <button onClick={() => setStep("payment")} className="text-xs font-black uppercase text-[#05C3D4] tracking-widest hover:underline">Изменить</button>
                )}
              </div>

              {step === "payment" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { id: "cash", label: "Наличными при получении", icon: ShoppingBag },
                      { id: "card", label: "Картой в магазине / курьеру", icon: CreditCard },
                      { id: "sbp", label: "СБП (Система быстрых платежей)", icon: ShieldCheck },
                    ].map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPaymentType(p.id as any)}
                        className={`flex items-center gap-4 p-5 rounded-2xl border transition-all text-left ${paymentType === p.id ? "border-[#05C3D4] bg-[#05C3D4]/5" : "border-border bg-background hover:border-muted-foreground/30"}`}
                      >
                        <p.icon size={20} className={paymentType === p.id ? "text-[#05C3D4]" : "text-muted-foreground"} />
                        <span className="font-bold text-sm">{p.label}</span>
                        {paymentType === p.id && <div className="ml-auto w-2 h-2 rounded-full bg-[#05C3D4]" />}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <Button variant="outline" onClick={() => setStep("address")} className="h-14 px-8 border-border">НАЗАД</Button>
                    <Button onClick={() => setStep("review")} className="flex-1 h-14 tracking-widest">ПРОВЕРИТЬ ЗАКАЗ</Button>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Review */}
            <div className={`p-8 rounded-3xl border transition-all duration-300 ${step === "review" ? "bg-card border-[#05C3D4]/20 shadow-xl" : "bg-card/30 border-border"}`}>
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${step === "review" ? "bg-[#05C3D4] text-black" : "bg-muted text-muted-foreground"}`}>3</div>
                <h2 className="text-xl font-black uppercase font-heading tracking-tight">Подтверждение</h2>
              </div>
              
              {step === "review" && (
                <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-muted/30 p-6 rounded-2xl border border-border space-y-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Получатель</span>
                      <span className="font-black">{customer.fullName}, {customer.phone}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Доставка</span>
                      <span className="font-black">{deliveryType === "pickup" ? "Самовывоз" : address}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">Оплата</span>
                      <span className="font-black uppercase">{paymentType}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground font-medium line-clamp-1 flex-1 pr-4">{item.name} × {item.quantity}</span>
                        <span className="font-black whitespace-nowrap">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>

                  <Button 
                    onClick={handlePlaceOrder} 
                    disabled={placeOrder.isPending}
                    className="w-full h-16 text-lg tracking-[0.2em] glow-cyan"
                  >
                    {placeOrder.isPending ? "ОФОРМЛЕНИЕ..." : "ПОДТВЕРДИТЬ И КУПИТЬ"}
                  </Button>
                  <p className="text-[10px] text-center text-muted-foreground uppercase font-bold tracking-widest">
                    Нажимая кнопку, вы подтверждаете согласие с условиями оферты
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Order Summary (Amazon Style) */}
          <aside className="w-full lg:w-[400px] sticky top-28 space-y-6">
            <div className="bg-card border border-border rounded-3xl p-8 shadow-sm">
              <h3 className="text-lg font-black uppercase font-heading tracking-tight mb-6">Сводка заказа</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Товары ({items.length})</span>
                  <span>{formatPrice(getTotalPrice())}</span>
                </div>
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">Доставка</span>
                  <span className="text-[#22c55e]">Бесплатно</span>
                </div>
                <Separator className="my-4 bg-border/50" />
                <div className="flex justify-between items-end">
                  <span className="font-black uppercase tracking-widest text-xs">Итого к оплате</span>
                  <span className="text-3xl font-black text-[#05C3D4] font-heading leading-none">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#05C3D4]/5 border border-[#05C3D4]/10 rounded-2xl p-6 flex gap-4 items-start">
              <ShieldCheck className="text-[#05C3D4] shrink-0" size={20} />
              <p className="text-[10px] font-bold text-muted-foreground uppercase leading-relaxed tracking-wider">
                Ваши данные защищены. Мы используем безопасные протоколы для передачи информации.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
