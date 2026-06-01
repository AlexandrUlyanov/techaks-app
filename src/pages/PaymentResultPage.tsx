import { Link, useSearchParams } from "react-router";
import { CheckCircle2, Clock3, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/providers/trpc";
import { useSeo } from "@/lib/seo";

function formatPrice(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;
}

function getState(paymentStatus?: string | null) {
  if (paymentStatus === "paid") {
    return {
      title: "Оплата прошла",
      text: "Спасибо. Мы получили оплату и передали заказ в обработку.",
      icon: CheckCircle2,
      tone: "text-[#05C3D4]",
    };
  }

  if (paymentStatus === "payment_error" || paymentStatus === "cancelled") {
    return {
      title: "Оплата не завершена",
      text: "Платёж отменён или не был подтверждён. Заказ сохранён, можно связаться с менеджером.",
      icon: XCircle,
      tone: "text-[#F0642B]",
    };
  }

  return {
    title: "Проверяем оплату",
    text: "YooKassa может передать подтверждение не мгновенно. Обновите страницу через несколько секунд.",
    icon: Clock3,
    tone: "text-[#05C3D4]",
  };
}

export default function PaymentResultPage() {
  useSeo({
    title: "Результат оплаты — ТЕХАКС",
    description: "Статус онлайн-оплаты заказа в интернет-магазине ТЕХАКС.",
    canonicalPath: "/payment/result",
    noindex: true,
  });

  const [searchParams] = useSearchParams();
  const orderId = Number(searchParams.get("orderId") || 0);
  const result = trpc.ecommerce.getPaymentResult.useQuery(
    { orderId },
    {
      enabled: orderId > 0,
      refetchInterval: data =>
        data.state.data?.paymentStatus === "awaiting_payment" ? 5000 : false,
    }
  );

  const order = result.data;
  const state = getState(order?.paymentStatus);
  const Icon = state.icon;

  return (
    <div className="min-h-[70vh] bg-background px-4 py-16 text-foreground">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <div className="mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-[#05C3D4]/10">
          <Icon size={46} className={state.tone} />
        </div>

        <h1 className="font-heading text-3xl font-black uppercase tracking-tight md:text-4xl">
          {orderId > 0 ? state.title : "Заказ не найден"}
        </h1>

        <p className="mt-4 max-w-md text-sm font-medium leading-7 text-muted-foreground">
          {orderId > 0
            ? state.text
            : "В ссылке нет номера заказа. Проверьте письмо или откройте личный кабинет."}
        </p>

        {result.isLoading ? (
          <div className="mt-8 h-10 w-10 animate-spin rounded-full border-2 border-[#05C3D4]/20 border-t-[#05C3D4]" />
        ) : null}

        {result.error ? (
          <div className="mt-8 rounded-2xl bg-destructive/10 px-5 py-4 text-sm font-semibold text-destructive">
            {result.error.message}
          </div>
        ) : null}

        {order ? (
          <div className="mt-8 w-full rounded-[2rem] bg-card/70 p-6 text-left">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-muted-foreground">
              Заказ
            </div>
            <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xl font-black">
                  {order.orderNumber || `#${order.id}`}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Статус оплаты: {order.paymentStatus}
                </div>
              </div>
              <div className="text-2xl font-black text-[#05C3D4]">
                {formatPrice(order.totalPrice)}
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link to="/account">
            <Button className="h-12 rounded-full px-8">Открыть заказы</Button>
          </Link>
          <Link to="/catalog">
            <Button variant="outline" className="h-12 rounded-full px-8">
              Вернуться в каталог
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
