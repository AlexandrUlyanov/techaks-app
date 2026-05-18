import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, MessageSquareReply, RefreshCw, Search, ShieldCheck, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";

const STATUS_OPTIONS = [
  { value: "", label: "Все статусы" },
  { value: "pending_moderation", label: "На модерации" },
  { value: "published", label: "Опубликован" },
  { value: "rejected", label: "Отклонён" },
  { value: "hidden", label: "Скрыт" },
];

function statusLabel(status: string) {
  switch (status) {
    case "pending_moderation":
      return "На модерации";
    case "published":
      return "Опубликован";
    case "rejected":
      return "Отклонён";
    case "hidden":
      return "Скрыт";
    default:
      return status;
  }
}

function statusTone(status: string) {
  switch (status) {
    case "pending_moderation":
      return "bg-amber-100 text-amber-800";
    case "published":
      return "bg-emerald-100 text-emerald-700";
    case "rejected":
      return "bg-rose-100 text-rose-700";
    case "hidden":
      return "bg-slate-100 text-slate-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

export default function AdminReviews() {
  const utils = trpc.useUtils();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<number | null>(null);
  const [moderationNote, setModerationNote] = useState("");
  const [reply, setReply] = useState("");

  const analytics = trpc.reviews.adminAnalytics.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });
  const reviews = trpc.reviews.adminList.useQuery(
    {
      page,
      limit: 20,
      search: search.trim() || undefined,
      status: status ? (status as "pending_moderation" | "published" | "rejected" | "hidden") : undefined,
      verifiedOnly: verifiedOnly || undefined,
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const moderateMutation = trpc.reviews.adminModerate.useMutation({
    onSuccess: async () => {
      toast.success("Статус отзыва обновлён");
      setModerationNote("");
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.adminAnalytics.invalidate(),
        utils.reviews.listProductReviews.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message || "Не удалось обновить отзыв"),
  });

  const replyMutation = trpc.reviews.adminReply.useMutation({
    onSuccess: async () => {
      toast.success("Ответ магазина сохранён");
      setReply("");
      await Promise.all([
        utils.reviews.adminList.invalidate(),
        utils.reviews.listProductReviews.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message || "Не удалось сохранить ответ"),
  });

  const reminderMutation = trpc.reviews.sendPendingReminders.useMutation({
    onSuccess: async data => {
      toast.success(`Отправлено напоминаний: ${data.sent}`);
      await utils.reviews.adminAnalytics.invalidate();
    },
  });

  const selectedReview = useMemo(
    () => reviews.data?.items.find(item => item.id === selectedReviewId) ?? null,
    [reviews.data?.items, selectedReviewId]
  );

  const totalPages = Math.max(1, Math.ceil((reviews.data?.total ?? 0) / 20));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Trust layer"
        title="Отзывы о товарах"
        description="Здесь мы модерируем отзывы, отслеживаем доверие к товарам и управляем письмами-напоминаниями после покупки."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => reminderMutation.mutate({ limit: 25 })}
              disabled={reminderMutation.isPending}
            >
              <RefreshCw size={16} className="mr-2" />
              Отправить напоминания
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="Всего отзывов" value={analytics.data?.totalReviews ?? 0} icon={Star} />
        <AdminStatCard label="На модерации" value={analytics.data?.pendingReviews ?? 0} icon={Clock3} tone="accent" />
        <AdminStatCard label="Подтвержденные" value={analytics.data?.verifiedReviews ?? 0} icon={ShieldCheck} />
        <AdminStatCard label="Напоминаний к отправке" value={analytics.data?.reminderCandidates ?? 0} icon={MessageSquareReply} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(380px,0.9fr)]">
        <AdminSection
          title="Очередь отзывов"
          description="Фильтруйте отзывы, находите негатив и быстро переводите отзывы в нужный статус."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Товар, автор, текст"
                  className="h-10 rounded-xl border border-border bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#05C3D4]"
                />
              </div>
              <select
                value={status}
                onChange={event => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-xl border border-border bg-white px-3 text-sm outline-none transition focus:border-[#05C3D4]"
              >
                {STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm font-semibold text-[#15171A]">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={event => {
                    setVerifiedOnly(event.target.checked);
                    setPage(1);
                  }}
                />
                Только подтверждённые
              </label>
            </div>
          }
          contentClassName="px-0 py-0"
        >
          <div className="divide-y divide-black/5">
            {reviews.isLoading ? (
              <div className="px-6 py-10 text-sm text-gray-500">Загружаем отзывы...</div>
            ) : reviews.data?.items.length ? (
              reviews.data.items.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedReviewId(item.id);
                    setModerationNote(item.moderationNote ?? "");
                    setReply(item.storeReply ?? "");
                  }}
                  className={`flex w-full flex-col gap-4 px-6 py-5 text-left transition hover:bg-[#F7FEFF] ${selectedReviewId === item.id ? "bg-[#F7FEFF]" : "bg-white"}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-black text-[#15171A]">{item.productName}</span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                        {item.isVerifiedPurchase ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                            Подтверждённая покупка
                          </span>
                        ) : null}
                      </div>
                      <div className="text-sm font-semibold text-gray-600">
                        {item.authorName} · {item.authorEmail}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <div className="font-black text-[#15171A]">{item.rating}/5</div>
                      <div>{formatDate(item.updatedAt)}</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="font-bold text-[#15171A]">{item.title}</div>
                    <p className="line-clamp-2 text-sm leading-6 text-gray-600">{item.text}</p>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-6 py-10 text-sm text-gray-500">По текущему фильтру отзывов нет.</div>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-black/5 px-6 py-4">
            <span className="text-sm text-gray-500">
              Всего: {reviews.data?.total ?? 0}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(page => Math.max(1, page - 1))} disabled={page <= 1}>
                Назад
              </Button>
              <span className="text-sm font-semibold text-[#15171A]">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPage(page => Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                Вперёд
              </Button>
            </div>
          </div>
        </AdminSection>

        <div className="space-y-6">
          <AdminSection
            title="Детали отзыва"
            description="Проверяйте содержание, меняйте статус и давайте официальный ответ магазина."
            tone="accent"
          >
            {selectedReview ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-black text-[#15171A]">{selectedReview.title}</span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${statusTone(selectedReview.status)}`}>
                      {statusLabel(selectedReview.status)}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-gray-600">{selectedReview.text}</p>
                  {selectedReview.pros ? (
                    <p className="text-sm text-emerald-700"><strong>Плюсы:</strong> {selectedReview.pros}</p>
                  ) : null}
                  {selectedReview.cons ? (
                    <p className="text-sm text-rose-700"><strong>Минусы:</strong> {selectedReview.cons}</p>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Button
                    onClick={() =>
                      moderateMutation.mutate({
                        reviewId: selectedReview.id,
                        status: "published",
                        moderationNote,
                      })
                    }
                    disabled={moderateMutation.isPending}
                  >
                    <CheckCircle2 size={16} className="mr-2" />
                    Опубликовать
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      moderateMutation.mutate({
                        reviewId: selectedReview.id,
                        status: "rejected",
                        moderationNote,
                      })
                    }
                    disabled={moderateMutation.isPending}
                  >
                    <XCircle size={16} className="mr-2" />
                    Отклонить
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      moderateMutation.mutate({
                        reviewId: selectedReview.id,
                        status: "hidden",
                        moderationNote,
                      })
                    }
                    disabled={moderateMutation.isPending}
                  >
                    <AlertTriangle size={16} className="mr-2" />
                    Скрыть
                  </Button>
                </div>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    Комментарий модерации
                  </span>
                  <textarea
                    value={moderationNote}
                    onChange={event => setModerationNote(event.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition focus:border-[#05C3D4]"
                  />
                </label>

                <label className="block space-y-2">
                  <span className="text-xs font-black uppercase tracking-[0.18em] text-gray-400">
                    Ответ магазина
                  </span>
                  <textarea
                    value={reply}
                    onChange={event => setReply(event.target.value)}
                    rows={5}
                    className="w-full rounded-xl border border-border px-4 py-3 text-sm outline-none transition focus:border-[#05C3D4]"
                  />
                </label>
                <Button
                  variant="outline"
                  onClick={() => replyMutation.mutate({ reviewId: selectedReview.id, reply })}
                  disabled={replyMutation.isPending || reply.trim().length < 3}
                >
                  <MessageSquareReply size={16} className="mr-2" />
                  Сохранить ответ магазина
                </Button>
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                Выберите отзыв из списка, чтобы увидеть детали и принять решение.
              </div>
            )}
          </AdminSection>

          <AdminSection
            title="Товары с риском доверия"
            description="Быстрый взгляд на товары, где отзывы уже тянут рейтинг вниз."
            tone="subtle"
          >
            <div className="space-y-3">
              {analytics.data?.lowRatedProducts?.length ? (
                analytics.data.lowRatedProducts.map(product => (
                  <div key={product.productId} className="rounded-xl border border-border bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-[#15171A]">{product.productName}</div>
                        <div className="text-sm text-gray-500">{product.reviewCount} отзывов</div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-rose-600">{product.rating}</div>
                        <div className="text-xs text-gray-500">средний рейтинг</div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">Пока нет товаров с просевшим рейтингом.</div>
              )}
            </div>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
