import { Loader2, RefreshCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AdminSearchSettingsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.search.getSettings.useQuery();
  const [form, setForm] = useState({
    includeDescription: true,
    includeAttributes: true,
    includeArticles: true,
    includeSku: true,
    includeBarcodes: true,
    includePages: true,
    showOutOfStock: true,
    showZeroPrice: false,
    showInactive: false,
    fullReindexBatchSize: 250,
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const saveMutation = trpc.search.saveSettings.useMutation({
    onSuccess: () => {
      utils.search.getSettings.invalidate();
      toast.success("Настройки поиска сохранены");
    },
  });
  const reindexMutation = trpc.search.reindex.useMutation({
    onSuccess: result => {
      toast.success(
        `Индекс пересобран. Товаров: ${result.counts.product}, категорий: ${result.counts.category}, страниц: ${result.counts.page}.`
      );
    },
  });

  const toggle = (key: keyof typeof form) => (checked: boolean) =>
    setForm(current => ({ ...current, [key]: checked }));

  if (isLoading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--tech-color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-[var(--tech-radius-card)] border border-border bg-card p-6 shadow-[var(--tech-shadow-card)]">
      <div className="grid gap-4 md:grid-cols-2">
        {[
          ["includeDescription", "Искать по описанию"],
          ["includeAttributes", "Искать по характеристикам"],
          ["includeArticles", "Искать по артикулам"],
          ["includeSku", "Искать по SKU"],
          ["includeBarcodes", "Искать по штрихкодам"],
          ["includePages", "Искать по CMS-страницам"],
          ["showOutOfStock", "Показывать товары без наличия"],
          ["showZeroPrice", "Показывать товары с нулевой ценой"],
          ["showInactive", "Показывать неактивные товары"],
        ].map(([key, label]) => (
          <label
            key={key}
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
          >
            <Checkbox
              checked={Boolean(form[key as keyof typeof form])}
              onCheckedChange={value => toggle(key as keyof typeof form)(Boolean(value))}
            />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </label>
        ))}
      </div>

      <div className="max-w-xs space-y-2">
        <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">
          Размер batch для полного reindex
        </div>
        <Input
          type="number"
          min={50}
          max={1000}
          value={form.fullReindexBatchSize}
          onChange={event =>
            setForm(current => ({
              ...current,
              fullReindexBatchSize: Number(event.target.value || 250),
            }))
          }
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="animate-spin" /> : <Save />}
          Сохранить
        </Button>
        <Button
          variant="outline"
          onClick={() => reindexMutation.mutate({ entityTypes: ["product", "category", "page"] })}
          disabled={reindexMutation.isPending}
        >
          {reindexMutation.isPending ? <Loader2 className="animate-spin" /> : <RefreshCcw />}
          Пересобрать весь индекс
        </Button>
        <Button
          variant="outline"
          onClick={() => reindexMutation.mutate({ entityTypes: ["product"] })}
          disabled={reindexMutation.isPending}
        >
          Пересобрать товары
        </Button>
        <Button
          variant="outline"
          onClick={() => reindexMutation.mutate({ entityTypes: ["page"] })}
          disabled={reindexMutation.isPending}
        >
          Пересобрать страницы
        </Button>
      </div>
    </div>
  );
}
