import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react";
import { Link, useLocation } from "react-router";
import { useCart } from "@/hooks/use-cart";
import { useCatalog } from "@/providers/CatalogProvider";

export default function StickyBottomBar() {
  const location = useLocation();
  const { getItemCount } = useCart();
  const { toggle, isOpen } = useCatalog();
  const itemCount = getItemCount();

  const navItems = [
    { label: "Главная", icon: Home, href: "/" },
    { label: "Каталог", icon: LayoutGrid, onClick: toggle, isActive: isOpen },
    { label: "Поиск", icon: Search, href: "#search", isAction: true },
    {
      label: "Корзина",
      icon: ShoppingBag,
      href: "/checkout",
      count: itemCount,
    },
    { label: "Профиль", icon: User, href: "/account" },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-[60] bg-background/80 backdrop-blur-2xl border-t border-border px-2 pb-safe-offset-2 pt-2 flex justify-around shadow-[0_-10px_40px_rgba(0,0,0,0.1)] transition-transform duration-300">
      {navItems.map(item => {
        const Icon = item.icon;
        const isActive =
          item.isActive !== undefined
            ? item.isActive
            : location.pathname === item.href;

        const content = (
          <div
            className={`p-1 rounded-xl transition-all ${isActive ? "bg-[#05C3D4]/10 scale-110" : ""}`}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
          </div>
        );

        const label = (
          <span
            className={`text-[9px] font-black uppercase tracking-wider ${isActive ? "opacity-100" : "opacity-60"}`}
          >
            {item.label}
          </span>
        );

        const className = `relative flex flex-col items-center justify-center gap-1 min-w-[64px] py-1 transition-all ${
          isActive ? "text-[#05C3D4]" : "text-muted-foreground"
        }`;

        if (item.onClick) {
          return (
            <button
              key={item.label}
              onClick={item.onClick}
              className={className}
            >
              {content}
              {label}
            </button>
          );
        }

        return (
          <Link key={item.label} to={item.href || "#"} className={className}>
            {content}
            {label}
            {item.count !== undefined && item.count > 0 && (
              <span className="absolute top-0 right-3 w-4 h-4 bg-[#05C3D4] text-white dark:text-black text-[9px] font-black flex items-center justify-center rounded-full border border-background">
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
