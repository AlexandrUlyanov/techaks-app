import { Link } from "react-router";

const DELIVERY_ITEMS = [
  {
    title: "Самовывоз из магазина",
    text: "После подтверждения заказа товар можно забрать в ближайшем магазине ТЕХАКС.",
  },
  {
    title: "Курьерская доставка",
    text: "Доставка по городу доступна после подтверждения менеджером и уточнения адреса.",
  },
  {
    title: "Доставка транспортной компанией",
    text: "Отправляем заказы по России удобной транспортной компанией или службой доставки.",
  },
  {
    title: "Оплата",
    text: "Доступна оплата наличными, картой и при получении в зависимости от способа получения заказа.",
  },
];

export default function ProductDeliveryTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
          Доставка и оплата
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
          Условия получения и оплаты заказа. Этот блок подготовлен так, чтобы позже брать тексты из настроек сайта без переделки интерфейса.
        </p>
      </div>

      <div className="space-y-0">
        {DELIVERY_ITEMS.map((item, index) => (
          <div key={item.title} className={`py-4 ${index > 0 ? "border-t border-[var(--tech-color-border)]/55" : ""}`}>
            <div className="text-base font-semibold text-[var(--tech-color-text-main)]">{item.title}</div>
            <div className="mt-2 text-sm leading-6 text-[var(--tech-color-text-muted)]">{item.text}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/payment-delivery"
          className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--tech-color-surface-muted)] px-5 text-sm font-semibold text-[var(--tech-color-text-main)] transition hover:brightness-95"
        >
          Подробнее о доставке и оплате
        </Link>
      </div>
    </div>
  );
}
