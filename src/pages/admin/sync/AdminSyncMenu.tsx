import { Link } from "react-router";
import { PackageOpen, ArrowRight, Clock, CheckCircle2, AlertCircle, RefreshCw, FileText } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function AdminSyncMenu() {
  const { data: logs = [], isLoading } = trpc.sync.getLogs.useQuery();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl font-black font-heading tracking-tight text-[#15171A] uppercase">
          Синхронизации
        </h1>
        <p className="text-gray-500 mt-2">
          Управление интеграциями и обменом данных с внешними сервисами.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link
          to="/admin/sync/moysklad"
          className="group bg-white rounded-3xl p-6 border-2 border-transparent hover:border-[#05C3D4] shadow-sm hover:shadow-xl transition-all block relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-100 transition-opacity -translate-x-4 group-hover:translate-x-0">
            <ArrowRight className="text-[#05C3D4]" />
          </div>
          <div className="w-14 h-14 bg-[#15171A] rounded-2xl flex items-center justify-center text-white mb-6">
            <PackageOpen size={28} />
          </div>
          <h3 className="text-xl font-bold mb-2">МойСклад</h3>
          <p className="text-gray-500 text-sm leading-relaxed">
            Синхронизация товаров, остатков, цен и модификаций.
          </p>
        </Link>
      </div>

      {/* Logs Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold uppercase tracking-tight">История синхронизаций</h2>
        
        <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-black uppercase text-gray-400">Дата</th>
                  <th className="px-6 py-4 text-xs font-black uppercase text-gray-400">Тип</th>
                  <th className="px-6 py-4 text-xs font-black uppercase text-gray-400">Статус</th>
                  <th className="px-6 py-4 text-xs font-black uppercase text-gray-400">Сообщение</th>
                  <th className="px-6 py-4 text-xs font-black uppercase text-gray-400">Результат</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">Загрузка логов...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-10 text-center text-gray-400">Истории пока нет</td></tr>
                ) : (
                  logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock size={14} className="text-gray-300" />
                          {format(new Date(log.createdAt), "d MMM, HH:mm", { locale: ru })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold uppercase">{log.type}</td>
                      <td className="px-6 py-4">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-600 text-[10px] font-black uppercase rounded-lg">
                            <CheckCircle2 size={12} /> Успешно
                          </span>
                        ) : log.status === 'error' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-black uppercase rounded-lg">
                            <AlertCircle size={12} /> Ошибка
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-black uppercase rounded-lg">
                            <RefreshCw size={12} className="animate-spin" /> В процессе
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{log.message}</td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {log.details?.stats && (
                          <div className="flex gap-3 mb-2">
                            <span>📦 {logDetails(log).products}</span>
                            <span>📁 {logDetails(log).categories}</span>
                            <span>🏠 {logDetails(log).stocks}</span>
                          </div>
                        )}
                        {log.details?.logFileUrl && (
                          <a 
                            href={log.details.logFileUrl} 
                            target="_blank" 
                            download 
                            className="text-[#05C3D4] hover:underline flex items-center gap-1 text-[10px] font-bold uppercase transition-all"
                          >
                             <FileText size={12} /> Скачать лог
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function logDetails(log: any) {
    return {
        products: log.details?.stats?.products || 0,
        categories: log.details?.stats?.categories || 0,
        stocks: log.details?.stats?.stocks || 0
    };
}
