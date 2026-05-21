import { defaultDesignTheme, type DesignTheme } from "@contracts/design-system";
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MonitorCog,
  Package,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  ShoppingCart,
  Sparkles,
  TableProperties,
  Type,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import AdminSection from "@/components/admin/AdminSection";
import { AdminCard } from "@/components/ui/admin-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Price } from "@/components/ui/price";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { applyThemeToElement } from "@/design-system/theme-runtime";
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";
import { useAbility } from "@/providers/AbilityProvider";
import { toast } from "sonner";

type ThemeSection = keyof DesignTheme;

const TAB_LABELS = [
  { key: "overview", label: "Обзор", icon: MonitorCog },
  { key: "colors", label: "Цвета", icon: Palette },
  { key: "typography", label: "Типографика", icon: Type },
  { key: "buttons", label: "Кнопки", icon: ShoppingCart },
  { key: "forms", label: "Формы", icon: Check },
  { key: "product-cards", label: "Карточки товаров", icon: Package },
  { key: "orders", label: "Заказы", icon: LayoutGrid },
  { key: "tables", label: "Таблицы", icon: TableProperties },
  { key: "notifications", label: "Уведомления", icon: Bell },
  { key: "icons", label: "Иконки", icon: Sparkles },
  { key: "theme", label: "Тема сайта", icon: Palette },
  { key: "history", label: "История изменений", icon: History },
] as const;

const iconShowcase = [
  ShoppingCart,
  Package,
  Bell,
  TableProperties,
  Search,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ImageIcon,
  Sparkles,
];

const sampleProducts = [
  {
    id: 9001,
    slug: "design-system-primary-card",
    name: "Автодержатель HOCO H72 с беспроводной зарядкой",
    price: 1990,
    oldPrice: 2490,
    badge: "Новинка",
    merchandisingBadges: ["top", "excellent_price"],
    image: "/images/nofoto.jpg",
    categoryId: 1,
    inStock: true,
    rating: "4.8",
    reviewCount: 18,
  },
  {
    id: 9002,
    slug: "design-system-discount-card",
    name: "Кабель USB-C HOCO X83 1 метр",
    price: 390,
    oldPrice: 590,
    badge: "Акция",
    merchandisingBadges: ["new"],
    image: "/images/nofoto.jpg",
    categoryId: 1,
    inStock: true,
    rating: "4.6",
    reviewCount: 7,
  },
  {
    id: 9003,
    slug: "design-system-out-of-stock-card",
    name: "Портативная колонка Baseus AeQur",
    price: 5990,
    image: "/images/nofoto.jpg",
    categoryId: 1,
    inStock: false,
    rating: "0",
    reviewCount: 0,
  },
];

const sampleRows = [
  {
    orderNumber: "TA-2048",
    customer: "Ирина Зотова",
    phone: "+7 (927) 111-22-33",
    status: "confirmed" as const,
    syncStatus: "synced" as const,
    total: 7890,
  },
  {
    orderNumber: "TA-2049",
    customer: "Максим Поляков",
    phone: "+7 (927) 444-55-66",
    status: "awaiting_payment" as const,
    syncStatus: "sync_error" as const,
    total: 3290,
  },
];

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function cloneTheme(theme: DesignTheme) {
  return JSON.parse(JSON.stringify(theme)) as DesignTheme;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-[var(--tech-radius-input)] border border-border bg-card px-3 py-2">
        <input
          type="color"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-10 w-12 cursor-pointer rounded-md border border-border bg-transparent"
          aria-label={label}
        />
        <Input value={value} onChange={e => onChange(e.target.value.toUpperCase())} />
      </div>
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e =>
            onChange(
              Math.min(max, Math.max(min, Number(e.target.value) || min))
            )
          }
        />
        {suffix ? <span className="text-sm text-[var(--tech-color-text-muted)]">{suffix}</span> : null}
      </div>
    </label>
  );
}

function ThemeCanvas({
  theme,
  children,
  className,
}: {
  theme: DesignTheme;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    applyThemeToElement(ref.current, theme);
  }, [theme]);

  return (
    <div
      ref={ref}
      className={cn(
        "rounded-[var(--tech-radius-card)] bg-[var(--tech-color-background)] text-[var(--tech-color-text-main)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export default function AdminDesignSystem() {
  const utils = trpc.useUtils();
  const ability = useAbility();
  const canEdit = ability.can("update", "DesignSystem");
  const canPublish = ability.can("publish", "DesignSystem");
  const canRollback = ability.can("rollback", "DesignSystem");

  const { data, isLoading } = trpc.designSystem.getAdminState.useQuery();
  const saveDraftMutation = trpc.designSystem.saveDraft.useMutation({
    onSuccess: () => {
      utils.designSystem.getAdminState.invalidate();
      utils.designSystem.getPublishedTheme.invalidate();
      toast.success("Черновик темы сохранён");
    },
  });
  const publishMutation = trpc.designSystem.publishDraft.useMutation({
    onSuccess: result => {
      utils.designSystem.getAdminState.invalidate();
      utils.designSystem.getPublishedTheme.invalidate();
      toast.success(`Тема опубликована. Версия ${result.versionNumber}`);
      setPreviewEnabled(false);
      setChangeNote("");
    },
  });
  const resetDraftMutation = trpc.designSystem.resetDraft.useMutation({
    onSuccess: payload => {
      setTheme(cloneTheme(payload.draftTheme));
      utils.designSystem.getAdminState.invalidate();
      toast.success("Черновик сброшен к стандартной теме");
    },
  });
  const rollbackMutation = trpc.designSystem.rollbackVersion.useMutation({
    onSuccess: result => {
      utils.designSystem.getAdminState.invalidate();
      utils.designSystem.getPublishedTheme.invalidate();
      toast.success(`Откат выполнен. Новая версия ${result.versionNumber}`);
    },
  });

  const [theme, setTheme] = useState<DesignTheme>(cloneTheme(defaultDesignTheme));
  const [activeTab, setActiveTab] = useState<(typeof TAB_LABELS)[number]["key"]>("overview");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!data?.draftTheme) return;
    setTheme(cloneTheme(data.draftTheme));
  }, [data?.draftTheme]);

  useEffect(() => {
    if (typeof document === "undefined" || !data?.publishedTheme) return;
    applyThemeToElement(
      document.documentElement,
      previewEnabled ? theme : data.publishedTheme
    );

    return () => {
      applyThemeToElement(document.documentElement, data.publishedTheme);
    };
  }, [data?.publishedTheme, previewEnabled, theme]);

  const hasUnsavedChanges = useMemo(() => {
    if (!data?.draftTheme) return false;
    return JSON.stringify(theme) !== JSON.stringify(data.draftTheme);
  }, [data?.draftTheme, theme]);

  const updateThemeSection = <K extends ThemeSection, F extends keyof DesignTheme[K]>(
    section: K,
    field: F,
    value: DesignTheme[K][F]
  ) => {
    setTheme(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({ theme });
  };

  const handlePublish = async () => {
    try {
      if (hasUnsavedChanges) {
        await saveDraftMutation.mutateAsync({ theme });
      }
      await publishMutation.mutateAsync({ changeNote });
    } catch {
      // Mutation surfaces the toast/error state for us.
    }
  };

  const handlePreviewToggle = () => {
    setPreviewEnabled(prev => !prev);
    toast.info(previewEnabled ? "Предпросмотр выключен" : "Предпросмотр включён");
  };

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-[var(--tech-color-primary)]" size={40} />
      </div>
    );
  }

  const orderStatusCards = (
    <div className="grid gap-4 md:grid-cols-3">
      <AdminCard title="Новый заказ">
        <div className="space-y-3">
          <StatusBadge status="new" />
          <StatusBadge status="processing" />
          <StatusBadge status="confirmed" />
        </div>
      </AdminCard>
      <AdminCard title="Оплата и выдача">
        <div className="space-y-3">
          <StatusBadge status="awaiting_payment" />
          <StatusBadge status="paid" />
          <StatusBadge status="reserved" />
        </div>
      </AdminCard>
      <AdminCard title="Синхронизация">
        <div className="space-y-3">
          <StatusBadge status="synced" />
          <StatusBadge status="sync_error" />
          <StatusBadge status="cancelled" />
        </div>
      </AdminCard>
    </div>
  );

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Единый источник правды"
        title="UI-гайдлайн и дизайн-система"
        description="Здесь собраны дизайн-токены, живые компоненты сайта и контур управления темой. Меняем токены один раз, а сайт и админка подхватывают тему через CSS variables."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.publishedTheme.meta.name}</Badge>
            <Badge variant="outline">
              История: {data.history.length} {data.history.length === 1 ? "версия" : "версий"}
            </Badge>
            {hasUnsavedChanges ? (
              <Badge className="border-transparent bg-[color:color-mix(in_srgb,var(--tech-color-warning)_16%,white)] text-[var(--tech-color-warning)]">
                Есть несохранённые изменения
              </Badge>
            ) : null}
          </div>
        }
        actions={
          <>
            <Button variant="outline" onClick={handlePreviewToggle}>
              <MonitorCog size={16} />
              {previewEnabled ? "Выключить предпросмотр" : "Предпросмотр"}
            </Button>
            <Button
              variant="outline"
              onClick={() => resetDraftMutation.mutate()}
              disabled={!canEdit || resetDraftMutation.isPending}
            >
              <RotateCcw size={16} />
              Сбросить к стандартной теме
            </Button>
            <Button
              variant="secondary"
              onClick={handleSaveDraft}
              disabled={!canEdit || saveDraftMutation.isPending}
            >
              {saveDraftMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Сохранить черновик
            </Button>
            <Button
              onClick={handlePublish}
              disabled={!canPublish || publishMutation.isPending}
            >
              {publishMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              Опубликовать
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <AdminSection
            title="Рабочее полотно темы"
            description="Предпросмотр крутится на реальных компонентах. То, что видим здесь, использует те же токены, что и витрина."
            tone="accent"
          >
            <ThemeCanvas
              theme={previewEnabled ? theme : data.publishedTheme}
              className="space-y-6 p-6"
            >
              <Tabs value={activeTab} onValueChange={value => setActiveTab(value as typeof activeTab)}>
                <TabsList className="h-auto w-full flex-wrap justify-start rounded-[var(--tech-radius-card)] bg-[var(--tech-color-surface-muted)] p-2">
                  {TAB_LABELS.map(tab => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.key}
                        value={tab.key}
                        className="min-h-11 min-w-fit rounded-[var(--tech-radius-button)] px-4"
                      >
                        <Icon size={15} />
                        {tab.label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="overview" className="space-y-6 pt-4">
                  <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <AdminCard title="Бренд" description="Логотип, фавикон и цветовая ось Техакс.">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-white p-5">
                          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--tech-color-text-muted)]">
                            Логотип
                          </div>
                          <img
                            src="/images/logo-color.svg"
                            alt="Логотип Техакс"
                            className="h-12 object-contain"
                          />
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-white p-5">
                          <div className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--tech-color-text-muted)]">
                            Фавикон
                          </div>
                          <img
                            src="/favicon.png"
                            alt="Фавикон Техакс"
                            className="h-12 w-12 rounded-xl object-contain"
                          />
                        </div>
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                          ["Primary", theme.colors.primary],
                          ["Brand Dark", theme.colors.brandDark],
                          ["Text", theme.colors.textMain],
                          ["Background", theme.colors.background],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4"
                          >
                            <div className="mb-3 h-14 rounded-[calc(var(--tech-radius-card)-6px)] border border-black/5" style={{ backgroundColor: value }} />
                            <div className="text-sm font-black">{label}</div>
                            <div className="text-xs text-[var(--tech-color-text-muted)]">{value}</div>
                          </div>
                        ))}
                      </div>
                    </AdminCard>
                    <AdminCard title="Тема сайта" description="Короткий срез текущей опубликованной и черновой темы.">
                      <div className="space-y-4 text-sm">
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                            Опубликовано
                          </div>
                          <div className="mt-2 font-black text-[var(--tech-color-text-main)]">
                            {data.publishedTheme.meta.name}
                          </div>
                          <div className="mt-1 text-[var(--tech-color-text-muted)]">
                            {data.publishedTheme.meta.description || "Без описания"}
                          </div>
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                            Черновик
                          </div>
                          <div className="mt-2 font-black text-[var(--tech-color-text-main)]">
                            {theme.meta.name}
                          </div>
                          <div className="mt-1 text-[var(--tech-color-text-muted)]">
                            {theme.meta.description || "Без описания"}
                          </div>
                        </div>
                        <Textarea
                          value={changeNote}
                          onChange={e => setChangeNote(e.target.value)}
                          placeholder="Коротко: что именно изменили в теме"
                          rows={4}
                        />
                      </div>
                    </AdminCard>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-3">
                    <AdminCard title="Primary CTA">
                      <div className="space-y-3">
                        <Button className="w-full">В корзину</Button>
                        <Button variant="secondary" className="w-full">
                          Купить в 1 клик
                        </Button>
                        <Button variant="outline" className="w-full">
                          Зарезервировать
                        </Button>
                      </div>
                    </AdminCard>
                    <AdminCard title="Тексты">
                      <h1>Техника и аксессуары для вашего устройства</h1>
                      <p className="mt-3 text-[var(--tech-color-text-muted)]">
                        Единый источник правды для компонентов, статусов, карточек товаров и админского интерфейса.
                      </p>
                    </AdminCard>
                    <AdminCard title="Статусы">
                      <div className="flex flex-wrap gap-2">
                        <Badge>Новинка</Badge>
                        <StatusBadge status="confirmed" />
                        <StatusBadge status="sync_error" />
                        <StatusBadge status="reserved" />
                      </div>
                    </AdminCard>
                  </div>
                </TabsContent>

                <TabsContent value="colors" className="space-y-6 pt-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Object.entries(theme.colors).map(([key, value]) => (
                      <div
                        key={key}
                        className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4"
                      >
                        <div
                          className="mb-3 h-20 rounded-[calc(var(--tech-radius-card)-6px)] border border-black/5"
                          style={{ backgroundColor: value }}
                        />
                        <div className="text-sm font-black capitalize">{key}</div>
                        <div className="text-xs text-[var(--tech-color-text-muted)]">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminCard title="Правильное использование">
                      <div className="space-y-3">
                        <div className="rounded-[var(--tech-radius-card)] bg-[var(--tech-color-primary)] p-4 text-[var(--tech-color-primary-foreground)]">
                          Primary CTA на светлом фоне
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] bg-[var(--tech-color-brand-dark)] p-4 text-white">
                          Тёмный брендовый слой
                        </div>
                      </div>
                    </AdminCard>
                    <AdminCard title="Чего избегаем">
                      <div className="space-y-3">
                        <div className="rounded-[var(--tech-radius-card)] border border-dashed border-[var(--tech-color-danger)] p-4 text-sm text-[var(--tech-color-danger)]">
                          Не смешиваем случайные оттенки вне токенов и не используем низкий контраст текста.
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] border border-dashed border-[var(--tech-color-warning)] p-4 text-sm text-[var(--tech-color-text-main)]">
                          Не переиспользуем warning как primary-action.
                        </div>
                      </div>
                    </AdminCard>
                  </div>
                </TabsContent>

                <TabsContent value="typography" className="space-y-4 pt-4">
                  <AdminCard title="Стили текста" description="Размеры и line-height берутся из токенов темы.">
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">H1</div>
                        <h1>Техника и аксессуары для вашего устройства</h1>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">H2</div>
                        <h2>Карточка товара и покупательский сценарий</h2>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">H3</div>
                        <h3>Формы, статусы и уведомления</h3>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Body</div>
                        <p>Основной текст должен быть спокойным, понятным и хорошо читаться на светлом фоне.</p>
                      </div>
                      <div className="text-[var(--tech-color-text-muted)]" style={{ fontSize: "var(--tech-font-size-small)" }}>
                        Small text для вторичной информации и подсказок.
                      </div>
                      <div className="text-[var(--tech-color-text-muted)]" style={{ fontSize: "var(--tech-font-size-caption)" }}>
                        Caption для коротких подписей, лейблов и меток.
                      </div>
                      <Price value={12990} oldValue={14990} />
                    </div>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="buttons" className="space-y-4 pt-4">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <AdminCard title="Базовые кнопки">
                      <div className="space-y-3">
                        <Button className="w-full">В корзину</Button>
                        <Button variant="secondary" className="w-full">Купить в 1 клик</Button>
                        <Button variant="outline" className="w-full">Зарезервировать</Button>
                        <Button variant="destructive" className="w-full">Отменить резерв</Button>
                        <Button variant="ghost" className="w-full bg-[var(--tech-color-brand-dark)]">Ghost action</Button>
                      </div>
                    </AdminCard>
                    <AdminCard title="Состояния">
                      <div className="space-y-3">
                        <Button className="w-full">Default</Button>
                        <Button className="w-full" disabled>Disabled</Button>
                        <Button className="w-full">
                          <Loader2 size={16} className="animate-spin" />
                          Loading
                        </Button>
                        <Button className="w-full">
                          <CheckCircle2 size={16} />
                          Success
                        </Button>
                        <Button variant="destructive" className="w-full">
                          <XCircle size={16} />
                          Error
                        </Button>
                      </div>
                    </AdminCard>
                    <AdminCard title="Icon buttons">
                      <div className="flex flex-wrap gap-3">
                        <Button size="icon" aria-label="Корзина">
                          <ShoppingCart size={18} />
                        </Button>
                        <Button size="icon" variant="outline" aria-label="Назад">
                          <ChevronLeft size={18} />
                        </Button>
                        <Button size="icon" variant="secondary" aria-label="Вперёд">
                          <ChevronRight size={18} />
                        </Button>
                      </div>
                    </AdminCard>
                  </div>
                </TabsContent>

                <TabsContent value="forms" className="space-y-4 pt-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AdminCard title="Поля формы">
                      <div className="space-y-4">
                        <Input placeholder="Имя клиента" />
                        <Input type="tel" placeholder="+7 ___ ___-__-__" />
                        <Input type="email" placeholder="tech.aks@yandex.ru" />
                        <Input type="password" value="secret-password" readOnly />
                        <Textarea placeholder="Комментарий к заказу" rows={4} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <div className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Select</div>
                            <Select defaultValue="pickup">
                              <SelectTrigger className="w-full rounded-[var(--tech-radius-input)]">
                                <SelectValue placeholder="Выберите вариант" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pickup">Самовывоз</SelectItem>
                                <SelectItem value="delivery">Доставка</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Search input</div>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--tech-color-text-muted)]" />
                              <Input className="pl-10" placeholder="Найти заказ или товар" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </AdminCard>
                    <AdminCard title="Состояния и контролы">
                      <div className="space-y-4">
                        <Input value="Заполненное поле" readOnly />
                        <Input aria-invalid value="Ошибка валидации" readOnly />
                        <Input disabled value="Disabled state" readOnly />
                        <div className="flex items-center gap-3">
                          <Checkbox checked aria-label="Чекбокс" />
                          <span>Чекбокс выбора товара</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch checked aria-label="Переключатель темы" />
                          <span>Переключатель публикации</span>
                        </div>
                        <div className="flex items-center gap-3 rounded-[var(--tech-radius-input)] border border-dashed border-border p-4">
                          <UploadCloud className="text-[var(--tech-color-primary)]" />
                          <div>
                            <div className="font-semibold">File upload</div>
                            <div className="text-sm text-[var(--tech-color-text-muted)]">Загрузка логотипа, favicon или изображения.</div>
                          </div>
                        </div>
                        <div className="inline-flex items-center gap-3 rounded-[var(--tech-radius-input)] border border-border p-2">
                          <Button size="icon-sm" variant="outline">-</Button>
                          <span className="min-w-8 text-center font-bold">1</span>
                          <Button size="icon-sm" variant="outline">+</Button>
                        </div>
                      </div>
                    </AdminCard>
                  </div>
                </TabsContent>

                <TabsContent value="product-cards" className="space-y-4 pt-4">
                  <div className="grid gap-4 lg:grid-cols-3">
                    {sampleProducts.map(product => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                  <AdminCard title="Detail availability / reserve">
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                        <div className="text-sm font-black">пр. Строителей, 50А</div>
                        <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">Доступно: 3 шт.</div>
                        <Button className="mt-4 w-full">Зарезервировать здесь</Button>
                      </div>
                      <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                        <div className="text-sm font-black">ТЦ Застава</div>
                        <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">Нет в наличии</div>
                        <Button variant="outline" className="mt-4 w-full" disabled>
                          Нет в наличии
                        </Button>
                      </div>
                    </div>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="orders" className="space-y-4 pt-4">
                  {orderStatusCards}
                  <AdminCard title="Карточка заказа">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-black">TA-2048</span>
                          <StatusBadge status="confirmed" />
                          <StatusBadge status="synced" />
                        </div>
                        <div className="text-sm text-[var(--tech-color-text-muted)]">
                          Клиент: Ирина Зотова · +7 (927) 111-22-33
                        </div>
                        <div className="text-sm text-[var(--tech-color-text-muted)]">
                          Комментарий: Позвонить перед доставкой, удобное время после 18:00.
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-[var(--tech-color-surface-muted)] p-4">
                          <div className="font-semibold">Товары в заказе</div>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span>Кабель USB-C HOCO X83</span>
                            <span>390 ₽ × 2</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3 lg:min-w-64">
                        <Price value={7890} />
                        <Button className="w-full">Оформить заказ</Button>
                        <Button variant="outline" className="w-full">Продолжить покупки</Button>
                      </div>
                    </div>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="tables" className="space-y-4 pt-4">
                  <AdminCard title="Админская таблица">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Заказ</TableHead>
                          <TableHead>Клиент</TableHead>
                          <TableHead>Телефон</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Sync</TableHead>
                          <TableHead>Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sampleRows.map(row => (
                          <TableRow key={row.orderNumber}>
                            <TableCell className="font-black">{row.orderNumber}</TableCell>
                            <TableCell>{row.customer}</TableCell>
                            <TableCell>{row.phone}</TableCell>
                            <TableCell><StatusBadge status={row.status} /></TableCell>
                            <TableCell><StatusBadge status={row.syncStatus} /></TableCell>
                            <TableCell>{new Intl.NumberFormat("ru-RU").format(row.total)} ₽</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="notifications" className="space-y-4 pt-4">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AdminCard title="Toast notifications">
                      <div className="flex flex-wrap gap-3">
                        <Button onClick={() => toast.success("Товар успешно сохранён")}>Success toast</Button>
                        <Button variant="destructive" onClick={() => toast.error("Ошибка синхронизации с МойСклад")}>
                          Error toast
                        </Button>
                        <Button variant="outline" onClick={() => toast.warning("Изменения сохранены как черновик")}>
                          Warning toast
                        </Button>
                        <Button variant="secondary" onClick={() => toast.info("Изменения UI-гайдлайна применены")}>
                          Info toast
                        </Button>
                      </div>
                    </AdminCard>
                    <AdminCard title="Inline alerts">
                      <div className="space-y-3">
                        <div className="rounded-[var(--tech-radius-card)] border border-[color:color-mix(in_srgb,var(--tech-color-success)_30%,white)] bg-[color:color-mix(in_srgb,var(--tech-color-success)_10%,white)] p-4 text-sm text-[var(--tech-color-success)]">
                          Товар успешно сохранён
                        </div>
                        <div className="rounded-[var(--tech-radius-card)] border border-[color:color-mix(in_srgb,var(--tech-color-danger)_30%,white)] bg-[color:color-mix(in_srgb,var(--tech-color-danger)_10%,white)] p-4 text-sm text-[var(--tech-color-danger)]">
                          Ошибка синхронизации с МойСклад
                        </div>
                      </div>
                    </AdminCard>
                  </div>

                  <AdminCard title="Модальные окна">
                    <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Открыть confirmation dialog</Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-[var(--tech-radius-modal)] p-6 shadow-[var(--tech-shadow-modal)]">
                        <DialogHeader>
                          <DialogTitle>Подтвердить публикацию темы</DialogTitle>
                          <DialogDescription>
                            После публикации дизайн-токены применятся на сайте и в админке.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button>
                          <Button onClick={() => setModalOpen(false)}>Подтвердить</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="icons" className="space-y-4 pt-4">
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    {iconShowcase.map(Icon => (
                      <AdminCard key={Icon.displayName || Icon.name}>
                        <div className="flex h-28 flex-col items-center justify-center gap-3 rounded-[var(--tech-radius-card)] border border-border bg-card">
                          <div className="flex h-12 w-12 items-center justify-center rounded-[var(--tech-radius-button)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]">
                            <Icon size={20} />
                          </div>
                          <div className="text-xs font-bold text-[var(--tech-color-text-muted)]">
                            {Icon.displayName || Icon.name}
                          </div>
                        </div>
                      </AdminCard>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="theme" className="space-y-6 pt-4">
                  <AdminCard title="Тема сайта" description="Редактируем черновик. Сохраняем отдельно, публикуем осознанно.">
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Название темы</span>
                          <Input
                            value={theme.meta.name}
                            onChange={e => updateThemeSection("meta", "name", e.target.value)}
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Описание</span>
                          <Input
                            value={theme.meta.description}
                            onChange={e => updateThemeSection("meta", "description", e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <ColorField label="Primary" value={theme.colors.primary} onChange={value => updateThemeSection("colors", "primary", value)} />
                        <ColorField label="Brand Dark" value={theme.colors.brandDark} onChange={value => updateThemeSection("colors", "brandDark", value)} />
                        <ColorField label="Background" value={theme.colors.background} onChange={value => updateThemeSection("colors", "background", value)} />
                        <ColorField label="Surface" value={theme.colors.surface} onChange={value => updateThemeSection("colors", "surface", value)} />
                        <ColorField label="Surface Muted" value={theme.colors.surfaceMuted} onChange={value => updateThemeSection("colors", "surfaceMuted", value)} />
                        <ColorField label="Text Main" value={theme.colors.textMain} onChange={value => updateThemeSection("colors", "textMain", value)} />
                        <ColorField label="Text Muted" value={theme.colors.textMuted} onChange={value => updateThemeSection("colors", "textMuted", value)} />
                        <ColorField label="Border" value={theme.colors.border} onChange={value => updateThemeSection("colors", "border", value)} />
                        <ColorField label="Success" value={theme.colors.success} onChange={value => updateThemeSection("colors", "success", value)} />
                        <ColorField label="Warning" value={theme.colors.warning} onChange={value => updateThemeSection("colors", "warning", value)} />
                        <ColorField label="Danger" value={theme.colors.danger} onChange={value => updateThemeSection("colors", "danger", value)} />
                        <ColorField label="Info" value={theme.colors.info} onChange={value => updateThemeSection("colors", "info", value)} />
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <NumberField label="Радиус кнопок" value={theme.radii.button} min={0} max={40} suffix="px" onChange={value => updateThemeSection("radii", "button", value)} />
                        <NumberField label="Радиус карточек" value={theme.radii.card} min={0} max={40} suffix="px" onChange={value => updateThemeSection("radii", "card", value)} />
                        <NumberField label="Радиус input" value={theme.radii.input} min={0} max={40} suffix="px" onChange={value => updateThemeSection("radii", "input", value)} />
                        <NumberField label="Радиус модалок" value={theme.radii.modal} min={0} max={48} suffix="px" onChange={value => updateThemeSection("radii", "modal", value)} />
                        <NumberField label="H1" value={theme.typography.h1Size} min={24} max={72} suffix="px" onChange={value => updateThemeSection("typography", "h1Size", value)} />
                        <NumberField label="H2" value={theme.typography.h2Size} min={20} max={56} suffix="px" onChange={value => updateThemeSection("typography", "h2Size", value)} />
                        <NumberField label="H3" value={theme.typography.h3Size} min={18} max={40} suffix="px" onChange={value => updateThemeSection("typography", "h3Size", value)} />
                        <NumberField label="Body" value={theme.typography.bodySize} min={14} max={24} suffix="px" onChange={value => updateThemeSection("typography", "bodySize", value)} />
                        <NumberField label="Высота кнопки" value={theme.controls.buttonHeight} min={36} max={72} suffix="px" onChange={value => updateThemeSection("controls", "buttonHeight", value)} />
                        <NumberField label="Высота input" value={theme.controls.inputHeight} min={36} max={72} suffix="px" onChange={value => updateThemeSection("controls", "inputHeight", value)} />
                        <NumberField label="Icon button" value={theme.controls.iconButtonSize} min={32} max={72} suffix="px" onChange={value => updateThemeSection("controls", "iconButtonSize", value)} />
                        <label className="space-y-2 md:col-span-2 xl:col-span-1">
                          <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Базовый шрифт</span>
                          <Input
                            value={theme.typography.fontFamily}
                            onChange={e => updateThemeSection("typography", "fontFamily", e.target.value)}
                          />
                        </label>
                      </div>
                    </div>
                  </AdminCard>
                </TabsContent>

                <TabsContent value="history" className="space-y-4 pt-4">
                  <AdminCard title="История изменений" description="Показываем, кто менял тему, когда и что именно публиковали.">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Версия</TableHead>
                          <TableHead>Действие</TableHead>
                          <TableHead>Кто</TableHead>
                          <TableHead>Когда</TableHead>
                          <TableHead>Что изменили</TableHead>
                          <TableHead>Действия</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.history.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-black">v{entry.versionNumber}</TableCell>
                            <TableCell>
                              <Badge variant={entry.actionType === "rollback" ? "outline" : "secondary"}>
                                {entry.actionType === "rollback" ? "Откат" : "Публикация"}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.changedByDisplayName || "Система"}</TableCell>
                            <TableCell>{formatDate(entry.publishedAt ?? entry.createdAt)}</TableCell>
                            <TableCell className="max-w-[320px] whitespace-normal text-sm text-[var(--tech-color-text-muted)]">
                              <div>{entry.changeSummary || "—"}</div>
                              {entry.changeDetails.length > 0 ? (
                                <div className="mt-1 text-xs">
                                  {entry.changeDetails.slice(0, 4).join(", ")}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {entry.isCurrent ? (
                                  <Badge>Текущая</Badge>
                                ) : canRollback ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => rollbackMutation.mutate({ versionId: entry.id })}
                                    disabled={rollbackMutation.isPending}
                                  >
                                    <RotateCcw size={14} />
                                    Откатить
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AdminCard>
                </TabsContent>
              </Tabs>
            </ThemeCanvas>
          </AdminSection>
        </div>

        <div className="space-y-6">
          <AdminSection
            title="Контур публикации"
            description="Чётко разводим черновик, предпросмотр и боевую публикацию."
          >
            <div className="space-y-4">
              <AdminCard title="Права доступа">
                <div className="space-y-2 text-sm text-[var(--tech-color-text-muted)]">
                  <div className="flex items-center justify-between">
                    <span>design_system.view</span>
                    <Badge variant="outline">{ability.can("read", "DesignSystem") ? "Да" : "Нет"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>design_system.edit</span>
                    <Badge variant="outline">{canEdit ? "Да" : "Нет"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>design_system.publish</span>
                    <Badge variant="outline">{canPublish ? "Да" : "Нет"}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>design_system.rollback</span>
                    <Badge variant="outline">{canRollback ? "Да" : "Нет"}</Badge>
                  </div>
                </div>
              </AdminCard>

              <AdminCard title="Пустые состояния">
                <div className="space-y-3">
                  <div className="rounded-[var(--tech-radius-card)] border border-dashed border-border bg-card p-4">
                    <div className="font-black">Заказов пока нет</div>
                    <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                      Когда покупатели начнут оформлять заказы, они появятся здесь.
                    </div>
                  </div>
                  <div className="rounded-[var(--tech-radius-card)] border border-dashed border-border bg-card p-4">
                    <div className="font-black">Нет изображений</div>
                    <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                      Для товаров без фото используем централизованную заглушку и единый стиль карточки.
                    </div>
                  </div>
                </div>
              </AdminCard>

              <AdminCard title="Загрузка">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 text-sm text-[var(--tech-color-text-muted)]">
                    <Loader2 className="animate-spin text-[var(--tech-color-primary)]" size={18} />
                    Spinner
                  </div>
                  <div className="space-y-2">
                    <div className="h-5 w-1/2 animate-pulse rounded-md bg-[var(--tech-color-surface-muted)]" />
                    <div className="h-28 animate-pulse rounded-[var(--tech-radius-card)] bg-[var(--tech-color-surface-muted)]" />
                    <div className="h-10 w-1/3 animate-pulse rounded-[var(--tech-radius-button)] bg-[var(--tech-color-surface-muted)]" />
                  </div>
                </div>
              </AdminCard>
            </div>
          </AdminSection>
        </div>
      </div>
    </div>
  );
}
