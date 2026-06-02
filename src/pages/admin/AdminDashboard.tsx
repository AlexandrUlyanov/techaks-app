import { useMemo } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  ArrowRight,
  Clock3,
  FolderTree,
  Loader2,
  MapPinned,
  MessageSquare,
  Package,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Wallet,
} from "lucide-react";

import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import AdminStatCard from "@/components/admin/AdminStatCard";
import { trpc } from "@/providers/trpc";

function formatMoney(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getOrderStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "pending":
    case "new":
      return "Новый";
    case "waiting_call":
      return "Ждёт звонка";
    case "confirmed":
      return "Подтверждён";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачен";
    case "processing":
      return "В обработке";
    case "confirmed_by_customer":
      return "Подтверждён клиентом";
    case "ready_for_pickup":
      return "Готов к выдаче";
    case "assembling":
      return "Собирается";
    case "assembled":
      return "Собран";
    case "awaiting_dispatch":
      return "Ожидает отправки";
    case "shipped":
      return "Отгружен";
    case "handed_to_delivery":
      return "Передан в доставку";
    case "in_delivery":
      return "Доставляется";
    case "delivered":
      return "Доставлен";
    case "completed":
      return "Выполнен";
    case "return_requested":
      return "Запрошен возврат";
    case "problem":
      return "Проблемный";
    case "cancelled":
      return "Отменён";
    default:
      return value || "Не задан";
  }
}

function getPaymentStatusLabel(value: string | null | undefined) {
  switch (value) {
    case "unpaid":
      return "Не оплачен";
    case "awaiting_payment":
      return "Ожидает оплаты";
    case "paid":
      return "Оплачен";
    case "partially_paid":
      return "Частично оплачен";
    case "payment_error":
      return "Ошибка оплаты";
    case "refund":
      return "Возврат";
    case "partial_refund":
      return "Частичный возврат";
    default:
      return value || "Не задан";
  }
}

function getSyncStatusMeta(value: string | null | undefined) {
  switch (value) {
    case "success":
      return {
        label: "Успешно",
        className: "bg-emerald-100 text-emerald-700",
      };
    case "running":
      return {
        label: "В процессе",
        className: "bg-sky-100 text-sky-700",
      };
    case "error":
      return {
        label: "С ошибкой",
        className: "bg-rose-100 text-rose-700",
      };
    default:
      return {
        label: value || "Не запускался",
        className: "bg-slate-100 text-slate-700",
      };
  }
}

function ProductStateBadge({
  isActive,
  isAutoBlocked,
}: {
  isActive: boolean;
  isAutoBlocked: boolean;
}) {
  const meta = isAutoBlocked
    ? { label: "Автоблок", className: "bg-amber-100 text-amber-700" }
    : isActive
      ? { label: "Активен", className: "bg-emerald-100 text-emerald-700" }
      : { label: "Скрыт", className: "bg-slate-100 text-slate-700" };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function OrderRow({
  order,
}: {
  order: {
    id: number;
    orderNumber: string | null;
    status: string;
    paymentStatus: string;
    totalPrice: number;
    customerName: string | null;
    customerPhone: string | null;
    createdAt: Date | null;
  };
}) {
  return (
    <Link
      to={`/admin/leads/${order.id}`}
      className="group flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-gray-50"
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-[#15171A]">
            {order.orderNumber || `Заказ #${order.id}`}
          </span>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
            {getOrderStatusLabel(order.status)}
          </span>
          <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold text-cyan-700">
            {getPaymentStatusLabel(order.paymentStatus)}
          </span>
        </div>
        <div className="text-sm text-gray-500">
          {order.customerName || "Клиент"}{order.customerPhone ? ` · ${order.customerPhone}` : ""}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-bold text-[#15171A]">{formatMoney(order.totalPrice)}</div>
        <div className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</div>
      </div>
    </Link>
  );
}

function ProductRow({
  product,
}: {
  product: {
    id: number;
    name: string;
    price: number;
    image: string;
    createdAt: Date | null;
    isActive: boolean;
    isAutoBlocked: boolean;
  };
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl px-4 py-4 transition-colors hover:bg-gray-50">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-50 p-2">
          {product.image ? (
            <img
              src={product.image}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Package size={18} className="text-gray-300" />
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <div className="truncate font-semibold text-[#15171A]">{product.name}</div>
          <div className="text-sm text-gray-500">{formatMoney(product.price)}</div>
        </div>
      </div>
      <div className="shrink-0 space-y-1 text-right">
        <ProductStateBadge
          isActive={product.isActive}
          isAutoBlocked={product.isAutoBlocked}
        />
        <div className="text-xs text-gray-500">{formatDateTime(product.createdAt)}</div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const overview = trpc.ecommerce.getAdminDashboardOverview.useQuery(undefined, {
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const quickCards = useMemo(() => {
    if (!overview.data) return [];

    const cards: Array<{
      label: string;
      value: string | number;
      hint?: string;
      icon: typeof ShoppingBag;
      tone?: "default" | "accent" | "success" | "warning" | "danger";
    }> = [];

    if (overview.data.orders) {
      cards.push(
        {
          label: "Заказы сегодня",
          value: overview.data.orders.ordersToday,
          hint: `За 7 дней: ${overview.data.orders.orders7d}`,
          icon: ShoppingBag,
          tone: "accent",
        },
        {
          label: "Оплачено за 7 дней",
          value: formatMoney(overview.data.orders.paidRevenue7d),
          hint: `Сегодня: ${formatMoney(overview.data.orders.paidRevenueToday)}`,
          icon: Wallet,
          tone: overview.data.orders.paidRevenue7d > 0 ? "success" : "default",
        }
      );
    }

    if (overview.data.catalog) {
      cards.push(
        {
          label: "Активные товары",
          value: overview.data.catalog.activeProducts,
          hint: `Всего: ${overview.data.catalog.totalProducts}`,
          icon: Package,
          tone: "default",
        },
        {
          label: "Категории каталога",
          value: overview.data.catalog.categoriesCount,
          hint: overview.data.catalog.storesCount
            ? `Магазинов: ${overview.data.catalog.storesCount}`
            : "Структура каталога",
          icon: FolderTree,
          tone: "default",
        }
      );
    }

    if (overview.data.reservations) {
      cards.push({
        label: "Активные резервы",
        value: overview.data.reservations.activeCount,
        hint: `Истекают сегодня: ${overview.data.reservations.expiringTodayCount}`,
        icon: MapPinned,
        tone:
          overview.data.reservations.expiringTodayCount > 0 ? "warning" : "default",
      });
    }

    if (overview.data.sync) {
      cards.push({
        label: "Очередь синхронизации",
        value:
          overview.data.sync.pendingJobs + overview.data.sync.processingJobs,
        hint: `Ошибок: ${overview.data.sync.failedJobs}`,
        icon: RefreshCw,
        tone: overview.data.sync.failedJobs > 0 ? "danger" : "default",
      });
    }

    if (overview.data.reviews) {
      cards.push({
        label: "Отзывы на модерации",
        value: overview.data.reviews.pendingCount,
        hint: `Всего отзывов: ${overview.data.reviews.totalCount}`,
        icon: Star,
        tone: overview.data.reviews.pendingCount > 0 ? "warning" : "default",
      });
    }

    return cards.slice(0, 6);
  }, [overview.data]);

  if (overview.isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Операции"
          title="Дашборд"
          description="Собираю реальную оперативную сводку по заказам, каталогу, резервам и синхронизациям."
        />
        <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-10 text-sm text-gray-500">
          <Loader2 size={18} className="animate-spin text-[#05C3D4]" />
          Загружаю реальные метрики backoffice...
        </div>
      </div>
    );
  }

  if (overview.error || !overview.data) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Операции"
          title="Дашборд"
          description="Оперативная сводка по заказам, каталогу, резервам и синхронизациям."
          actions={
            <button
              type="button"
              onClick={() => overview.refetch()}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
            >
              <RefreshCw size={16} />
              Обновить
            </button>
          }
        />

        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-6 text-sm text-rose-700">
          Не удалось загрузить дашборд: {overview.error?.message || "неизвестная ошибка"}.
        </div>
      </div>
    );
  }

  const { data } = overview;
  const latestSyncMeta = data.sync?.latestFullRun
    ? getSyncStatusMeta(data.sync.latestFullRun.status)
    : null;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Операции"
        title="Дашборд"
        description="Это живая сводка по магазину: заказы, оплата, каталог, резервы, отзывы и контур синхронизаций без захардкоженных цифр."
        meta={
          <div className="inline-flex items-center gap-2 rounded-full bg-[#F7FEFF] px-3 py-1 text-xs font-semibold text-[#0099A8]">
            <Clock3 size={14} />
            Обновлено: {formatDateTime(data.generatedAt)}
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => overview.refetch()}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-gray-200 px-4 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
          >
            <RefreshCw size={16} className={overview.isFetching ? "animate-spin text-[#05C3D4]" : ""} />
            Обновить данные
          </button>
        }
      />

      {quickCards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {quickCards.map(card => (
            <AdminStatCard
              key={card.label}
              label={card.label}
              value={card.value}
              hint={card.hint}
              icon={card.icon}
              tone={card.tone}
            />
          ))}
        </div>
      ) : null}

      {data.orders ? (
        <AdminSection
          title="Заказы и оплата"
          description="Первый экран для менеджера: что прилетело сегодня, что требует оплаты и где сейчас уже нужна реакция."
          actions={
            <Link
              to="/admin/leads"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
            >
              Все заказы
              <ArrowRight size={15} className="text-[#05C3D4]" />
            </Link>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <AdminStatCard label="Новые" value={data.orders.newOrders} icon={ShoppingBag} tone="accent" />
              <AdminStatCard label="Ожидают оплаты" value={data.orders.awaitingPaymentOrders} icon={Wallet} tone={data.orders.awaitingPaymentOrders > 0 ? "warning" : "default"} />
              <AdminStatCard label="В обработке" value={data.orders.processingOrders} icon={Clock3} tone="default" />
              <AdminStatCard label="Проблемные" value={data.orders.problemOrders} icon={ShieldAlert} tone={data.orders.problemOrders > 0 ? "danger" : "default"} />
              <AdminStatCard label="Непрочитанные сообщения" value={data.orders.unreadCustomerMessages} icon={MessageSquare} tone={data.orders.unreadCustomerMessages > 0 ? "warning" : "default"} />
              <AdminStatCard label="Требуют ответа" value={data.orders.needsResponseOrders} icon={MessageSquare} tone={data.orders.needsResponseOrders > 0 ? "warning" : "default"} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
                <div>
                  <div className="font-semibold text-[#15171A]">Последние заказы</div>
                  <div className="text-sm text-gray-500">Свежая очередь без перехода в полный список.</div>
                </div>
                <div className="text-sm font-semibold text-gray-500">
                  Сегодня: {data.orders.ordersToday}
                </div>
              </div>
              <div className="divide-y divide-gray-100 bg-white">
                {data.recentOrders.length > 0 ? (
                  data.recentOrders.map(order => <OrderRow key={order.id} order={order} />)
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    Заказов пока нет.
                  </div>
                )}
              </div>
            </div>
          </div>
        </AdminSection>
      ) : null}

      {data.catalog ? (
        <AdminSection
          title="Каталог"
          description="Здесь сразу видно, сколько товаров реально активны, что скрыто вручную и где автоматика уже вмешалась."
          actions={
            <div className="flex flex-wrap gap-2">
              <Link
                to="/admin/categories"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
              >
                Категории
              </Link>
              <Link
                to="/admin/products"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
              >
                Все товары
                <ArrowRight size={15} className="text-[#05C3D4]" />
              </Link>
            </div>
          }
        >
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <AdminStatCard label="Всего товаров" value={data.catalog.totalProducts} icon={Package} tone="default" />
              <AdminStatCard label="Активные" value={data.catalog.activeProducts} icon={ShieldCheck} tone="success" />
              <AdminStatCard label="Скрыты вручную" value={data.catalog.manuallyHiddenProducts} icon={Package} tone={data.catalog.manuallyHiddenProducts > 0 ? "warning" : "default"} />
              <AdminStatCard label="Автоблок" value={data.catalog.autoBlockedProducts} icon={AlertTriangle} tone={data.catalog.autoBlockedProducts > 0 ? "danger" : "default"} />
              <AdminStatCard label="Категории" value={data.catalog.categoriesCount} icon={FolderTree} tone="default" />
              <AdminStatCard label="Магазины" value={data.catalog.storesCount} icon={Store} tone="default" />
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/70">
              <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-4">
                <div>
                  <div className="font-semibold text-[#15171A]">Последние товары</div>
                  <div className="text-sm text-gray-500">Быстрый взгляд на свежие позиции в каталоге.</div>
                </div>
              </div>
              <div className="divide-y divide-gray-100 bg-white">
                {data.recentProducts.length > 0 ? (
                  data.recentProducts.map(product => (
                    <ProductRow key={product.id} product={product} />
                  ))
                ) : (
                  <div className="px-4 py-10 text-center text-sm text-gray-500">
                    Товаров пока нет.
                  </div>
                )}
              </div>
            </div>
          </div>
        </AdminSection>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        {data.reservations ? (
          <AdminSection
            title="Резервы"
            description="Контролируем активные резервы и следим, что истекает уже сегодня."
            actions={
              <Link
                to="/admin/reservations"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
              >
                Открыть раздел
              </Link>
            }
            contentClassName="px-6 py-6"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <AdminStatCard label="Активные" value={data.reservations.activeCount} icon={MapPinned} tone="accent" />
              <AdminStatCard label="Истекают сегодня" value={data.reservations.expiringTodayCount} icon={Clock3} tone={data.reservations.expiringTodayCount > 0 ? "warning" : "default"} />
              <AdminStatCard label="Истёкшие" value={data.reservations.expiredCount} icon={ShieldAlert} tone={data.reservations.expiredCount > 0 ? "warning" : "default"} />
              <AdminStatCard label="Переведены в заказ за 7 дней" value={data.reservations.converted7dCount} icon={ShoppingBag} tone={data.reservations.converted7dCount > 0 ? "success" : "default"} />
            </div>
          </AdminSection>
        ) : null}

        {data.reviews ? (
          <AdminSection
            title="Отзывы"
            description="Смотрим, что ждёт модерации, и не теряем кандидатов на напоминания."
            actions={
              <Link
                to="/admin/reviews"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
              >
                Открыть раздел
              </Link>
            }
            contentClassName="px-6 py-6"
          >
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <AdminStatCard label="На модерации" value={data.reviews.pendingCount} icon={Star} tone={data.reviews.pendingCount > 0 ? "warning" : "default"} />
              <AdminStatCard label="Опубликованы" value={data.reviews.publishedCount} icon={ShieldCheck} tone={data.reviews.publishedCount > 0 ? "success" : "default"} />
              <AdminStatCard label="Средний рейтинг" value={data.reviews.avgPublishedRating || "—"} icon={Star} tone="accent" />
              <AdminStatCard label="Кандидаты на напоминание" value={data.reviews.reminderCandidates} icon={MessageSquare} tone={data.reviews.reminderCandidates > 0 ? "warning" : "default"} />
            </div>
          </AdminSection>
        ) : null}

        {data.sync ? (
          <AdminSection
            title="Синхронизации"
            description="Состояние очереди заказов в МойСклад и последнего full sync в одном месте."
            actions={
              <Link
                to="/admin/sync"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-[#15171A] transition-colors hover:border-[#05C3D4]/40 hover:bg-[#F7FEFF]"
              >
                Открыть раздел
              </Link>
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <AdminStatCard label="В очереди" value={data.sync.pendingJobs} icon={RefreshCw} tone={data.sync.pendingJobs > 0 ? "warning" : "default"} />
                <AdminStatCard label="В работе" value={data.sync.processingJobs} icon={Loader2} tone={data.sync.processingJobs > 0 ? "accent" : "default"} />
                <AdminStatCard label="Ошибки" value={data.sync.failedJobs} icon={ShieldAlert} tone={data.sync.failedJobs > 0 ? "danger" : "default"} />
                <AdminStatCard label="Заказы ждут sync" value={data.sync.ordersNeedingSync} icon={ShoppingBag} tone={data.sync.ordersNeedingSync > 0 ? "warning" : "default"} />
              </div>

              <div className="rounded-2xl bg-gray-50 px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#15171A]">Последний full sync</span>
                  {latestSyncMeta ? (
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${latestSyncMeta.className}`}>
                      {latestSyncMeta.label}
                    </span>
                  ) : null}
                </div>

                {data.sync.latestFullRun ? (
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    <div>
                      Запуск: <span className="font-medium text-[#15171A]">{formatDateTime(data.sync.latestFullRun.startedAt)}</span>
                    </div>
                    <div>
                      Завершение: <span className="font-medium text-[#15171A]">{formatDateTime(data.sync.latestFullRun.finishedAt)}</span>
                    </div>
                    <div>
                      Фаза: <span className="font-medium text-[#15171A]">{data.sync.latestFullRun.phase || "—"}</span>
                    </div>
                    {data.sync.latestFullRun.message ? (
                      <div className="rounded-xl bg-white px-3 py-3 text-sm leading-6 text-gray-600">
                        {data.sync.latestFullRun.message}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-gray-500">
                    Истории full sync пока нет.
                  </div>
                )}
              </div>
            </div>
          </AdminSection>
        ) : null}
      </div>

      {!data.orders &&
      !data.catalog &&
      !data.reservations &&
      !data.reviews &&
      !data.sync ? (
        <AdminSection
          title="Нет доступных метрик"
          description="Для вашей роли сейчас не открыты разделы с операционной аналитикой. Если этот экран должен быть шире, нужно проверить набор прав в админке."
          tone="subtle"
        >
          <div className="rounded-2xl bg-white px-6 py-8 text-sm leading-6 text-gray-500">
            Дашборд работает на живых данных и показывает только те секции, к которым у текущей роли есть доступ.
          </div>
        </AdminSection>
      ) : null}
    </div>
  );
}
