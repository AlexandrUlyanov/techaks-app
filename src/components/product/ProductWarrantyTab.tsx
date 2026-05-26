import { Link } from "react-router";
import { BadgeCheck, RefreshCcw, ShieldCheck, ShieldPlus } from "lucide-react";

export default function ProductWarrantyTab({
  manufacturerName,
  mobile = false,
}: {
  manufacturerName?: string | null;
  mobile?: boolean;
}) {
  const items = [
    {
      icon: ShieldCheck,
      title: "Официальная гарантия",
      text: "Гарантия магазина и сопровождение по гарантийному обращению на всём пути.",
    },
    {
      icon: ShieldPlus,
      title: "Гарантия производителя",
      text: manufacturerName
        ? `Если для бренда ${manufacturerName} действует официальная гарантия производителя, она сохраняется при наличии подтверждающих документов.`
        : "Если для товара действует официальная гарантия производителя, она сохраняется при наличии подтверждающих документов.",
    },
    {
      icon: RefreshCcw,
      title: "Возврат и обмен",
      text: "Условия возврата и обмена зависят от категории товара, состояния упаковки и факта использования после покупки.",
    },
    {
      icon: BadgeCheck,
      title: "Проверка при получении",
      text: "При самовывозе и доставке можно проверить комплектность, внешний вид и базовую работоспособность товара.",
    },
  ];

  if (mobile) {
    return (
      <div className="space-y-4 text-[#20262E]">
        <div>
          <h2 className="text-xl font-black tracking-tight">Гарантия</h2>
          <p className="mt-2 text-sm leading-6 text-[#6B7280]">
            Коротко о гарантии, проверке товара и условиях возврата.
          </p>
        </div>

        <div className="space-y-3">
          {items.map(item => (
            <div key={item.title} className="rounded-[1.1rem] bg-[#F8FAFC] px-4 py-4">
              <div className="text-sm font-bold text-[#20262E]">{item.title}</div>
              <div className="mt-1 text-sm leading-6 text-[#6B7280]">{item.text}</div>
            </div>
          ))}
        </div>

        <Link to="/returns" className="inline-flex text-sm font-bold text-[#05C3D4]">
          Возврат и обмен
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-[#20262E]">
      <div className="max-w-3xl">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
          Гарантия
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
          Поддержка и защита покупки
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#6B7280]">
          Мы рекомендуем проверять внешний вид, комплектацию и работоспособность товара при получении.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <article
              key={item.title}
              className="rounded-[1.4rem] bg-[#F8FAFC] p-5 transition-[background,transform] duration-200 ease-out hover:-translate-y-[2px] hover:bg-[rgba(5,195,212,0.07)]"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                <Icon size={22} />
              </div>
              <h3 className="mt-4 text-lg font-extrabold text-[#20262E]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[#6B7280]">{item.text}</p>
            </article>
          );
        })}
      </div>

      <Link
        to="/returns"
        className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#F1F5F9] px-5 text-sm font-bold text-[#20262E] transition hover:-translate-y-px hover:bg-[rgba(5,195,212,0.10)]"
      >
        Возврат и обмен
      </Link>
    </div>
  );
}
