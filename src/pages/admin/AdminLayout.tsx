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
  FileText
} from "lucide-react";

const navItems = [
  { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
  { name: "Заявки", href: "/admin/leads", icon: MessageSquare },
  { name: "Товары", href: "/admin/products", icon: Package },
  { name: "Магазины", href: "/admin/stores", icon: Store },
  { name: "Акции", href: "/admin/banners", icon: Gift },
  { name: "Блог", href: "/admin/blog", icon: FileText },
  { name: "Настройки", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-[#003238] text-white flex flex-col">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00bcd4] rounded flex items-center justify-center font-bold">T</div>
            <span className="text-xl font-bold tracking-tight">TECHAKS <span className="text-[#00bcd4]">ADMIN</span></span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? "bg-[#00bcd4] text-white" 
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white transition-colors"
          >
            <Home size={18} />
            На сайт
          </Link>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-400/10 transition-colors">
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Админ-панель</span>
            <ChevronRight size={14} />
            <span className="text-[#0a0a0a] font-medium">
              {navItems.find(n => n.href === location.pathname)?.name || "Профиль"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-sm font-semibold text-[#0a0a0a]">Администратор</div>
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
