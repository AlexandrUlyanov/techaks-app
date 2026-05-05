import { Link } from "react-router";
import { Sparkles, Tag, Smartphone, Headphones, Shield, Box } from "lucide-react";

const shortcuts = [
  { label: "Все новинки", icon: Sparkles, href: "/catalog?sort=new", color: "bg-orange-500" },
  { label: "Акции %", icon: Tag, href: "/promotions", color: "bg-[#05C3D4]" },
  { label: "Чехлы iPhone", icon: Shield, href: "/catalog?cat=cases", color: "bg-blue-500" },
  { label: "Наушники", icon: Headphones, href: "/catalog?cat=audio", color: "bg-purple-500" },
  { label: "Защита", icon: Smartphone, href: "/catalog?cat=glass", color: "bg-green-500" },
  { label: "Уценка", icon: Box, href: "/catalog?cat=outlet", color: "bg-red-500" },
];

export default function QuickShortcuts() {
  return (
    <div className="w-full overflow-hidden bg-background py-4 border-b border-border">
      <div className="container-main">
        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 px-1">
          {shortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                to={item.href}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-card border border-border rounded-2xl hover:border-[#05C3D4]/30 transition-all shrink-0 shadow-sm active:scale-95 group"
              >
                <div className={`w-8 h-8 ${item.color} rounded-xl flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform`}>
                  <Icon size={16} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap text-foreground/80 group-hover:text-foreground">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
