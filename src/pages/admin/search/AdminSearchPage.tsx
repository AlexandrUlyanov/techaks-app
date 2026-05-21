import { NavLink, Outlet } from "react-router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

const tabs = [
  { href: "/admin/search/settings", label: "Настройки" },
  { href: "/admin/search/synonyms", label: "Синонимы" },
  { href: "/admin/search/analytics", label: "Аналитика" },
];

export default function AdminSearchPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Search"
        title="Поиск по сайту"
        description="Настройки, словарь синонимов, ручная переиндексация и аналитика запросов Techaks."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map(tab => (
          <NavLink
            key={tab.href}
            to={tab.href}
            className={({ isActive }) =>
              `inline-flex rounded-xl px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--tech-color-primary)] text-[var(--tech-color-primary-foreground)]"
                  : "border border-border bg-card text-foreground hover:bg-muted"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <Outlet />
    </div>
  );
}
