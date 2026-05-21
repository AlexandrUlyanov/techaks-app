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
  MapPinned,
  Star,
  Gift,
  FileText,
  Search,
  RefreshCw,
  FolderTree,
  SlidersHorizontal,
  TrendingUp,
  ShieldCheck,
  Blocks,
  Palette,
} from "lucide-react";
import { useAbility } from "@/providers/AbilityProvider";

type NavItem = {
  name: string;
  href: string;
  icon: typeof LayoutDashboard;
  match?: (pathname: string) => boolean;
};

const navGroupsBase: Array<{ title: string; items: NavItem[] }> = [
  {
    title: "Операции",
    items: [
      { name: "Дашборд", href: "/admin", icon: LayoutDashboard },
      { name: "Заказы", href: "/admin/leads", icon: MessageSquare },
      { name: "Резервы", href: "/admin/reservations", icon: MapPinned },
      { name: "Отзывы", href: "/admin/reviews", icon: Star },
      {
        name: "Синхронизации",
        href: "/admin/sync",
        icon: RefreshCw,
        match: pathname => pathname.startsWith("/admin/sync"),
      },
    ],
  },
  {
    title: "Каталог",
    items: [
      { name: "Категории", href: "/admin/categories", icon: FolderTree },
      { name: "Товары", href: "/admin/products", icon: Package },
      { name: "Магазины", href: "/admin/stores", icon: Store },
      {
        name: "Мерчендайзинг",
        href: "/admin/merchandising",
        icon: TrendingUp,
        match: pathname => pathname.startsWith("/admin/merchandising"),
      },
      {
        name: "Нормализация",
        href: "/admin/normalize-specs",
        icon: SlidersHorizontal,
      },
    ],
  },
];

function getCurrentItem(
  pathname: string,
  groups: Array<{ title: string; items: NavItem[] }>
) {
  for (const group of groups) {
    for (const item of group.items) {
      if (item.match ? item.match(pathname) : pathname === item.href) {
        return { group: group.title, item };
      }
    }
  }

  return null;
}

export default function AdminLayout() {
  const location = useLocation();
  const ability = useAbility();
  const navGroups = [
    ...navGroupsBase,
    {
      title: "Контент и система",
      items: [
        { name: "Акции", href: "/admin/banners", icon: Gift },
        { name: "Блог", href: "/admin/blog", icon: FileText },
        ...(ability.can("read", "Search")
          ? [
              {
                name: "Поиск",
                href: "/admin/search/settings",
                icon: Search,
                match: (pathname: string) => pathname.startsWith("/admin/search"),
              },
            ]
          : []),
        ...(ability.can("read", "DesignSystem")
          ? [{ name: "Дизайн-система", href: "/admin/design-system", icon: Palette }]
          : []),
        { name: "Настройки", href: "/admin/settings", icon: Settings },
      ],
    },
  ];
  const current = getCurrentItem(location.pathname, navGroups);

  return (
    <div className="min-h-screen bg-[var(--tech-color-background)]">
      <div className="grid min-h-screen lg:grid-cols-[272px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-black/5 bg-[var(--tech-color-brand-dark)] text-white">
          <div className="border-b border-white/10 px-7 py-7">
            <Link to="/admin" className="flex flex-col gap-1">
              <span className="text-2xl font-black uppercase tracking-tight">
                ТЕХ<span className="text-[var(--tech-color-primary)]">АКС</span>
              </span>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">
                Панель управления
              </span>
            </Link>
          </div>

          <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-6">
            {navGroups.map(group => (
              <div key={group.title} className="space-y-2">
                <div className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/25">
                  {group.title}
                </div>
                <div className="space-y-1">
                  {group.items.map(item => {
                    const Icon = item.icon;
                    const isActive = item.match
                      ? item.match(location.pathname)
                      : location.pathname === item.href;

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${
                          isActive
                            ? "bg-white text-[var(--tech-color-text-main)] shadow-sm"
                            : "text-white/55 hover:bg-white/6 hover:text-white"
                        }`}
                      >
                        <Icon
                          size={17}
                          className={isActive ? "text-[var(--tech-color-primary)]" : "text-white/35"}
                        />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-white/10 px-4 py-4">
            <div className="space-y-1">
              <Link
                to="/"
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-white/55 transition-colors hover:bg-white/6 hover:text-white"
              >
                <Home size={17} className="text-white/35" />
                <span>На сайт</span>
              </Link>
              <button className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-rose-300/80 transition-colors hover:bg-rose-500/10 hover:text-rose-200">
                <LogOut size={17} className="text-rose-300/60" />
                <span>Выйти</span>
              </button>
            </div>
          </div>
        </aside>

        <main className="flex min-h-screen flex-col">
          <header className="border-b border-black/5 bg-white/90 px-6 py-4 backdrop-blur lg:px-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
                  <span>Администрирование</span>
                  <ChevronRight size={12} className="text-gray-300" />
                  <span>{current?.group ?? "Обзор"}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-black text-[var(--tech-color-text-main)]">
                    {current?.item.name ?? "Панель"}
                  </h1>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[color:color-mix(in_srgb,var(--tech-color-primary)_20%,white)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,white)] px-3 py-1 text-xs font-bold text-[var(--tech-color-primary)]">
                    <ShieldCheck size={14} />
                    Рабочий режим
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="hidden items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 md:flex">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[var(--tech-color-primary)] shadow-sm">
                    <Blocks size={18} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-[0.16em] text-gray-400">
                      Контур
                    </div>
                    <div className="text-sm font-semibold text-[var(--tech-color-text-main)]">
                      Операционный backoffice
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div className="text-right">
                    <div className="text-sm font-semibold text-[var(--tech-color-text-main)]">
                      Администратор
                    </div>
                    <div className="text-xs text-gray-500">admin@techaks.ru</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--tech-color-brand-dark)] text-sm font-black text-white">
                    A
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
            <div className="mx-auto max-w-[1600px]">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
