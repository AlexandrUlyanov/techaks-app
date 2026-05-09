import { RefreshCw, TrendingUp, Warehouse } from "lucide-react";
import { trpc } from "@/providers/trpc";

function formatPrice(price: number) {
  return new Intl.NumberFormat("ru-RU").format(price) + " ₽";
}

export default function AdminMerchandising() {
  const dashboard = trpc.merchandising.dashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const data = dashboard.data;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
            Мерчендайзинг
          </h1>
          <p className="text-gray-500 mt-2 max-w-3xl">
            Робот поднимает товары с большим количеством на складах. Эти товары
            используются на главной и в рекомендациях на странице товара.
          </p>
        </div>
        <button
          onClick={() => dashboard.refetch()}
          disabled={dashboard.isFetching}
          className="flex items-center gap-2 px-5 py-3 bg-[#05C3D4] hover:bg-[#04a9b8] text-black rounded-xl font-bold transition-all disabled:opacity-50"
        >
          <RefreshCw size={18} className={dashboard.isFetching ? "animate-spin" : ""} />
          Пересчитать
        </button>
      </div>

      {dashboard.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-red-700">
          {dashboard.error.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          ["Кандидатов", data?.totalCandidates ?? 0],
          ["С остатками", data?.candidatesWithStock ?? 0],
          ["Суммарный остаток", data?.totalStock ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {label}
            </div>
            <div className="text-3xl font-black text-[#15171A] mt-2">
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest text-[#15171A]">
              Самые выгодные товары
            </h2>
            <div className="text-xs text-gray-400 mt-1">
              Сортировка: общий остаток по складам, затем свежесть товара
            </div>
          </div>
          <TrendingUp className="text-[#05C3D4]" size={22} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400">
                <th className="py-3 pl-6 pr-4">Товар</th>
                <th className="py-3 pr-4">Категория</th>
                <th className="py-3 pr-4">Цена</th>
                <th className="py-3 pr-4">Остаток</th>
                <th className="py-3 pr-6">Складов</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map(item => (
                <tr key={item.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-3 pl-6 pr-4">
                    <div className="flex items-center gap-3 min-w-[360px]">
                      <div className="h-14 w-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div>
                        <div className="font-black text-[#15171A] line-clamp-2">
                          {item.name}
                        </div>
                        <div className="text-xs text-gray-400 font-mono mt-1">
                          {item.slug}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-gray-600">{item.categoryName}</td>
                  <td className="py-3 pr-4 font-black text-[#05C3D4]">
                    {formatPrice(item.price)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1 text-xs font-black text-green-700">
                      <Warehouse size={13} />
                      {Number(item.totalStock || 0)}
                    </span>
                  </td>
                  <td className="py-3 pr-6 font-bold text-gray-600">
                    {Number(item.storeCount || 0)}
                  </td>
                </tr>
              ))}
              {data?.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-gray-400">
                    Кандидатов пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
