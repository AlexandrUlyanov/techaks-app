import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag,
  Package,
  User as UserIcon,
  LogOut,
  Loader2,
  ChevronRight,
  Clock,
  MapPin,
  Star,
  Settings,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Can } from "@/providers/AbilityProvider";
import { Link, Navigate, useNavigate } from "react-router";
import { useSeo } from "@/lib/seo";

export default function AccountPage() {
  useSeo({
    title: "Личный кабинет — ТЕХАКС",
    description: "Личный кабинет покупателя в интернет-магазине ТЕХАКС.",
    canonicalPath: "/account",
    noindex: true,
  });

  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } =
    trpc.ecommerce.getUserOrders.useQuery(
      { phone: user?.phone || "" },
      { enabled: isAuthenticated }
    );

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("ru-RU").format(price) + " ₽";

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Account Header */}
      <section className="bg-card border-b border-border py-16 md:py-24 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-[#05C3D4]/5 blur-[120px] rounded-full" />
        <div className="container-main relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-[2rem] bg-[#05C3D4] flex items-center justify-center text-black shadow-xl glow-cyan">
                <UserIcon size={40} />
              </div>
              <div>
                <h1 className="text-3xl font-black uppercase font-heading tracking-tighter">
                  {user?.fullName}
                </h1>
                <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] mt-1">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="w-fit h-12 px-8 border-border text-muted-foreground hover:text-destructive hover:border-destructive/20 transition-all"
            >
              <LogOut size={16} className="mr-2" />
              ВЫЙТИ
            </Button>
          </div>
        </div>
      </section>

      <div className="container-main py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          {/* Left: Orders List */}
          <div className="lg:col-span-2 space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <Package size={20} className="text-[#05C3D4]" />
              <h2 className="text-xl font-black uppercase font-heading tracking-tight">
                История заказов
              </h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-[#05C3D4]" size={32} />
              </div>
            ) : orders.length === 0 ? (
              <div className="p-12 bg-card rounded-3xl border border-border text-center space-y-6">
                <ShoppingBag
                  size={48}
                  className="mx-auto text-muted-foreground/20"
                />
                <p className="text-muted-foreground font-medium uppercase tracking-widest text-xs">
                  У вас пока нет заказов
                </p>
                <Button variant="outline" className="h-12 px-10 border-border">
                  В МАГАЗИН
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(order => (
                  <div
                    key={order.id}
                    className="p-8 bg-card border border-border rounded-3xl group hover:border-[#05C3D4]/20 transition-all cursor-pointer shadow-sm hover:shadow-xl"
                  >
                    <div className="flex flex-wrap justify-between gap-6 mb-6">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Заказ
                        </span>
                        <p className="text-lg font-black font-heading tracking-tight">
                          #{order.id}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Статус
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
                          <p className="text-sm font-black uppercase tracking-tight text-[#22c55e]">
                            {order.status}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Дата
                        </span>
                        <p className="text-sm font-bold">
                          {new Date(order.createdAt).toLocaleDateString(
                            "ru-RU"
                          )}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Сумма
                        </span>
                        <p className="text-lg font-black text-[#05C3D4] font-heading">
                          {formatPrice(order.totalPrice)}
                        </p>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <MapPin size={12} />
                          {order.deliveryType === "pickup"
                            ? "Самовывоз"
                            : "Доставка"}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                          <Clock size={12} />
                          {order.paymentType}
                        </div>
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#05C3D4] opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                        ДЕТАЛИ{" "}
                        <ChevronRight size={14} className="inline ml-1" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Links / Loyalty */}
          <div className="space-y-6">
            <Can I="read" a="AdminPanel">
              <Link to="/admin" className="block">
                <div className="p-8 bg-black text-white rounded-3xl relative overflow-hidden group border border-border shadow-xl">
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black uppercase font-heading tracking-tight leading-none text-[#05C3D4]">
                        Админ Панель
                      </h3>
                      <p className="mt-2 text-sm font-medium text-white/60">
                        Управление магазином
                      </p>
                    </div>
                    <Settings className="text-[#05C3D4] group-hover:rotate-90 transition-transform duration-500" size={32} />
                  </div>
                </div>
              </Link>
            </Can>

            <div className="p-8 bg-[#05C3D4] rounded-3xl text-black relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-black uppercase font-heading tracking-tight leading-none">
                  ТЕХАКС <br /> ПРИВИЛЕГИИ
                </h3>
                <p className="mt-4 text-sm font-bold text-black/60 leading-relaxed">
                  Ваша персональная скидка 5% на все аксессуары активна.
                </p>
                <div className="mt-8 text-[10px] font-black uppercase tracking-widest py-2 px-4 bg-black/10 rounded-lg w-fit">
                  СТАТУС: ПОСТОЯННЫЙ КЛИЕНТ
                </div>
              </div>
              <Star
                size={120}
                className="absolute -bottom-10 -right-10 text-black/10 transform rotate-12 group-hover:scale-110 transition-transform duration-700"
              />
            </div>

            <div className="p-8 bg-muted rounded-3xl border border-border">
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-6">
                Поддержка
              </h3>
              <div className="space-y-4">
                <a
                  href="tel:+79273750555"
                  className="flex items-center justify-between text-sm font-bold hover:text-[#05C3D4] transition-colors"
                >
                  <span>Позвонить нам</span>
                  <ChevronRight size={16} />
                </a>
                <Separator className="bg-border/50" />
                <a
                  href="https://t.me/tech_aks"
                  target="_blank"
                  className="flex items-center justify-between text-sm font-bold hover:text-[#05C3D4] transition-colors"
                >
                  <span>Написать в Telegram</span>
                  <ChevronRight size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
