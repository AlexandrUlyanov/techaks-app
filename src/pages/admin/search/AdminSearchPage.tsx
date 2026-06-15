import { Outlet } from "react-router";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

export default function AdminSearchPage() {
  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Search"
        title="Поиск по сайту"
        description="Настройки, словарь синонимов и аналитика поиска собраны в одной ветке админки. Переключение между экранами теперь идет через главное меню слева."
      />

      <Outlet />
    </div>
  );
}
