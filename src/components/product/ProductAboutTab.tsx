import { Bolt, Cpu, ShieldCheck, Sparkles, Wifi } from "lucide-react";
import { useState } from "react";

const benefitIcons = [Bolt, Wifi, Cpu, ShieldCheck, Sparkles];

export default function ProductAboutTab({
  description,
  quickSpecs,
  benefits,
  mobile = false,
}: {
  description: string;
  quickSpecs: Array<[string, unknown]>;
  benefits?: string[];
  mobile?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const normalizedDescription = description.trim();
  const visibleBenefits = (benefits ?? []).filter(Boolean).slice(0, 4);
  const visibleSpecs = quickSpecs.slice(0, 6);

  if (mobile) {
    const shouldTruncate = normalizedDescription.length > 220;
    const shownDescription =
      expanded || !shouldTruncate
        ? normalizedDescription
        : `${normalizedDescription.slice(0, 220).trimEnd()}...`;

    return (
      <div className="space-y-4 text-foreground">
        <div>
          <h2 className="text-xl font-black tracking-tight">О товаре</h2>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            {normalizedDescription
              ? shownDescription
              : "Описание товара пока не добавлено. Ниже доступны характеристики, наличие и способы получения."}
          </p>
          {normalizedDescription && shouldTruncate ? (
            <button
              type="button"
              onClick={() => setExpanded(prev => !prev)}
              className="mt-3 text-sm font-bold text-[#05C3D4]"
            >
              {expanded ? "Скрыть описание" : "Показать полностью"}
            </button>
          ) : null}
        </div>

        {visibleSpecs.length > 0 ? (
          <div className="grid gap-2">
            {visibleSpecs.slice(0, 4).map(([key, value]) => (
              <div key={key} className="text-[14px] leading-6 text-foreground">
                <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                <span className="font-semibold">{String(value)}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-8 text-foreground">
      <div className="max-w-4xl">
        <div className="text-sm font-bold uppercase tracking-[0.18em] text-[#05C3D4]">
          О товаре
        </div>
        <h2 className="mt-3 text-2xl font-black tracking-tight md:text-3xl">
          Ключевая информация о модели
        </h2>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground md:text-base md:leading-8">
          {normalizedDescription ||
            "Описание товара пока не добавлено. Ниже доступны характеристики, наличие и способы получения."}
        </p>
      </div>

      {visibleBenefits.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {visibleBenefits.map((benefit, index) => {
            const Icon = benefitIcons[index % benefitIcons.length];
            return (
              <div
                key={benefit}
                className="rounded-[1.25rem] bg-muted/60 p-[18px] transition-[background,transform] duration-200 ease-out hover:-translate-y-[2px] hover:bg-[rgba(5,195,212,0.08)] dark:hover:bg-[#05C3D4]/10"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
                  <Icon size={20} />
                </div>
                <div className="mt-4 text-sm font-bold leading-6 text-foreground">
                  {benefit}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        {visibleSpecs.length > 0 ? (
          <section className="rounded-[1.4rem] bg-muted/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">
                  Основные параметры
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Самое важное, чтобы быстро понять товар.
                </p>
              </div>
              <span className="inline-flex rounded-full bg-[rgba(5,195,212,0.1)] px-3 py-2 text-xs font-bold text-[#047E8A]">
                {visibleSpecs.length} пунктов
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {visibleSpecs.map(([key, value]) => (
                <div key={key} className="rounded-[1rem] bg-card/80 px-4 py-3">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    {key}
                  </div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-foreground">
                    {String(value)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {visibleBenefits.length > 0 ? (
          <section className="rounded-[1.4rem] bg-muted/60 p-5">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(5,195,212,0.12)] text-[#05C3D4]">
              <Sparkles size={20} />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-foreground">
              Почему стоит выбрать
            </h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Несколько причин, почему эта модель хорошо впишется в повседневный сценарий.
            </p>

            <div className="mt-4 space-y-3">
              {visibleBenefits.map(item => (
                <div
                  key={item}
                  className="rounded-[1rem] bg-card/80 px-4 py-3 text-sm font-semibold text-foreground"
                >
                  {item}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
