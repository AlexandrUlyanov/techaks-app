import { z } from "zod";

const hexColor = z
  .string()
  .trim()
  .regex(/^#([0-9A-Fa-f]{6})$/, "Ожидается HEX-цвет вида #RRGGBB");

const shadowValue = z
  .string()
  .trim()
  .min(1)
  .max(255);

export const designThemeSchema = z.object({
  meta: z.object({
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(255).default(""),
  }),
  colors: z.object({
    primary: hexColor,
    brandDark: hexColor,
    background: hexColor,
    surface: hexColor,
    surfaceMuted: hexColor,
    textMain: hexColor,
    textMuted: hexColor,
    border: hexColor,
    success: hexColor,
    warning: hexColor,
    danger: hexColor,
    info: hexColor,
    badgeTop: hexColor,
    badgeNew: hexColor,
    badgeDiscount: hexColor,
    badgeExcellent: hexColor,
  }),
  radii: z.object({
    button: z.number().int().min(0).max(40),
    card: z.number().int().min(0).max(40),
    input: z.number().int().min(0).max(40),
    modal: z.number().int().min(0).max(48),
    badge: z.number().int().min(0).max(999),
  }),
  typography: z.object({
    fontFamily: z.string().trim().min(2).max(160),
    h1Size: z.number().int().min(24).max(72),
    h2Size: z.number().int().min(20).max(56),
    h3Size: z.number().int().min(18).max(40),
    bodySize: z.number().int().min(14).max(24),
    smallSize: z.number().int().min(12).max(20),
    captionSize: z.number().int().min(10).max(18),
    priceSize: z.number().int().min(20).max(52),
    oldPriceSize: z.number().int().min(12).max(24),
    adminLabelSize: z.number().int().min(10).max(18),
    headingLineHeight: z.number().min(1).max(1.6),
    bodyLineHeight: z.number().min(1.2).max(2),
  }),
  controls: z.object({
    buttonHeight: z.number().int().min(36).max(72),
    inputHeight: z.number().int().min(36).max(72),
    iconButtonSize: z.number().int().min(32).max(72),
  }),
  effects: z.object({
    buttonShadow: shadowValue,
    cardShadow: shadowValue,
    modalShadow: shadowValue,
  }),
});

export type DesignTheme = z.infer<typeof designThemeSchema>;

export const designThemeDraftInputSchema = designThemeSchema.extend({
  changeNote: z.string().trim().max(255).default(""),
});

export type DesignThemeDraftInput = z.infer<typeof designThemeDraftInputSchema>;

export const designThemeHistoryEntrySchema = z.object({
  id: z.number().int().positive(),
  versionNumber: z.number().int().positive(),
  themeName: z.string(),
  actionType: z.string(),
  changeSummary: z.string().nullable(),
  changeDetails: z.array(z.string()).default([]),
  changedByUserId: z.number().int().nullable(),
  changedByDisplayName: z.string().nullable(),
  changedByRole: z.string().nullable(),
  createdAt: z.coerce.date(),
  publishedAt: z.coerce.date().nullable(),
  sourceVersionId: z.number().int().nullable(),
  isCurrent: z.boolean().default(false),
});

export type DesignThemeHistoryEntry = z.infer<typeof designThemeHistoryEntrySchema>;

export const defaultDesignTheme: DesignTheme = {
  meta: {
    name: "Techaks Default",
    description: "Базовая тема Техакс",
  },
  colors: {
    primary: "#05C3D4",
    brandDark: "#464A50",
    background: "#F8FAFB",
    surface: "#FFFFFF",
    surfaceMuted: "#F5F7F8",
    textMain: "#1F2933",
    textMuted: "#6B7280",
    border: "#D7E0E7",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    info: "#0EA5E9",
    badgeTop: "#F59E0B",
    badgeNew: "#05C3D4",
    badgeDiscount: "#EF4444",
    badgeExcellent: "#22C55E",
  },
  radii: {
    button: 12,
    card: 16,
    input: 12,
    modal: 24,
    badge: 999,
  },
  typography: {
    fontFamily: "Manrope, Inter, system-ui, sans-serif",
    h1Size: 40,
    h2Size: 28,
    h3Size: 22,
    bodySize: 16,
    smallSize: 14,
    captionSize: 12,
    priceSize: 34,
    oldPriceSize: 16,
    adminLabelSize: 12,
    headingLineHeight: 1.15,
    bodyLineHeight: 1.6,
  },
  controls: {
    buttonHeight: 44,
    inputHeight: 44,
    iconButtonSize: 44,
  },
  effects: {
    buttonShadow: "0 10px 24px rgba(5, 195, 212, 0.18)",
    cardShadow: "0 12px 32px rgba(15, 23, 42, 0.08)",
    modalShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
  },
};

export const designThemeTabKeys = [
  "overview",
  "colors",
  "typography",
  "buttons",
  "forms",
  "product-cards",
  "orders",
  "tables",
  "notifications",
  "icons",
  "theme",
  "history",
] as const;

export type DesignThemeTabKey = (typeof designThemeTabKeys)[number];
