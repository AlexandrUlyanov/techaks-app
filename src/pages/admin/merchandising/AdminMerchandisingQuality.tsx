import { Bot, CheckCheck } from "lucide-react";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { trpc } from "@/providers/trpc";

export default function AdminMerchandisingQuality() {
  const qualityQuery = trpc.merchandising.qualityDashboard.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="AI Merchandising"
        title="Качество и покрытие"
        description="Этот экран нужен, чтобы смотреть на систему сверху: сколько бейджей реально живёт, где слабое покрытие и как проходят последние AI-прогоны."
        actions={
          <div className="inline-flex items-center gap-2 rounded-full border border-[#05C3D4]/20 bg-[#F7FEFF] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0099A8]">
            <CheckCheck size={14} />
            Контроль качества
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Всего бейджей", qualityQuery.data?.totalBadges ?? 0],
          ["Активных", qualityQuery.data?.activeBadges ?? 0],
          ["AI черновиков", qualityQuery.data?.aiDraftBadges ?? 0],
          ["Видимых на сайте", qualityQuery.data?.visibleBadges ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</div>
            <div className="mt-2 text-2xl font-black text-[#15171A]">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <AdminSection
          title="Категории с самым слабым покрытием"
          description="Это приоритетный список для следующей AI-волны: здесь бейджей мало относительно ассортимента."
        >
          <div className="space-y-3">
            {(qualityQuery.data?.lowCoverageCategories ?? []).map(item => (
              <div key={item.categoryId} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/60 px-4 py-3 text-sm">
                <div>
                  <div className="font-bold text-[#15171A]">{item.categoryName}</div>
                  <div className="text-xs text-gray-500">
                    Товаров: {item.productCount}, размечено: {item.assignedProductCount}
                  </div>
                </div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                  {item.coveragePercent}%
                </span>
              </div>
            ))}
          </div>
        </AdminSection>

        <AdminSection
          title="Последние AI-прогоны"
          description="Быстрый operational взгляд на недавние генерации: модель, prompt version и финальный статус."
          tone="subtle"
        >
          <div className="space-y-3">
            {(qualityQuery.data?.recentRuns ?? []).map(run => (
              <div key={run.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                <div>
                  <div className="font-bold text-[#15171A]">
                    {run.runType} / #{run.id}
                  </div>
                  <div className="text-xs text-gray-500">
                    {run.model} • {String(run.promptVersion || "v1")}
                  </div>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-black uppercase ${
                    run.status === "success"
                      ? "bg-emerald-50 text-emerald-700"
                      : run.status === "error"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-cyan-50 text-cyan-700"
                  }`}
                >
                  {run.status}
                </span>
              </div>
            ))}
          </div>
        </AdminSection>
      </div>

      <AdminSection
        title="Как читать этот экран"
        description="Короткая operational шпаргалка для команды."
        tone="accent"
      >
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Норма", "Активных бейджей достаточно, доля черновиков не разрастается, а low coverage не выглядит критично."],
            ["Требует внимания", "Есть категории с большим ассортиментом и очень низким покрытием, а AI-прогонов давно не было."],
            ["Плохой сигнал", "Прогоны часто падают в error или черновики копятся без review — значит процесс застопорился."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-xl border border-[#05C3D4]/10 bg-white p-4">
              <div className="flex items-center gap-2 text-sm font-black text-[#15171A]">
                <Bot size={16} className="text-[#05C3D4]" />
                {title}
              </div>
              <div className="mt-2 text-sm leading-6 text-gray-500">{text}</div>
            </div>
          ))}
        </div>
      </AdminSection>
    </div>
  );
}
