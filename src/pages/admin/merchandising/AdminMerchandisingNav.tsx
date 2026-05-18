import { Bot, CheckCheck, Layers3, Sparkles, TrendingUp } from "lucide-react";
import { Link, useLocation } from "react-router";

const items = [
  { href: "/admin/merchandising", label: "Обзор", icon: TrendingUp },
  { href: "/admin/merchandising/badges", label: "Каталог бейджей", icon: Layers3 },
  { href: "/admin/merchandising/ai", label: "AI-генерация", icon: Bot },
  { href: "/admin/merchandising/assignments", label: "Назначения", icon: Sparkles },
  { href: "/admin/merchandising/quality", label: "Качество", icon: CheckCheck },
];

export default function AdminMerchandisingNav() {
  const location = useLocation();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
      <div className="grid gap-2 md:grid-cols-5">
        {items.map(item => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex min-h-[72px] items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                isActive
                  ? "bg-[#15171A] text-white"
                  : "text-[#15171A] hover:bg-[#F4F6F8]"
              }`}
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                  isActive ? "bg-white/10 text-[#05C3D4]" : "bg-[#F4F6F8] text-[#05C3D4]"
                }`}
              >
                <Icon size={18} />
              </span>
              <span className="leading-5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
