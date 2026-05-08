import { useCart } from "@/hooks/use-cart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "react-router";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface CartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, getTotalPrice, getItemCount } =
    useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
  };

  const FREE_SHIPPING_THRESHOLD = 2000;
  const totalPrice = getTotalPrice();
  const progress = Math.min((totalPrice / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const remaining = FREE_SHIPPING_THRESHOLD - totalPrice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 bg-background border-l border-border">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center justify-between gap-3 text-xl font-black uppercase font-heading tracking-tight">
            <div className="flex items-center gap-3">
              <ShoppingBag className="text-[#05C3D4]" />
              Корзина ({getItemCount()})
            </div>
            {totalPrice > 0 && totalPrice < FREE_SHIPPING_THRESHOLD && (
              <span className="text-[9px] font-black bg-[#05C3D4]/10 text-[#05C3D4] px-2 py-1 rounded-md animate-pulse">
                ЕЩЕ {formatPrice(remaining)} ДО БЕСПЛАТНОЙ ДОСТАВКИ
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
              <ShoppingBag size={32} className="text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-black uppercase font-heading text-foreground mb-2">
              Корзина пуста
            </h3>
            <p className="text-sm text-muted-foreground mb-8">
              Добавьте товары из каталога, чтобы оформить заказ
            </p>
            <Button
              variant="default"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              В каталог
            </Button>
          </div>
        ) : (
          <>
            {/* CRO: Free Delivery Progress Bar */}
            <div className="px-6 py-4 bg-muted/20 border-b border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {totalPrice >= FREE_SHIPPING_THRESHOLD
                    ? "🎉 Бесплатная доставка ваша!"
                    : "До бесплатной доставки"}
                </span>
                <span className="text-[10px] font-black text-[#05C3D4]">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#05C3D4] transition-all duration-1000 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <ScrollArea className="flex-1 px-6">
              <div className="py-6 space-y-6">
                {items.map(item => (
                  <div key={item.id} className="flex gap-4 group">
                    <div className="w-20 h-20 rounded-xl bg-white border border-border p-2 flex items-center justify-center shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/product/${item.slug}`}
                        onClick={() => onOpenChange(false)}
                        className="text-sm font-bold text-foreground hover:text-[#05C3D4] transition-colors line-clamp-2 leading-snug"
                      >
                        {item.name}
                      </Link>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-8 text-center text-xs font-black">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-black text-[#05C3D4]">
                            {formatPrice(item.price)}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-[10px] font-black uppercase text-muted-foreground/40 hover:text-destructive transition-colors mt-1"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <SheetFooter className="mt-auto p-6 bg-muted/30 border-t border-border sm:flex-col">
              <div className="space-y-4 w-full">
                <div className="flex justify-between items-end">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                    Итого к оплате
                  </span>
                  <span className="text-2xl font-black text-foreground font-heading">
                    {formatPrice(getTotalPrice())}
                  </span>
                </div>
                <Separator className="bg-border/50" />
                <div className="grid grid-cols-1 gap-3">
                  <Link to="/checkout" onClick={() => onOpenChange(false)}>
                    <Button className="w-full h-14 text-xs tracking-[0.2em] glow-cyan">
                      Оформить заказ
                      <ArrowRight size={16} />
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    className="h-12 text-[10px] text-muted-foreground/60"
                  >
                    Продолжить покупки
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
