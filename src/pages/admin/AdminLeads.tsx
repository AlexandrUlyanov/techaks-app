import { trpc } from "@/providers/trpc";
import { 
  Phone, 
  MessageSquare, 
  Calendar, 
  Trash2, 
  Tag,
  Loader2,
  User,
  ShoppingBag,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle
} from "lucide-react";
import { toast } from "sonner";

export default function AdminLeads() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.lead.list.useQuery();
  
  const updateStatusMutation = trpc.lead.updateStatus.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      toast.success("Статус обновлен");
    }
  });

  const deleteMutation = trpc.lead.delete.useMutation({
    onSuccess: () => {
      utils.lead.list.invalidate();
      toast.success("Заявка удалена");
    }
  });

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

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "new": return { label: "Новая", color: "bg-blue-100 text-blue-700", icon: AlertCircle };
      case "processing": return { label: "В работе", color: "bg-yellow-100 text-yellow-700", icon: Clock };
      case "completed": return { label: "Завершена", color: "bg-green-100 text-green-700", icon: CheckCircle2 };
      case "cancelled": return { label: "Отменена", color: "bg-red-100 text-red-700", icon: XCircle };
      default: return { label: status, color: "bg-gray-100 text-gray-700", icon: AlertCircle };
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
        ) : leads.map((lead) => {
          const status = getStatusInfo(lead.status);
          const StatusIcon = status.icon;
          const metadata = lead.metadata as any;

          return (
            <div key={lead.id} className={`bg-white border rounded-xl p-6 transition-all ${lead.status === 'new' ? 'border-[#00bcd4] shadow-sm' : 'border-gray-200'}`}>
              <div className="flex flex-col lg:flex-row justify-between gap-6">
                <div className="space-y-4 flex-1">
                  {/* Header Info */}
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
                    
                    {/* Status Dropdown-like Selector */}
                    <div className="relative group">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider cursor-pointer ${status.color}`}>
                        <StatusIcon size={14} />
                        {status.label}
                      </div>
                      <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden min-w-[140px]">
                        {(['new', 'processing', 'completed', 'cancelled'] as const).map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatusMutation.mutate({ id: lead.id, status: s })}
                            className="w-full text-left px-4 py-2 text-xs hover:bg-gray-50 font-medium transition-colors border-b border-gray-50 last:border-0"
                          >
                            {getStatusInfo(s).label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                      {getTypeLabel(lead.type)}
                    </span>
                  </div>

                  {/* Product Context */}
                  {metadata?.productName && (
                    <div className="flex items-center gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <ShoppingBag size={18} className="text-[#007c91]" />
                      <div className="text-sm">
                        <span className="text-gray-500">Запрос по товару:</span>{" "}
                        <a 
                          href={`/product/${metadata.productSlug}`} 
                          target="_blank" 
                          className="font-semibold text-[#007c91] hover:underline"
                        >
                          {metadata.productName}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Message */}
                  {lead.message && (
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 flex items-start gap-3">
                      <MessageSquare size={18} className="text-gray-400 mt-1 flex-shrink-0" />
                      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {lead.message}
                      </p>
                    </div>
                  )}

                  {/* Footer Stats */}
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

                {/* Actions */}
                <div className="flex items-center gap-2 lg:border-l lg:pl-6 border-gray-100">
                  <button 
                    onClick={() => {
                      if (confirm("Удалить эту заявку?")) {
                        deleteMutation.mutate({ id: lead.id });
                      }
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                    title="Удалить"
                  >
                    {deleteMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Trash2 size={20} />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
