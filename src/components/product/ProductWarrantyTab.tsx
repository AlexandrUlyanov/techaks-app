import { Link } from "react-router";

export default function ProductWarrantyTab({
  manufacturerName,
}: {
  manufacturerName?: string | null;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-[var(--tech-color-text-main)] md:text-3xl">
          Гарантия
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
          Мы рекомендуем проверять внешний вид, комплектацию и работоспособность товара при получении.
        </p>
      </div>

      <div className="space-y-0">
        {[
          {
            title: "Гарантия магазина",
            text: "ТЕХАКС помогает с гарантийным обслуживанием и консультацией по дальнейшим действиям при возникновении вопросов к товару.",
          },
          {
            title: "Гарантия производителя",
            text: manufacturerName
              ? `Если для бренда ${manufacturerName} действует официальная гарантия производителя, она сохраняется при наличии подтверждающих документов.`
              : "Если для товара действует официальная гарантия производителя, она сохраняется при наличии подтверждающих документов.",
          },
          {
            title: "Возврат и обмен",
            text: "Условия возврата и обмена зависят от категории товара, состояния упаковки и факта использования товара после покупки.",
          },
          {
            title: "Проверка при получении",
            text: "При самовывозе и доставке можно проверить комплектность, внешний вид и базовую работоспособность товара перед подтверждением получения.",
          },
        ].map((item, index) => (
          <div key={item.title} className={`py-4 ${index > 0 ? "border-t border-[var(--tech-color-border)]/55" : ""}`}>
            <div className="text-base font-semibold text-[var(--tech-color-text-main)]">{item.title}</div>
            <div className="mt-2 text-sm leading-6 text-[var(--tech-color-text-muted)]">{item.text}</div>
          </div>
        ))}
      </div>

      <Link
        to="/returns"
        className="inline-flex h-11 items-center justify-center rounded-xl bg-[var(--tech-color-surface-muted)] px-5 text-sm font-semibold text-[var(--tech-color-text-main)] transition hover:brightness-95"
      >
        Возврат и обмен
      </Link>
    </div>
  );
}
