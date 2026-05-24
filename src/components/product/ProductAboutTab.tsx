export default function ProductAboutTab({
  description,
  quickSpecs,
  benefits,
}: {
  description: string;
  quickSpecs: Array<[string, unknown]>;
  benefits?: string[];
}) {
  const normalizedDescription = description.trim();
  const visibleBenefits = (benefits ?? []).filter(Boolean).slice(0, 4);
  const visibleSpecs = quickSpecs.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-[#1F2328] md:text-3xl">
          О товаре
        </h2>
        <p className="mt-4 max-w-4xl text-[15px] leading-7 text-[#464A50] md:text-base md:leading-8">
          {normalizedDescription ||
            "Описание товара пока не добавлено. Ниже доступны характеристики, наличие и способы получения."}
        </p>
      </div>

      {visibleBenefits.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {visibleBenefits.map(benefit => (
            <div
              key={benefit}
              className="rounded-2xl bg-[#F6F7F8] px-4 py-3 text-sm font-semibold text-[#1F2328]"
            >
              {benefit}
            </div>
          ))}
        </div>
      ) : null}

      {visibleSpecs.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-black uppercase tracking-[0.16em] text-[#7A7F87]">
            Ключевые характеристики
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleSpecs.map(([key, value]) => (
              <div key={key} className="rounded-2xl bg-[#F6F7F8] px-4 py-3">
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[#7A7F87]">
                  {key}
                </div>
                <div className="mt-2 text-sm font-semibold text-[#1F2328]">
                  {String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
