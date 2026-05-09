import { Link, Outlet, useLocation } from "react-router";
import {
  LayoutDashboard,
  Package,
  Store,
  Settings,
  LogOut,
  Home,
  ChevronRight,
  MessageSquare,
  Gift,
  FileText,
  RefreshCw,
  FolderTree,
  SlidersHorizontal,
} from "lucide-react";

const navItems = [
  { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { name: "Заявки", href: "/admin/leads", icon: MessageSquare },
  { name: "Категории", href: "/admin/categories", icon: FolderTree },
  { name: "Товары", href: "/admin/products", icon: Package },
  { name: "Магазины", href: "/admin/stores", icon: Store },
  { name: "Акции", href: "/admin/banners", icon: Gift },
  { name: "Блог", href: "/admin/blog", icon: FileText },
  { name: "Синхронизации", href: "/admin/sync", icon: RefreshCw },
  { name: "Нормализация", href: "/admin/normalize-specs", icon: SlidersHorizontal },
  { name: "Настройки", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-[#15171A] text-white flex flex-col border-r border-white/5">
        <div className="p-8 border-b border-white/5">
          <Link to="/admin" className="flex flex-col leading-none group">
            <span className="text-xl font-black tracking-tighter uppercase font-heading">
              ТЕХ<span className="text-[#05C3D4]">АКС</span>
            </span>
            <span className="text-[7px] font-bold tracking-[0.2em] text-white/20 uppercase mt-1">
              ADMIN PANEL
            </span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 mt-4">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive =
              location.pathname === item.href ||
              (item.href === "/admin/sync" &&
                location.pathname.startsWith("/admin/sync"));
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  isActive
                    ? "bg-[#05C3D4] text-black shadow-[0_0_15px_rgba(5,195,212,0.15)]"
                    : "text-white/40 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-white/40 hover:bg-white/5 hover:text-white transition-all"
          >
            <Home size={16} />
            На сайт
          </Link>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-500/60 hover:bg-red-500/10 transition-all">
            <LogOut size={16} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-[#F8F9FA]">
        {/* Header */}
        <header className="h-20 bg-white border-b border-gray-100 flex items-center justify-between px-10">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
            <span>Администрирование</span>
            <ChevronRight size={12} className="text-gray-300" />
            <span className="text-black">
              {navItems.find(n => n.href === location.pathname)?.name ||
                "Профиль"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-[#0a0a0a]">
                Администратор
              </div>
              <div className="text-xs text-gray-500">admin@techaks.ru</div>
            </div>
            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center text-gray-500 font-bold">
              A
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-8 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
