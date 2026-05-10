import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Plus,
  MapPin,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  X,
  Phone,
  Clock,
  Star,
} from "lucide-react";

export default function AdminStores() {
  const [editingStore, setEditingStore] = useState<any>(null);
  const [bindingStoreId, setBindingStoreId] = useState<number | null>(null);
  const [selectedMsStoreId, setSelectedMsStoreId] = useState<Record<number, string>>({});

  const utils = trpc.useUtils();
  const { data: stores = [], isLoading } = trpc.store.getAll.useQuery();
  const { data: msStores = [] } = trpc.sync.getStores.useQuery({});

  const upsertMutation = trpc.store.upsert.useMutation({
    onSuccess: () => {
      utils.store.getAll.invalidate();
      setEditingStore(null);
    },
  });

  const deleteMutation = trpc.store.delete.useMutation({
    onSuccess: () => {
      utils.store.getAll.invalidate();
    },
  });

  const handleDelete = (id: number) => {
    if (confirm("Вы уверены, что хотите удалить этот магазин?")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      msId: (formData.get("msId") as string) || null,
      name: formData.get("name") as string,
      address: formData.get("address") as string,
      hours: formData.get("hours") as string,
      phone: formData.get("phone") as string,
      rating: formData.get("rating") as string,
      reviewCount: parseInt((formData.get("reviewCount") as string) || "0"),
      image: formData.get("image") as string,
      mapUrl: (formData.get("mapUrl") as string) || null,
      sortOrder: parseInt((formData.get("sortOrder") as string) || "0"),
    };

    upsertMutation.mutate({
      id: editingStore?.id,
      data,
    });
  };

  const handleBindStore = (store: any) => {
    const nextMsId = selectedMsStoreId[store.id] || store.msId || "";
    if (!nextMsId) return;

    upsertMutation.mutate({
      id: store.id,
      data: {
        msId: nextMsId,
        name: store.name,
        address: store.address,
        hours: store.hours,
        phone: store.phone,
        rating: String(store.rating),
        reviewCount: Number(store.reviewCount || 0),
        image: store.image,
        mapUrl: store.mapUrl || null,
        sortOrder: Number(store.sortOrder || 0),
      },
    });
    setBindingStoreId(null);
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-[#0a0a0a]">Список магазинов</h2>
        <button
          onClick={() => setEditingStore({})}
          className="flex items-center gap-2 px-4 py-2 bg-[#05C3D4] text-white rounded-lg hover:bg-[#0097a7] transition-colors font-medium"
        >
          <Plus size={18} />
          Добавить магазин
        </button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-2 py-12 text-center text-gray-500">
            Загрузка...
          </div>
        ) : (
          stores.map(store => (
            <div
              key={store.id}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col sm:flex-row"
            >
              <div className="sm:w-48 h-48 sm:h-auto overflow-hidden bg-gray-100 flex-shrink-0">
                <img
                  src={store.image}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg text-[#0a0a0a]">
                      {store.name}
                    </h3>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-1 text-yellow-500 font-bold">
                        <Star size={14} className="fill-current" />
                        <span className="text-sm">{store.rating}</span>
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          store.msId
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {store.msId
                          ? `Склад: ${
                              msStores.find(ms => ms.id === store.msId)?.name || store.msId
                            }`
                          : "Склад не привязан"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-start gap-2">
                      <MapPin size={16} className="text-[#05C3D4] mt-0.5" />
                      <span>{store.address}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-[#05C3D4]" />
                      <span>{store.hours}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} className="text-[#05C3D4]" />
                      <span>{store.phone}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      onClick={() => setEditingStore(store)}
                      className="p-2 text-gray-400 hover:text-[#00_bcd4] hover:bg-gray-50 rounded-lg transition-colors"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(store.id)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                    <button
                      onClick={() =>
                        setBindingStoreId(prev => (prev === store.id ? null : store.id))
                      }
                      className="ml-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-[#05C3D4] hover:text-[#05C3D4] transition-colors"
                    >
                      Привязать склад
                    </button>
                  </div>
                  {store.mapUrl && (
                    <a
                      href={store.mapUrl}
                      target="_blank"
                      className="flex items-center gap-1 text-sm text-[#05C3D4] font-medium hover:underline"
                    >
                      На карту <ExternalLink size={14} />
                    </a>
                  )}
                </div>
                {bindingStoreId === store.id && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <select
                      value={selectedMsStoreId[store.id] ?? store.msId ?? ""}
                      onChange={e =>
                        setSelectedMsStoreId(prev => ({
                          ...prev,
                          [store.id]: e.target.value,
                        }))
                      }
                      className="min-w-[260px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-[#05C3D4]"
                    >
                      <option value="">Выберите склад МойСклад</option>
                      {msStores.map(msStore => (
                        <option key={msStore.id} value={msStore.id}>
                          {msStore.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleBindStore(store)}
                      disabled={upsertMutation.isPending}
                      className="rounded-lg bg-[#05C3D4] px-3 py-2 text-xs font-semibold text-white hover:bg-[#0097a7] disabled:opacity-50"
                    >
                      Сохранить
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {editingStore && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setEditingStore(null)}
          />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-[#0a0a0a]">
                {editingStore.id ? "Редактировать магазин" : "Новый магазин"}
              </h2>
              <button
                onClick={() => setEditingStore(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Название
                </label>
                <input
                  name="msId"
                  defaultValue={editingStore.msId || ""}
                  className="hidden"
                />
                <input
                  name="name"
                  defaultValue={editingStore.name}
                  placeholder="пр. Строителей, 50А"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Полный адрес
                </label>
                <input
                  name="address"
                  defaultValue={editingStore.address}
                  placeholder="пр. Строителей, 50А (ТЦ Олимп)"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Режим работы
                  </label>
                  <input
                    name="hours"
                    defaultValue={editingStore.hours}
                    placeholder="Ежедневно 9:00–21:00"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Телефон
                  </label>
                  <input
                    name="phone"
                    defaultValue={editingStore.phone}
                    placeholder="+7 (927) 375-05-55"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Рейтинг
                  </label>
                  <input
                    name="rating"
                    defaultValue={editingStore.rating || "5.0"}
                    step="0.1"
                    type="number"
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Кол-во отзывов
                  </label>
                  <input
                    name="reviewCount"
                    type="number"
                    defaultValue={editingStore.reviewCount || 0}
                    required
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Ссылка на изображение
                </label>
                <input
                  name="image"
                  defaultValue={editingStore.image}
                  placeholder="/images/store-xxx.jpg"
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Ссылка на карту (Яндекс/2ГИС)
                </label>
                <input
                  name="mapUrl"
                  defaultValue={editingStore.mapUrl}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Порядок сортировки
                </label>
                <input
                  name="sortOrder"
                  type="number"
                  defaultValue={editingStore.sortOrder || 0}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg outline-none focus:border-[#05C3D4]"
                />
              </div>

              <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingStore(null)}
                  className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={upsertMutation.isPending}
                  className="flex items-center gap-2 px-6 py-2 bg-[#05C3D4] text-white font-medium rounded-lg hover:bg-[#0097a7] transition-colors disabled:opacity-50"
                >
                  {upsertMutation.isPending && (
                    <Loader2 size={16} className="animate-spin" />
                  )}
                  {editingStore.id ? "Сохранить изменения" : "Создать магазин"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
