import { Banknote, CreditCard, HandCoins, MapPinned, Package, Truck } from "lucide-react";
import { Link } from "react-router";

const deliveryCards = [
  {
    icon: Package,
    title: "Самовывоз",
    text: "После подтверждения заказа товар можно забрать в ближайшем магазине ТЕХАКС.",
  },
  {
    icon: MapPinned,
    title: "Доставка по Пензе",
    text: "Бережно доставим по городу после подтверждения заказа и согласования адреса.",
  },
  {
    icon: Truck,
    title: "Доставка по России",
    text: "Отправляем заказы по России транспортной компанией или курьерской службой.",
  },
];

const paymentItems = [
  { icon: Banknote, title: "Наличными" },
  { icon: CreditCard, title: "Картой" },
  { icon: HandCoins, title: "При получении" },
];

export default function ProductDeliveryTab({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="space-y-4 text-foreground">
        <div>
          <h2 className="text-xl font-black tracking-tight">Доставка и оплата</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Кратко о самых частых способах получения и оплаты заказа.
          </p>
        </div>

        <div className="space-y-3">
          {deliveryCards.map(item => (
            <div key={item.title} className="rounded-[1.1rem] bg-muted/60 px-4 py-4">
              <div className="text-sm font-bold text-foreground">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {paymentItems.map(item => (
            <span
              key={item.title}
              className="inline-flex rounded-full bg-muted/70 px-3 py-2 text-sm font-semibold text-foreground"
            >
              {item.title}
            </span>
          ))}
        </div>

        <Link to="/payment-delivery" className="inline-flex text-sm font-bold text-[#05C3D4]">
          Подробнее о доставке и оплате
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-foreground">
      <div className="max-w-3xl">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
          Доставка и оплата
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
          Как получить и оплатить заказ
        </h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Блок подготовлен так, чтобы позже условия можно было забирать из настроек сайта без переделки интерфейса.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {deliveryCards.map(item => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-[1.4rem] bg-muted/60 p-5 transition-[background,transform] duration-200 ease-out hover:-translate-y-[2px] hover:bg-[rgba(5,195,212,0.07)] dark:hover:bg-[#05C3D4]/10"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                <Icon size={22} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-foreground">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.text}</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-[1.4rem] bg-muted/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-foreground">Способы оплаты</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Подберём удобный вариант под способ получения заказа.
            </p>
          </div>
          <span className="inline-flex rounded-full bg-[rgba(5,195,212,0.1)] px-3 py-2 text-xs font-bold text-[#047E8A]">
            3 способа
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {paymentItems.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-[1.1rem] bg-card/80 px-4 py-4"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                  <Icon size={18} />
                </div>
                <div className="mt-3 text-sm font-bold text-foreground">{item.title}</div>
              </div>
            );
          })}
        </div>

        <Link
          to="/payment-delivery"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl bg-card/80 px-5 text-sm font-bold text-foreground transition hover:-translate-y-px hover:bg-[rgba(5,195,212,0.10)] dark:hover:bg-[#05C3D4]/10"
        >
          Подробнее о доставке и оплате
        </Link>
      </section>
    </div>
  );
}
