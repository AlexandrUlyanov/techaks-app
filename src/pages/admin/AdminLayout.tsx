import { useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import {
  Blocks,
  ChevronDown,
  ChevronRight,
  Home,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useAbility } from "@/providers/AbilityProvider";
import {
  buildAdminNavigation,
  collectExpandedAdminNavIds,
  findAdminNavPath,
  matchAdminNavItem,
  type AdminNavGroup,
  type AdminNavItem,
} from "./adminNavigation";

const ADMIN_NAV_STATE_KEY = "techaks-admin-nav-expanded";

export default function AdminLayout() {
  const location = useLocation();
  const ability = useAbility();
  const navGroups = useMemo(
    () =>
      buildAdminNavigation({
        canConfigureSettings: ability.can("configure", "Settings"),
        canReadDesignSystem: ability.can("read", "DesignSystem"),
        canReadFeeds: ability.can("read", "Settings"),
        canReadSearch: ability.can("read", "Search"),
        canReadSeo: ability.can("read", "Settings"),
      }),
    [ability]
  );
  const current = useMemo(
    () => findAdminNavPath(navGroups, location.pathname),
    [location.pathname, navGroups]
  );
  const autoExpandedIds = useMemo(
    () => collectExpandedAdminNavIds(navGroups, location.pathname),
    [location.pathname, navGroups]
  );
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(ADMIN_NAV_STATE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setExpandedIds(prev => ({ ...parsed, ...prev }));
    } catch {
      // ignore malformed persisted nav state
    }
  }, []);

  useEffect(() => {
    setExpandedIds(prev => {
      const next = { ...prev };
      for (const id of autoExpandedIds) {
        next[id] = true;
      }
      return next;
    });
  }, [autoExpandedIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ADMIN_NAV_STATE_KEY, JSON.stringify(expandedIds));
  }, [expandedIds]);

  return (
    <div className="min-h-screen bg-[var(--tech-color-background)]">
      <div className="grid min-h-screen lg:grid-cols-[304px_minmax(0,1fr)]">
        <aside className="flex flex-col border-r border-white/8 bg-[var(--tech-color-brand-dark)] text-white">
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
              <AdminNavGroupSection
                key={group.title}
                expandedIds={expandedIds}
                group={group}
                locationPathname={location.pathname}
                onToggle={id =>
                  setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }))
                }
              />
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
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">
                  <span>Администрирование</span>
                  <ChevronRight size={12} className="text-gray-300" />
                  <span>{current?.group ?? "Обзор"}</span>
                  {current?.items.map(item => (
                    <div key={item.id} className="flex items-center gap-2">
                      <ChevronRight size={12} className="text-gray-300" />
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-xl font-black text-[var(--tech-color-text-main)]">
                    {current?.items.at(-1)?.name ?? "Панель"}
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

function AdminNavGroupSection({
  expandedIds,
  group,
  locationPathname,
  onToggle,
}: {
  expandedIds: Record<string, boolean>;
  group: AdminNavGroup;
  locationPathname: string;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="px-3 text-[10px] font-black uppercase tracking-[0.22em] text-white/25">
        {group.title}
      </div>
      <div className="space-y-1.5">
        {group.items.map(item => (
          <AdminNavItemNode
            key={item.id}
            expandedIds={expandedIds}
            item={item}
            level={0}
            locationPathname={locationPathname}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

function AdminNavItemNode({
  expandedIds,
  item,
  level,
  locationPathname,
  onToggle,
}: {
  expandedIds: Record<string, boolean>;
  item: AdminNavItem;
  level: number;
  locationPathname: string;
  onToggle: (id: string) => void;
}) {
  const hasChildren = Boolean(item.children?.length);
  const isActive = matchAdminNavItem(item, locationPathname);
  const isExpanded = expandedIds[item.id] ?? false;
  const Icon = item.icon;
  const indentClass =
    level === 0 ? "" : level === 1 ? "ml-6 pl-4" : "ml-11 pl-4";

  return (
    <div className={indentClass}>
      <div
        className={`flex items-center gap-2 rounded-xl transition-colors ${
          level > 0 ? "border-l border-white/10" : ""
        }`}
      >
        <Link
          to={item.href}
          className={getNavLinkClass({ hasChildren, isActive, level })}
        >
          {Icon ? (
            <span
              className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                isActive
                  ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,white)] text-[var(--tech-color-primary)]"
                  : "bg-white/6 text-white/35"
              }`}
            >
              <Icon size={level === 0 ? 17 : 15} />
            </span>
          ) : null}
          <span className="min-w-0 flex-1 leading-5">{item.name}</span>
        </Link>

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(item.id)}
            aria-expanded={isExpanded}
            className={`mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
              isActive
                ? "text-[var(--tech-color-primary)] hover:bg-white/8"
                : "text-white/35 hover:bg-white/6 hover:text-white/70"
            }`}
          >
            <ChevronDown
              size={16}
              className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
            />
          </button>
        ) : null}
      </div>

      {hasChildren && isExpanded ? (
        <div className="mt-1.5 space-y-1">
          {item.children?.map(child => (
            <AdminNavItemNode
              key={child.id}
              expandedIds={expandedIds}
              item={child}
              level={level + 1}
              locationPathname={locationPathname}
              onToggle={onToggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getNavLinkClass({
  hasChildren,
  isActive,
  level,
}: {
  hasChildren: boolean;
  isActive: boolean;
  level: number;
}) {
  const baseClass =
    "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors";

  if (level === 0) {
    return `${baseClass} ${
      isActive
        ? "bg-white text-[var(--tech-color-text-main)]"
        : "text-white/60 hover:bg-white/6 hover:text-white"
    } ${hasChildren ? "pr-1" : ""}`;
  }

  if (level === 1) {
    return `${baseClass} py-2.5 text-[13px] ${
      isActive
        ? "bg-white/8 text-white"
        : "text-white/48 hover:bg-white/5 hover:text-white/88"
    } ${hasChildren ? "pr-1" : ""}`;
  }

  return `${baseClass} py-2 text-[12px] ${
    isActive
      ? "bg-[color:color-mix(in_srgb,var(--tech-color-primary)_18%,transparent)] text-[var(--tech-color-primary)]"
      : "text-white/40 hover:bg-white/5 hover:text-white/78"
  } ${hasChildren ? "pr-1" : ""}`;
}
