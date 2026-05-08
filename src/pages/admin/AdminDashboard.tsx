import { trpc } from "@/providers/trpc";
import {
  Package,
  Store,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

export default function AdminDashboard() {
  const { data: products = [] } = trpc.product.getAll.useQuery();
  const { data: stores = [] } = trpc.store.getAll.useQuery();

  const stats = [
    {
      name: "Всего товаров",
      value: products.length,
      icon: Package,
      color: "bg-blue-500",
      trend: "+12%",
      trendUp: true,
    },
    {
      name: "Магазинов",
      value: stores.length,
      icon: Store,
      color: "bg-purple-500",
      trend: "0%",
      trendUp: true,
    },
    {
      name: "Заявок (мес)",
      value: "24",
      icon: TrendingUp,
      color: "bg-green-500",
      trend: "+5%",
      trendUp: true,
    },
    {
      name: "Посетителей",
      value: "1.2k",
      icon: Users,
      color: "bg-orange-500",
      trend: "-2%",
      trendUp: false,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white p-6 rounded-xl border border-gray-200"
            >
              <div className="flex items-center justify-between">
                <div className={`${stat.color} p-3 rounded-lg text-white`}>
                  <Icon size={24} />
                </div>
                <div
                  className={`flex items-center gap-1 text-sm font-medium ${stat.trendUp ? "text-green-600" : "text-red-600"}`}
                >
                  {stat.trendUp ? (
                    <ArrowUpRight size={16} />
                  ) : (
                    <ArrowDownRight size={16} />
                  )}
                  {stat.trend}
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-sm font-medium text-gray-500">
                  {stat.name}
                </h3>
                <p className="text-2xl font-bold text-[#0a0a0a]">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Products */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-[#0a0a0a]">Последние товары</h3>
            <button className="text-sm text-[#05C3D4] font-medium hover:underline">
              Все товары
            </button>
          </div>
          <div className="divide-y divide-gray-200">
            {products.slice(0, 5).map(p => (
              <div
                key={p.id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center p-1">
                    <img
                      src={p.image}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#0a0a0a]">
                      {p.name}
                    </div>
                    <div className="text-xs text-gray-500">{p.price} ₽</div>
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(p.createdAt).toLocaleDateString("ru-RU")}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-bold text-[#0a0a0a] mb-6">Статус системы</h3>
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Заполнение БД</span>
                <span className="font-medium">65%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#05C3D4] w-[65%]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Версия API</div>
                <div className="font-bold text-[#0a0a0a]">v1.2.4</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="text-xs text-gray-500 mb-1">Окружение</div>
                <div className="font-bold text-green-600">Production</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
