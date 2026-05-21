import {
  defaultDesignThemeBundle,
  designThemeScopeSchema,
  type DesignTheme,
  type DesignThemeBundle,
  type DesignThemeScope,
} from "@contracts/design-system";
import {
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  History,
  House,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MapPin,
  MonitorCog,
  Package,
  Palette,
  RefreshCw,
  ReceiptText,
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
const DESIGN_THEME_SCOPES = designThemeScopeSchema.options;

const THEME_SCOPE_META: Record<
  DesignThemeScope,
  { label: string; description: string }
> = {
  siteLight: {
    label: "Сайт · светлая",
    description: "Основная светлая тема витрины, каталога и checkout.",
  },
  siteDark: {
    label: "Сайт · тёмная",
    description: "Тёмная тема витрины, которая включается переключателем в шапке.",
  },
  admin: {
    label: "Админка",
    description: "Отдельная тема админ-панелей, таблиц и внутренних экранов.",
  },
};

const TAB_LABELS = [
  { key: "overview", label: "Обзор", icon: MonitorCog },
  { key: "site-pages", label: "Страницы сайта", icon: House },
  { key: "admin-pages", label: "Страницы админки", icon: MonitorCog },
  { key: "colors", label: "Цвета", icon: Palette },
  { key: "typography", label: "Типографика", icon: Type },
  { key: "buttons", label: "Кнопки", icon: ShoppingCart },
  { key: "forms", label: "Формы", icon: Check },
  { key: "product-cards", label: "Карточки товаров", icon: Package },
  { key: "orders", label: "Заказы", icon: LayoutGrid },
  { key: "tables", label: "Таблицы", icon: TableProperties },
  { key: "notifications", label: "Уведомления", icon: Bell },
  { key: "icons", label: "Иконки", icon: Sparkles },
  { key: "theme", label: "Темы", icon: Palette },
  { key: "history", label: "История изменений", icon: History },
] as const;

type TokenControlDefinition =
  | {
      type: "color";
      section: "colors";
      field: keyof DesignTheme["colors"];
      label: string;
    }
  | {
      type: "number";
      section: "radii" | "typography" | "controls";
      field:
        | keyof DesignTheme["radii"]
        | keyof DesignTheme["typography"]
        | keyof DesignTheme["controls"];
      label: string;
      min: number;
      max: number;
      step?: number;
      suffix?: string;
    }
  | {
      type: "text";
      section: "typography" | "effects" | "meta";
      field:
        | keyof DesignTheme["typography"]
        | keyof DesignTheme["effects"]
        | keyof DesignTheme["meta"];
      label: string;
    };

const sitePageSections = [
  {
    key: "home",
    label: "Главная",
    icon: House,
    description:
      "Hero, категории, товары недели и вторичные блоки. Здесь особенно важны фон, контраст, радиус карточек и выразительность CTA.",
    subsections: ["Hero", "Категории", "Товары недели", "Нижние блоки"],
    controls: [
      { type: "color", section: "colors", field: "background", label: "Фон страницы" },
      { type: "color", section: "colors", field: "surface", label: "Фон карточек" },
      { type: "color", section: "colors", field: "primary", label: "Главный акцент" },
      { type: "number", section: "radii", field: "card", label: "Радиус карточек", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "controls", field: "buttonHeight", label: "Высота CTA", min: 40, max: 72, suffix: "px" },
      { type: "number", section: "typography", field: "h1Size", label: "Hero H1", min: 28, max: 72, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "catalog",
    label: "Каталог",
    icon: Search,
    description:
      "Фильтры, заголовок раздела, сетка товаров и сортировка. Здесь важны плотность, читаемость и стабильная карточка.",
    subsections: ["Header", "Фильтры", "Сетка товаров", "Сортировка"],
    controls: [
      { type: "color", section: "colors", field: "surfaceMuted", label: "Фон боковых панелей" },
      { type: "color", section: "colors", field: "border", label: "Границы фильтров" },
      { type: "number", section: "radii", field: "card", label: "Радиус карточек", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "controls", field: "inputHeight", label: "Высота select/input", min: 36, max: 64, suffix: "px" },
      { type: "number", section: "typography", field: "h2Size", label: "Заголовок раздела", min: 20, max: 56, suffix: "px" },
      { type: "number", section: "typography", field: "bodySize", label: "Текст карточек", min: 14, max: 22, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "product",
    label: "Карточка товара",
    icon: ImageIcon,
    description:
      "Галерея, цена, action-блок, наличие по магазинам и отзывы. Здесь нужен акцент на доверии и чистой иерархии.",
    subsections: ["Галерея", "Цена и CTA", "Наличие", "Отзывы"],
    controls: [
      { type: "color", section: "colors", field: "primary", label: "Кнопка покупки" },
      { type: "color", section: "colors", field: "success", label: "Статус наличия" },
      { type: "number", section: "typography", field: "priceSize", label: "Размер цены", min: 24, max: 56, suffix: "px" },
      { type: "number", section: "radii", field: "card", label: "Радиус панелей", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "radii", field: "modal", label: "Радиус lightbox/modal", min: 8, max: 40, suffix: "px" },
      { type: "number", section: "controls", field: "buttonHeight", label: "Высота action-кнопок", min: 40, max: 72, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "checkout",
    label: "Checkout",
    icon: ReceiptText,
    description:
      "Корзина, форма, блок оплаты и summary заказа. Здесь особенно важны доверие, контраст и спокойные поверхности.",
    subsections: ["Состав заказа", "Контакты", "Оплата", "Summary"],
    controls: [
      { type: "color", section: "colors", field: "surface", label: "Фон панелей" },
      { type: "color", section: "colors", field: "info", label: "Инфо-статусы" },
      { type: "number", section: "controls", field: "inputHeight", label: "Высота полей", min: 40, max: 64, suffix: "px" },
      { type: "number", section: "controls", field: "buttonHeight", label: "Высота кнопок", min: 40, max: 72, suffix: "px" },
      { type: "number", section: "radii", field: "card", label: "Радиус summary", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "typography", field: "bodySize", label: "Текст формы", min: 14, max: 22, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "blog",
    label: "Блог",
    icon: BookOpen,
    description:
      "Hero блога, featured-материал, сетка статей и article cards. Здесь важны типографика и ритм контентной поверхности.",
    subsections: ["Hero", "Featured", "Сетка статей", "Карточка статьи"],
    controls: [
      { type: "color", section: "colors", field: "brandDark", label: "Фон hero" },
      { type: "color", section: "colors", field: "primary", label: "Контентный акцент" },
      { type: "number", section: "typography", field: "h1Size", label: "Hero H1", min: 28, max: 72, suffix: "px" },
      { type: "number", section: "typography", field: "h3Size", label: "Заголовок статьи", min: 18, max: 40, suffix: "px" },
      { type: "number", section: "radii", field: "card", label: "Радиус article cards", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "typography", field: "bodyLineHeight", label: "Line-height текста", min: 1.3, max: 2, step: 0.05 },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "contacts",
    label: "Контакты",
    icon: MapPin,
    description:
      "Контактные карточки, адреса, мессенджеры и trust-блоки. Эта страница должна быть простой и очень читаемой.",
    subsections: ["Контакты", "Адреса", "Мессенджеры", "Trust-блок"],
    controls: [
      { type: "color", section: "colors", field: "surface", label: "Фон карточек" },
      { type: "color", section: "colors", field: "textMuted", label: "Вторичный текст" },
      { type: "number", section: "radii", field: "card", label: "Радиус карточек", min: 8, max: 32, suffix: "px" },
      { type: "number", section: "controls", field: "iconButtonSize", label: "Размер icon buttons", min: 32, max: 64, suffix: "px" },
      { type: "number", section: "typography", field: "h3Size", label: "Заголовки блоков", min: 18, max: 40, suffix: "px" },
      { type: "number", section: "typography", field: "bodySize", label: "Текст страницы", min: 14, max: 22, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
] as const;

const adminPageSections = [
  {
    key: "dashboard",
    label: "Dashboard",
    icon: MonitorCog,
    description:
      "Статкарточки, верхние summary-блоки и быстрые действия. Должно читаться плотно, но спокойно.",
    subsections: ["Stat cards", "Action row", "Summary panels"],
    controls: [
      { type: "color", section: "colors", field: "surfaceMuted", label: "Фон dashboard-панелей" },
      { type: "number", section: "radii", field: "card", label: "Радиус stat cards", min: 8, max: 28, suffix: "px" },
      { type: "number", section: "typography", field: "h3Size", label: "Heading статкарточек", min: 18, max: 34, suffix: "px" },
      { type: "text", section: "effects", field: "cardShadow", label: "Тень панелей" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "orders",
    label: "Заказы",
    icon: ReceiptText,
    description:
      "Список заказов, статусы, карточка заказа и action buttons менеджера.",
    subsections: ["Таблица заказов", "Статусы", "Карточка заказа", "Действия"],
    controls: [
      { type: "color", section: "colors", field: "success", label: "Успешные статусы" },
      { type: "color", section: "colors", field: "warning", label: "Ожидающие статусы" },
      { type: "color", section: "colors", field: "danger", label: "Проблемные статусы" },
      { type: "number", section: "controls", field: "buttonHeight", label: "Высота action buttons", min: 36, max: 64, suffix: "px" },
      { type: "number", section: "typography", field: "adminLabelSize", label: "Лейблы и заголовки", min: 10, max: 18, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "products",
    label: "Товары",
    icon: Package,
    description:
      "Таблица товаров, карточка товара в админке, остатки и merchandising-бейджи.",
    subsections: ["Таблица", "Карточка", "Бейджи", "Остатки"],
    controls: [
      { type: "color", section: "colors", field: "badgeNew", label: "Новинка" },
      { type: "color", section: "colors", field: "badgeExcellent", label: "Отличная цена" },
      { type: "number", section: "radii", field: "badge", label: "Радиус бейджей", min: 6, max: 999, suffix: "px" },
      { type: "number", section: "typography", field: "smallSize", label: "Вторичный текст", min: 12, max: 20, suffix: "px" },
      { type: "text", section: "effects", field: "cardShadow", label: "Тень карточек" },
    ] satisfies TokenControlDefinition[],
  },
  {
    key: "sync",
    label: "Синхронизация",
    icon: RefreshCw,
    description:
      "Очереди sync, технические статусы и error-state панели. Здесь особенно важен быстрый визуальный разбор.",
    subsections: ["Статусы", "Логи", "Ошибки", "Очередь"],
    controls: [
      { type: "color", section: "colors", field: "info", label: "Инфо-статусы" },
      { type: "color", section: "colors", field: "warning", label: "Warning-сигналы" },
      { type: "color", section: "colors", field: "danger", label: "Error-сигналы" },
      { type: "number", section: "radii", field: "card", label: "Радиус тех. панелей", min: 8, max: 28, suffix: "px" },
      { type: "number", section: "typography", field: "captionSize", label: "Лог-текст", min: 10, max: 18, suffix: "px" },
    ] satisfies TokenControlDefinition[],
  },
] as const;

type SitePageSectionKey = (typeof sitePageSections)[number]["key"];
type AdminPageSectionKey = (typeof adminPageSections)[number]["key"];
type ThemePatch = {
  meta?: Partial<DesignTheme["meta"]>;
  colors?: Partial<DesignTheme["colors"]>;
  radii?: Partial<DesignTheme["radii"]>;
  typography?: Partial<DesignTheme["typography"]>;
  controls?: Partial<DesignTheme["controls"]>;
  effects?: Partial<DesignTheme["effects"]>;
};

type PagePreset = {
  key: string;
  label: string;
  description: string;
  changes: string[];
  patch: ThemePatch;
};

const sitePagePresets: Record<SitePageSectionKey, PagePreset[]> = {
  home: [
    {
      key: "hero-premium",
      label: "Premium Hero",
      description: "Больше драматургии для первого экрана и более мягкие карточки.",
      changes: ["Увеличивает hero H1", "Смягчает карточки", "Добавляет глубину тени"],
      patch: {
        typography: { h1Size: 48, h2Size: 30 },
        radii: { card: 22, button: 14 },
        effects: {
          cardShadow: "0 18px 46px rgba(15, 23, 42, 0.12)",
          buttonShadow: "0 14px 30px rgba(5, 195, 212, 0.22)",
        },
      },
    },
    {
      key: "compact-retail",
      label: "Compact Retail",
      description: "Плотнее собирает категории и товары, чтобы главный экран сканировался быстрее.",
      changes: ["Уменьшает hero", "Делает CTA компактнее", "Собирает витрину плотнее"],
      patch: {
        typography: { h1Size: 34, bodySize: 15 },
        controls: { buttonHeight: 42 },
        radii: { card: 14 },
      },
    },
  ],
  catalog: [
    {
      key: "dense-grid",
      label: "Dense Grid",
      description: "Для каталога с плотной сеткой и более утилитарной подачей.",
      changes: ["Снижает визуальный шум", "Делает карточки компактнее", "Усиливает рабочий характер каталога"],
      patch: {
        radii: { card: 12, button: 10 },
        typography: { h2Size: 24, bodySize: 15, smallSize: 13 },
        controls: { inputHeight: 42, buttonHeight: 42 },
      },
    },
    {
      key: "airy-showcase",
      label: "Airy Showcase",
      description: "Больше воздуха и акцента на товарах для категорий с красивыми карточками.",
      changes: ["Добавляет воздуха", "Увеличивает заголовок", "Делает карточки мягче"],
      patch: {
        radii: { card: 20 },
        typography: { h2Size: 30, bodySize: 16 },
        effects: { cardShadow: "0 16px 38px rgba(15, 23, 42, 0.1)" },
      },
    },
  ],
  product: [
    {
      key: "sales-heavy",
      label: "Sales Heavy",
      description: "Более агрессивный акцент на цене и CTA для конверсионной карточки товара.",
      changes: ["Увеличивает цену", "Усиливает CTA", "Чуть плотнее action-блок"],
      patch: {
        typography: { priceSize: 40, h1Size: 44 },
        controls: { buttonHeight: 48 },
        effects: { buttonShadow: "0 16px 34px rgba(5, 195, 212, 0.26)" },
      },
    },
    {
      key: "trust-first",
      label: "Trust First",
      description: "Спокойнее показывает карточку товара, усиливая блоки наличия и доверия.",
      changes: ["Смягчает карточки", "Чуть снижает агрессивность CTA", "Делает отзывы и наличие спокойнее"],
      patch: {
        radii: { card: 18, modal: 28 },
        typography: { bodySize: 16, priceSize: 34 },
        controls: { buttonHeight: 44 },
      },
    },
  ],
  checkout: [
    {
      key: "focused-conversion",
      label: "Focused Conversion",
      description: "Чистый и более деловой checkout с компактной формой.",
      changes: ["Уплотняет поля", "Делает summary спокойнее", "Сохраняет сильный CTA"],
      patch: {
        controls: { inputHeight: 42, buttonHeight: 44 },
        radii: { card: 14 },
        typography: { bodySize: 15, h2Size: 26 },
      },
    },
    {
      key: "soft-trust",
      label: "Soft Trust",
      description: "Чуть мягче подаёт checkout и добавляет ощущение доверия.",
      changes: ["Увеличивает поверхности", "Смягчает карточки", "Усиливает readability формы"],
      patch: {
        radii: { card: 20, input: 14 },
        typography: { bodyLineHeight: 1.7 },
        effects: { cardShadow: "0 14px 34px rgba(15, 23, 42, 0.08)" },
      },
    },
  ],
  blog: [
    {
      key: "editorial",
      label: "Editorial",
      description: "Сильнее сдвигает блог в сторону медиа и большого контента.",
      changes: ["Увеличивает hero и H3", "Поднимает line-height", "Делает статьи воздушнее"],
      patch: {
        typography: { h1Size: 52, h3Size: 26, bodyLineHeight: 1.75 },
        radii: { card: 20 },
      },
    },
    {
      key: "commerce-content",
      label: "Commerce Content",
      description: "Баланс между медиа-подачей и коммерческой задачей магазина.",
      changes: ["Чуть компактнее карточки", "Сохраняет сильный акцент бренда", "Делает excerpt короче визуально"],
      patch: {
        typography: { h1Size: 40, h3Size: 22, bodyLineHeight: 1.6 },
        radii: { card: 16 },
      },
    },
  ],
  contacts: [
    {
      key: "service-clarity",
      label: "Service Clarity",
      description: "Для контактов с акцентом на читаемость и сервисную ясность.",
      changes: ["Подчищает вторичный текст", "Собирает карточки", "Чуть крупнее заголовки"],
      patch: {
        typography: { h3Size: 24, bodySize: 15 },
        radii: { card: 14 },
        colors: { textMuted: "#5F6975" },
      },
    },
    {
      key: "friendly-trust",
      label: "Friendly Trust",
      description: "Более мягкая и дружелюбная подача контактов и trust-блоков.",
      changes: ["Смягчает поверхности", "Чуть увеличивает radius", "Делает блоки теплее визуально"],
      patch: {
        radii: { card: 20 },
        colors: { surfaceMuted: "#F1F7F9" },
        effects: { cardShadow: "0 12px 28px rgba(15, 23, 42, 0.07)" },
      },
    },
  ],
};

const adminPagePresets: Record<AdminPageSectionKey, PagePreset[]> = {
  dashboard: [
    {
      key: "executive",
      label: "Executive",
      description: "Более премиальная подача summary-карточек и метрик.",
      changes: ["Увеличивает заголовки", "Смягчает панели", "Усиливает depth"],
      patch: {
        radii: { card: 20 },
        typography: { h3Size: 24 },
        effects: { cardShadow: "0 16px 38px rgba(15, 23, 42, 0.09)" },
      },
    },
    {
      key: "ops-compact",
      label: "Ops Compact",
      description: "Более рабочий и плотный дашборд для ежедневной операционки.",
      changes: ["Уплотняет панели", "Снижает воздух", "Оставляет только нужный акцент"],
      patch: {
        radii: { card: 12 },
        typography: { h3Size: 20, smallSize: 13 },
      },
    },
  ],
  orders: [
    {
      key: "manager-focus",
      label: "Manager Focus",
      description: "Выделяет статусы и действия, чтобы менеджеру было проще работать со списком.",
      changes: ["Делает action-кнопки крупнее", "Усиливает цветовые статусы", "Поднимает лейблы"],
      patch: {
        controls: { buttonHeight: 42 },
        typography: { adminLabelSize: 13 },
        colors: { warning: "#F59E0B", danger: "#EF4444", success: "#22C55E" },
      },
    },
    {
      key: "quiet-ops",
      label: "Quiet Ops",
      description: "Более спокойная таблица заказов, когда важна длинная ежедневная работа без визуального шума.",
      changes: ["Снижает контраст лишних акцентов", "Делает список мягче", "Успокаивает панели"],
      patch: {
        radii: { card: 14 },
        colors: { surfaceMuted: "#F3F6F8", border: "#DDE5EB" },
      },
    },
  ],
  products: [
    {
      key: "merch-premium",
      label: "Merch Premium",
      description: "Подсвечивает бейджи и карточки товара в админке чуть выразительнее.",
      changes: ["Усиливает merchandising-бейджи", "Добавляет depth карточкам", "Сохраняет витринный характер"],
      patch: {
        colors: { badgeNew: "#05C3D4", badgeExcellent: "#22C55E" },
        radii: { badge: 999, card: 18 },
        effects: { cardShadow: "0 16px 36px rgba(15, 23, 42, 0.1)" },
      },
    },
    {
      key: "inventory-dense",
      label: "Inventory Dense",
      description: "Более плотная и утилитарная подача товарных таблиц и остатков.",
      changes: ["Уплотняет вторичный текст", "Уменьшает radius", "Ставит акцент на данные"],
      patch: {
        typography: { smallSize: 13, bodySize: 15 },
        radii: { card: 12, badge: 12 },
      },
    },
  ],
  sync: [
    {
      key: "diagnostic",
      label: "Diagnostic",
      description: "Максимально читаемый контур ошибок и технических статусов.",
      changes: ["Усиливает warning/error", "Чуть увеличивает лог-текст", "Делает панели контрастнее"],
      patch: {
        colors: { info: "#0EA5E9", warning: "#F59E0B", danger: "#EF4444" },
        typography: { captionSize: 13 },
        radii: { card: 14 },
      },
    },
    {
      key: "calm-monitoring",
      label: "Calm Monitoring",
      description: "Более спокойный экран мониторинга для длительного наблюдения.",
      changes: ["Смягчает панели", "Убирает резкость", "Оставляет сигналы только там, где нужно"],
      patch: {
        colors: { surfaceMuted: "#F2F6F8", border: "#DCE4EA" },
        effects: { cardShadow: "0 10px 22px rgba(15, 23, 42, 0.06)" },
      },
    },
  ],
};

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

function cloneThemeBundle(theme: DesignThemeBundle) {
  return JSON.parse(JSON.stringify(theme)) as DesignThemeBundle;
}

function applyThemePatch(theme: DesignTheme, patch: ThemePatch) {
  return {
    ...theme,
    meta: patch.meta ? { ...theme.meta, ...patch.meta } : theme.meta,
    colors: patch.colors ? { ...theme.colors, ...patch.colors } : theme.colors,
    radii: patch.radii ? { ...theme.radii, ...patch.radii } : theme.radii,
    typography: patch.typography
      ? { ...theme.typography, ...patch.typography }
      : theme.typography,
    controls: patch.controls
      ? { ...theme.controls, ...patch.controls }
      : theme.controls,
    effects: patch.effects ? { ...theme.effects, ...patch.effects } : theme.effects,
  } satisfies DesignTheme;
}

function getThemeForScope(themeBundle: DesignThemeBundle, scope: DesignThemeScope) {
  return themeBundle[scope];
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

function TokenControlGrid({
  controls,
  theme,
  onUpdate,
}: {
  controls: readonly TokenControlDefinition[];
  theme: DesignTheme;
  onUpdate: (control: TokenControlDefinition, value: string | number) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {controls.map(control => {
        const value = (theme[control.section] as Record<string, unknown>)[
          control.field as string
        ];

        if (control.type === "color") {
          return (
            <ColorField
              key={`${control.section}.${String(control.field)}`}
              label={control.label}
              value={String(value)}
              onChange={next => onUpdate(control, next)}
            />
          );
        }

        if (control.type === "number") {
          return (
            <NumberField
              key={`${control.section}.${String(control.field)}`}
              label={control.label}
              value={Number(value)}
              min={control.min}
              max={control.max}
              step={control.step}
              suffix={control.suffix}
              onChange={next => onUpdate(control, next)}
            />
          );
        }

        return (
          <label
            key={`${control.section}.${String(control.field)}`}
            className="space-y-2"
          >
            <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">
              {control.label}
            </span>
            <Input
              value={String(value)}
              onChange={e => onUpdate(control, e.target.value)}
            />
          </label>
        );
      })}
    </div>
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
      setThemeBundle(cloneThemeBundle(payload.draftTheme));
      utils.designSystem.getAdminState.invalidate();
      toast.success("Черновой комплект тем сброшен к базовому состоянию");
    },
  });
  const rollbackMutation = trpc.designSystem.rollbackVersion.useMutation({
    onSuccess: result => {
      utils.designSystem.getAdminState.invalidate();
      utils.designSystem.getPublishedTheme.invalidate();
      toast.success(`Откат выполнен. Новая версия ${result.versionNumber}`);
    },
  });

  const [themeBundle, setThemeBundle] = useState<DesignThemeBundle>(
    cloneThemeBundle(defaultDesignThemeBundle)
  );
  const [activeTab, setActiveTab] = useState<(typeof TAB_LABELS)[number]["key"]>("overview");
  const [activeScope, setActiveScope] = useState<DesignThemeScope>("siteLight");
  const [activeSitePage, setActiveSitePage] = useState<SitePageSectionKey>("home");
  const [activeAdminPage, setActiveAdminPage] = useState<AdminPageSectionKey>("dashboard");
  const [previewEnabled, setPreviewEnabled] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!data?.draftTheme) return;
    setThemeBundle(cloneThemeBundle(data.draftTheme));
  }, [data?.draftTheme]);

  useEffect(() => {
    if (typeof document === "undefined" || !data?.publishedTheme) return;
    applyThemeToElement(
      document.documentElement,
      previewEnabled
        ? getThemeForScope(themeBundle, activeScope)
        : data.publishedTheme.admin
    );

    return () => {
      applyThemeToElement(document.documentElement, data.publishedTheme.admin);
    };
  }, [activeScope, data?.publishedTheme, previewEnabled, themeBundle]);

  const hasUnsavedChanges = useMemo(() => {
    if (!data?.draftTheme) return false;
    return JSON.stringify(themeBundle) !== JSON.stringify(data.draftTheme);
  }, [data?.draftTheme, themeBundle]);

  const theme = useMemo(
    () => cloneTheme(getThemeForScope(themeBundle, activeScope)),
    [activeScope, themeBundle]
  );

  const publishedScopeTheme = useMemo(
    () => getThemeForScope(data?.publishedTheme ?? defaultDesignThemeBundle, activeScope),
    [activeScope, data?.publishedTheme]
  );

  const updateThemeSection = <K extends ThemeSection, F extends keyof DesignTheme[K]>(
    _section: K,
    field: F,
    value: DesignTheme[K][F]
  ) => {
    setThemeBundle(prev => ({
      ...prev,
      [activeScope]: {
        ...prev[activeScope],
        [field]: value,
      },
    }));
  };

  const updateFromPageControl = (
    control: TokenControlDefinition,
    value: string | number
  ) => {
    updateThemeSection(
      control.section as ThemeSection,
      control.field as never,
      value as never
    );
  };

  const applyPresetToActiveScope = (patch: ThemePatch) => {
    setThemeBundle(prev => ({
      ...prev,
      [activeScope]: applyThemePatch(prev[activeScope], patch),
    }));
  };

  const handleSaveDraft = () => {
    saveDraftMutation.mutate({ theme: themeBundle });
  };

  const handlePublish = async () => {
    try {
      if (hasUnsavedChanges) {
        await saveDraftMutation.mutateAsync({ theme: themeBundle });
      }
      await publishMutation.mutateAsync({ changeNote });
    } catch {
      // Mutation surfaces the toast/error state for us.
    }
  };

  const handlePreviewToggle = () => {
    setPreviewEnabled(prev => !prev);
    toast.info(
      previewEnabled
        ? "Предпросмотр выключен"
        : activeScope === "admin"
          ? "Предпросмотр темы админки включён"
          : `Предпросмотр секции «${THEME_SCOPE_META[activeScope].label}» включён на живом полотне`
    );
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

  const activeSitePageSection =
    sitePageSections.find(section => section.key === activeSitePage) ??
    sitePageSections[0];
  const activeAdminPageSection =
    adminPageSections.find(section => section.key === activeAdminPage) ??
    adminPageSections[0];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        eyebrow="Единый источник правды"
        title="UI-гайдлайн и дизайн-система"
        description="Здесь собраны дизайн-токены, живые компоненты сайта и контур управления темой. Меняем токены один раз, а сайт и админка подхватывают тему через CSS variables."
        meta={
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{data.publishedTheme.meta.name}</Badge>
            <Badge variant="outline">{THEME_SCOPE_META[activeScope].label}</Badge>
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
              Сбросить к базовым темам
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
              theme={previewEnabled ? theme : publishedScopeTheme}
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
                    <AdminCard title="Комплект тем" description="Светлая витрина, тёмная витрина и админка живут отдельно, но публикуются одним комплектом.">
                      <div className="space-y-4 text-sm">
                        <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                            Опубликованный комплект
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
                            {themeBundle.meta.name}
                          </div>
                          <div className="mt-1 text-[var(--tech-color-text-muted)]">
                            {themeBundle.meta.description || "Без описания"}
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {DESIGN_THEME_SCOPES.map(scope => {
                            const scopedTheme = getThemeForScope(themeBundle, scope);
                            return (
                              <button
                                key={scope}
                                type="button"
                                onClick={() => setActiveScope(scope)}
                                className={cn(
                                  "flex items-start justify-between gap-3 rounded-[var(--tech-radius-card)] border p-3 text-left transition-colors",
                                  activeScope === scope
                                    ? "border-[var(--tech-color-primary)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,white)]"
                                    : "border-border bg-card hover:border-[var(--tech-color-primary)]/40"
                                )}
                              >
                                <div>
                                  <div className="text-xs font-black uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">
                                    {THEME_SCOPE_META[scope].label}
                                  </div>
                                  <div className="mt-1 font-semibold text-[var(--tech-color-text-main)]">
                                    {scopedTheme.meta.name}
                                  </div>
                                  <div className="mt-1 text-xs text-[var(--tech-color-text-muted)]">
                                    {THEME_SCOPE_META[scope].description}
                                  </div>
                                </div>
                                <div
                                  className="h-10 w-10 shrink-0 rounded-full border border-border"
                                  style={{
                                    background: `linear-gradient(135deg, ${scopedTheme.colors.primary}, ${scopedTheme.colors.background})`,
                                  }}
                                />
                              </button>
                            );
                          })}
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

                <TabsContent value="site-pages" className="space-y-6 pt-4">
                  <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <AdminCard
                      title="Основные страницы сайта"
                      description="Редактируем не абстрактную тему, а реальные поверхности: главная, каталог, карточка товара, checkout, блог и контакты."
                    >
                      <div className="space-y-3">
                        {sitePageSections.map(section => {
                          const Icon = section.icon;
                          return (
                            <button
                              key={section.key}
                              type="button"
                              onClick={() => setActiveSitePage(section.key)}
                              className={cn(
                                "w-full rounded-[var(--tech-radius-card)] border p-4 text-left transition-colors",
                                activeSitePage === section.key
                                  ? "border-[var(--tech-color-primary)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,white)]"
                                  : "border-border bg-card hover:border-[var(--tech-color-primary)]/40"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[var(--tech-radius-button)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]">
                                  <Icon size={18} />
                                </div>
                                <div>
                                  <div className="font-black text-[var(--tech-color-text-main)]">
                                    {section.label}
                                  </div>
                                  <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                                    {section.description}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </AdminCard>

                    <div className="space-y-6">
                      <AdminCard
                        title={activeSitePageSection.label}
                        description={activeSitePageSection.description}
                      >
                        <div className="mb-4 flex flex-wrap gap-2">
                          {activeSitePageSection.subsections.map(item => (
                            <Badge key={item} variant="outline">
                              {item}
                            </Badge>
                          ))}
                        </div>
                        <TokenControlGrid
                          controls={activeSitePageSection.controls}
                          theme={theme}
                          onUpdate={updateFromPageControl}
                        />
                      </AdminCard>

                      <AdminCard
                        title="Page presets"
                        description="Быстрые сценарии для этой страницы. Preset накладывает готовый набор токенов поверх текущей темы, чтобы можно было быстро примерить направление UI."
                      >
                        <div className="grid gap-4 xl:grid-cols-2">
                          {sitePagePresets[activeSitePage].map(preset => (
                            <div
                              key={preset.key}
                              className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                                    Preset
                                  </div>
                                  <div className="mt-2 text-lg font-black text-[var(--tech-color-text-main)]">
                                    {preset.label}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    applyPresetToActiveScope(preset.patch);
                                    toast.success(`Preset «${preset.label}» применён`);
                                  }}
                                >
                                  Применить
                                </Button>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
                                {preset.description}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {preset.changes.map(change => (
                                  <Badge key={change} variant="outline">
                                    {change}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AdminCard>

                      {activeSitePage === "home" ? (
                        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                          <AdminCard title="Hero-блок">
                            <div className="rounded-[var(--tech-radius-card)] border border-border bg-[var(--tech-color-surface)] p-6 shadow-[var(--tech-shadow-card)]">
                              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                                Технологичный retail
                              </div>
                              <h1 className="mt-4">Техника и аксессуары</h1>
                              <p className="mt-4 text-[var(--tech-color-text-muted)]">
                                Быстрый preview главного экрана витрины с акцентом на hero, CTA и ритм секций.
                              </p>
                              <div className="mt-6 flex flex-wrap gap-3">
                                <Button>Смотреть каталог</Button>
                                <Button variant="outline">Наши магазины</Button>
                              </div>
                            </div>
                          </AdminCard>
                          <AdminCard title="Категории и витрина">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 shadow-[var(--tech-shadow-card)]">
                                <div className="mb-3 h-10 w-10 rounded-[var(--tech-radius-button)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)]" />
                                <div className="font-black">Категория</div>
                                <div className="mt-2 text-sm text-[var(--tech-color-text-muted)]">Короткое описание раздела</div>
                              </div>
                              <ProductCard product={sampleProducts[0] as any} imagePriority />
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeSitePage === "catalog" ? (
                        <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
                          <AdminCard title="Фильтры и сортировка">
                            <div className="space-y-4 rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                              <Input placeholder="Поиск по фильтрам" />
                              <div className="space-y-3 text-sm">
                                <label className="flex items-center gap-3">
                                  <Checkbox checked />
                                  В наличии
                                </label>
                                <label className="flex items-center gap-3">
                                  <Checkbox />
                                  Новинки
                                </label>
                                <label className="flex items-center gap-3">
                                  <Checkbox />
                                  Акции
                                </label>
                              </div>
                              <Select>
                                <SelectTrigger>
                                  <SelectValue placeholder="По популярности" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="popular">По популярности</SelectItem>
                                  <SelectItem value="asc">Цена ↑</SelectItem>
                                  <SelectItem value="desc">Цена ↓</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </AdminCard>
                          <AdminCard title="Сетка товаров">
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                              {sampleProducts.map(product => (
                                <ProductCard key={product.id} product={product as any} />
                              ))}
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeSitePage === "product" ? (
                        <div className="grid gap-4 xl:grid-cols-[1fr_0.95fr]">
                          <AdminCard title="Галерея и media">
                            <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-6 shadow-[var(--tech-shadow-card)]">
                              <div className="aspect-square rounded-[calc(var(--tech-radius-card)-4px)] bg-[var(--tech-color-surface-muted)]" />
                              <div className="mt-4 grid grid-cols-4 gap-3">
                                {Array.from({ length: 4 }).map((_, index) => (
                                  <div key={index} className="aspect-square rounded-[calc(var(--tech-radius-card)-8px)] border border-border bg-[var(--tech-color-surface-muted)]" />
                                ))}
                              </div>
                            </div>
                          </AdminCard>
                          <AdminCard title="Цена, CTA и наличие">
                            <div className="space-y-4">
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <Price value={1990} oldValue={2490} />
                                <div className="mt-4 grid gap-3">
                                  <Button className="w-full">В корзину</Button>
                                  <Button variant="secondary" className="w-full">Купить в 1 клик</Button>
                                </div>
                              </div>
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <div className="font-black">Наличие в магазинах</div>
                                <div className="mt-3 space-y-3">
                                  <div className="rounded-[calc(var(--tech-radius-card)-6px)] border border-border p-4">
                                    <div className="font-semibold">пр. Строителей, 50А</div>
                                    <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">Доступно: 3 шт.</div>
                                  </div>
                                  <div className="rounded-[calc(var(--tech-radius-card)-6px)] border border-border p-4">
                                    <div className="font-semibold">ТЦ Застава</div>
                                    <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">Доступно: 1 шт.</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeSitePage === "checkout" ? (
                        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                          <AdminCard title="Форма и корзина">
                            <div className="space-y-4 rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                              <Input placeholder="ФИО" />
                              <Input placeholder="Телефон" />
                              <Input placeholder="Email" />
                              <Textarea rows={4} placeholder="Комментарий к заказу" />
                            </div>
                          </AdminCard>
                          <AdminCard title="Summary заказа">
                            <div className="space-y-4 rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                              <div className="flex items-center justify-between">
                                <span>Товары</span>
                                <span className="font-black">3 980 ₽</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Доставка</span>
                                <span className="font-black">0 ₽</span>
                              </div>
                              <div className="border-t border-border pt-4 text-lg font-black">Итого: 3 980 ₽</div>
                              <Button className="w-full">Оформить заказ</Button>
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeSitePage === "blog" ? (
                        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
                          <AdminCard title="Hero и featured">
                            <div className="overflow-hidden rounded-[var(--tech-radius-card)] border border-border bg-[var(--tech-color-brand-dark)] p-6 text-white shadow-[var(--tech-shadow-card)]">
                              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--tech-color-primary)]">
                                Блог ТЕХАКС
                              </div>
                              <h1 className="mt-4 text-white">Полезные материалы</h1>
                              <p className="mt-4 text-white/70">
                                Контентная поверхность с большим hero и спокойным ритмом статьи.
                              </p>
                            </div>
                          </AdminCard>
                          <AdminCard title="Сетка статей">
                            <div className="grid gap-4 md:grid-cols-2">
                              {Array.from({ length: 2 }).map((_, index) => (
                                <div key={index} className="overflow-hidden rounded-[var(--tech-radius-card)] border border-border bg-card shadow-[var(--tech-shadow-card)]">
                                  <div className="h-40 bg-[var(--tech-color-surface-muted)]" />
                                  <div className="p-5">
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--tech-color-primary)]">Гайд</div>
                                    <div className="mt-3 text-xl font-black">Как выбрать аксессуар</div>
                                    <div className="mt-3 text-sm text-[var(--tech-color-text-muted)]">Короткий excerpt статьи для preview состояния.</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeSitePage === "contacts" ? (
                        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                          <AdminCard title="Контактные карточки">
                            <div className="space-y-4">
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <div className="font-black">Телефон</div>
                                <div className="mt-2 text-[var(--tech-color-text-muted)]">+7 (927) 364-28-88</div>
                              </div>
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <div className="font-black">Email</div>
                                <div className="mt-2 text-[var(--tech-color-text-muted)]">tech.aks@yandex.ru</div>
                              </div>
                            </div>
                          </AdminCard>
                          <AdminCard title="Адрес и trust-block">
                            <div className="space-y-4">
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <div className="font-black">Адрес магазина</div>
                                <div className="mt-2 text-[var(--tech-color-text-muted)]">
                                  Пенза, ул. Генерала Глазунова, 1
                                </div>
                              </div>
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]">
                                <div className="font-black">Почему это работает</div>
                                <div className="mt-2 text-sm text-[var(--tech-color-text-muted)]">
                                  На странице контактов важны прозрачность, плотность без шума и уверенные акценты для мессенджеров.
                                </div>
                              </div>
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="admin-pages" className="space-y-6 pt-4">
                  <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
                    <AdminCard
                      title="Основные экраны админки"
                      description="Настраиваем панели, таблицы и рабочие пространства по реальным сценариям: dashboard, заказы, товары, sync."
                    >
                      <div className="space-y-3">
                        {adminPageSections.map(section => {
                          const Icon = section.icon;
                          return (
                            <button
                              key={section.key}
                              type="button"
                              onClick={() => setActiveAdminPage(section.key)}
                              className={cn(
                                "w-full rounded-[var(--tech-radius-card)] border p-4 text-left transition-colors",
                                activeAdminPage === section.key
                                  ? "border-[var(--tech-color-primary)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,white)]"
                                  : "border-border bg-card hover:border-[var(--tech-color-primary)]/40"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-[var(--tech-radius-button)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_12%,white)] text-[var(--tech-color-primary)]">
                                  <Icon size={18} />
                                </div>
                                <div>
                                  <div className="font-black text-[var(--tech-color-text-main)]">
                                    {section.label}
                                  </div>
                                  <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                                    {section.description}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </AdminCard>

                    <div className="space-y-6">
                      <AdminCard
                        title={activeAdminPageSection.label}
                        description={activeAdminPageSection.description}
                      >
                        <div className="mb-4 flex flex-wrap gap-2">
                          {activeAdminPageSection.subsections.map(item => (
                            <Badge key={item} variant="outline">
                              {item}
                            </Badge>
                          ))}
                        </div>
                        <TokenControlGrid
                          controls={activeAdminPageSection.controls}
                          theme={theme}
                          onUpdate={updateFromPageControl}
                        />
                      </AdminCard>

                      <AdminCard
                        title="Page presets"
                        description="Сценарные варианты для рабочей поверхности админки. Удобно быстро переключаться между более плотной, спокойной или более выразительной подачей."
                      >
                        <div className="grid gap-4 xl:grid-cols-2">
                          {adminPagePresets[activeAdminPage].map(preset => (
                            <div
                              key={preset.key}
                              className="rounded-[var(--tech-radius-card)] border border-border bg-card p-5 shadow-[var(--tech-shadow-card)]"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                                    Preset
                                  </div>
                                  <div className="mt-2 text-lg font-black text-[var(--tech-color-text-main)]">
                                    {preset.label}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    applyPresetToActiveScope(preset.patch);
                                    toast.success(`Preset «${preset.label}» применён`);
                                  }}
                                >
                                  Применить
                                </Button>
                              </div>
                              <p className="mt-3 text-sm leading-6 text-[var(--tech-color-text-muted)]">
                                {preset.description}
                              </p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {preset.changes.map(change => (
                                  <Badge key={change} variant="outline">
                                    {change}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </AdminCard>

                      {activeAdminPage === "dashboard" ? (
                        <div className="grid gap-4 md:grid-cols-3">
                          <AdminCard title="Выручка">12 заказов сегодня</AdminCard>
                          <AdminCard title="Конверсия">4.8%</AdminCard>
                          <AdminCard title="Средний чек">3 290 ₽</AdminCard>
                        </div>
                      ) : null}

                      {activeAdminPage === "orders" ? orderStatusCards : null}

                      {activeAdminPage === "products" ? (
                        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                          <AdminCard title="Таблица товаров">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Товар</TableHead>
                                  <TableHead>Цена</TableHead>
                                  <TableHead>Статус</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <TableRow>
                                  <TableCell>Кабель USB-C HOCO X83</TableCell>
                                  <TableCell>390 ₽</TableCell>
                                  <TableCell><StatusBadge status="synced" /></TableCell>
                                </TableRow>
                                <TableRow>
                                  <TableCell>Автодержатель H72</TableCell>
                                  <TableCell>1 990 ₽</TableCell>
                                  <TableCell><StatusBadge status="sync_error" /></TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </AdminCard>
                          <AdminCard title="Бейджи и карточка">
                            <ProductCard product={sampleProducts[1] as any} />
                          </AdminCard>
                        </div>
                      ) : null}

                      {activeAdminPage === "sync" ? (
                        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                          <AdminCard title="Статусы синхронизации">
                            <div className="space-y-3">
                              <StatusBadge status="synced" />
                              <StatusBadge status="sync_error" />
                              <StatusBadge status="processing" />
                            </div>
                          </AdminCard>
                          <AdminCard title="Логи и очередь">
                            <div className="space-y-3">
                              <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4 text-sm text-[var(--tech-color-text-muted)]">
                                14:32 · customerorder sync completed
                              </div>
                              <div className="rounded-[var(--tech-radius-card)] border border-[color:color-mix(in_srgb,var(--tech-color-danger)_25%,white)] bg-[color:color-mix(in_srgb,var(--tech-color-danger)_8%,white)] p-4 text-sm text-[var(--tech-color-danger)]">
                                14:36 · timeout while fetching metadata
                              </div>
                            </div>
                          </AdminCard>
                        </div>
                      ) : null}
                    </div>
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
                  <AdminCard title="Комплект тем" description="У сайта есть отдельные светлая и тёмная темы, а у админки — собственная базовая тема.">
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="space-y-2">
                          <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Название комплекта</span>
                          <Input
                            value={themeBundle.meta.name}
                            onChange={e =>
                              setThemeBundle(prev => ({
                                ...prev,
                                meta: {
                                  ...prev.meta,
                                  name: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                        <label className="space-y-2">
                          <span className="text-[var(--tech-font-size-admin-label)] font-bold uppercase tracking-[0.16em] text-[var(--tech-color-text-muted)]">Описание комплекта</span>
                          <Input
                            value={themeBundle.meta.description}
                            onChange={e =>
                              setThemeBundle(prev => ({
                                ...prev,
                                meta: {
                                  ...prev.meta,
                                  description: e.target.value,
                                },
                              }))
                            }
                          />
                        </label>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-3">
                        {DESIGN_THEME_SCOPES.map(scope => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => setActiveScope(scope)}
                            className={cn(
                              "rounded-[var(--tech-radius-card)] border p-4 text-left transition-colors",
                              activeScope === scope
                                ? "border-[var(--tech-color-primary)] bg-[color:color-mix(in_srgb,var(--tech-color-primary)_8%,white)]"
                                : "border-border bg-card hover:border-[var(--tech-color-primary)]/40"
                            )}
                          >
                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                              {THEME_SCOPE_META[scope].label}
                            </div>
                            <div className="mt-2 font-black text-[var(--tech-color-text-main)]">
                              {getThemeForScope(themeBundle, scope).meta.name}
                            </div>
                            <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                              {THEME_SCOPE_META[scope].description}
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="rounded-[var(--tech-radius-card)] border border-border bg-card p-4">
                        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--tech-color-primary)]">
                          Сейчас редактируем
                        </div>
                        <div className="mt-2 font-black text-[var(--tech-color-text-main)]">
                          {THEME_SCOPE_META[activeScope].label}
                        </div>
                        <div className="mt-1 text-sm text-[var(--tech-color-text-muted)]">
                          {THEME_SCOPE_META[activeScope].description}
                        </div>
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
