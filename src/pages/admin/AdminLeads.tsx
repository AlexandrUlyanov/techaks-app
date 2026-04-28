import { trpc } from "@/providers/trpc";
import { 
  Phone, 
  MessageSquare, 
  Calendar, 
  Trash2, 
  Tag,
  Loader2,
  User,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function AdminLeads() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.lead.list.useQuery();
  const deleteMutation = trpc.lead.delete?.useMutation?.({
    onSuccess: () => {
      utils.lead.list.invalidate();
      toast.success("Заявка удалена");
    }
  }) || { mutate: () => alert("Метод удаления не реализован в API") };

  const leads = data?.leads || [];

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "callback": return "Обратный звонок";
      case "availability": return "Наличие товара";
      case "question": return "Вопрос";
      case "service": return "Сервис";
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "callback": return "bg-blue-100 text-blue-700";
      case "availability": return "bg-purple-100 text-purple-700";
      case "question": return "bg-orange-100 text-orange-700";
      case "service": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-[#00bcd4]" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Заявки клиентов</h2>
        <div className="text-sm text-gray-500">Всего: {data?.total || 0}</div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {leads.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-500">
            Заявок пока нет
          </div>
        ) : leads.map((lead) => (
          <div key={lead.id} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-4 flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                    <User size={16} className="text-gray-400" />
                    <span className="font-bold text-[#0a0a0a]">{lead.name}</span>
                  </div>
                  <a 
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-2 bg-[#00bcd4]/10 text-[#007c91] px-3 py-1.5 rounded-lg border border-[#00bcd4]/20 hover:bg-[#00bcd4]/20 transition-colors"
                  >
                    <Phone size={16} />
                    <span className="font-bold">{lead.phone}</span>
                  </a>
                  <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${getTypeColor(lead.type)}`}>
                    {getTypeLabel(lead.type)}
                  </span>
                </div>

                {lead.message && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex items-start gap-3">
                    <MessageSquare size={18} className="text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                      {lead.message}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-6 text-xs text-gray-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    {new Date(lead.createdAt).toLocaleString("ru-RU")}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Tag size={14} />
                    Источник: {lead.source}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 md:border-l md:pl-6 border-gray-100">
                <button 
                  onClick={() => {
                    if (confirm("Удалить эту заявку?")) {
                      // Note: I'll add delete mutation to API in next step
                      toast.error("Функция удаления будет доступна после обновления API");
                    }
                  }}
                  className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                  title="Удалить"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
