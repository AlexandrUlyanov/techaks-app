import type { DesignTheme } from "@contracts/design-system";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const int = Number.parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function hexToHsl(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;

  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation =
      delta / (1 - Math.abs(2 * lightness - 1));

    switch (max) {
      case red:
        hue = ((green - blue) / delta) % 6;
        break;
      case green:
        hue = (blue - red) / delta + 2;
        break;
      default:
        hue = (red - green) / delta + 4;
        break;
    }
  }

  const h = Math.round((hue * 60 + 360) % 360);
  const s = Math.round(saturation * 100);
  const l = Math.round(lightness * 100);

  return `${h} ${s}% ${l}%`;
}

function getContrastColor(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.65 ? "#111827" : "#FFFFFF";
}

export function buildThemeCssVariables(theme: DesignTheme) {
  const surfaceForeground = theme.colors.textMain;
  const primaryForeground = getContrastColor(theme.colors.primary);
  const secondaryForeground = theme.colors.textMain;
  const accentForeground = getContrastColor(theme.colors.primary);
  const destructiveForeground = getContrastColor(theme.colors.danger);

  return {
    "--tech-color-primary": theme.colors.primary,
    "--tech-color-primary-foreground": primaryForeground,
    "--tech-color-brand-dark": theme.colors.brandDark,
    "--tech-color-background": theme.colors.background,
    "--tech-color-surface": theme.colors.surface,
    "--tech-color-surface-muted": theme.colors.surfaceMuted,
    "--tech-color-text-main": theme.colors.textMain,
    "--tech-color-text-muted": theme.colors.textMuted,
    "--tech-color-border": theme.colors.border,
    "--tech-color-success": theme.colors.success,
    "--tech-color-warning": theme.colors.warning,
    "--tech-color-danger": theme.colors.danger,
    "--tech-color-info": theme.colors.info,
    "--tech-color-badge-top": theme.colors.badgeTop,
    "--tech-color-badge-new": theme.colors.badgeNew,
    "--tech-color-badge-discount": theme.colors.badgeDiscount,
    "--tech-color-badge-excellent": theme.colors.badgeExcellent,
    "--tech-radius-button": `${theme.radii.button}px`,
    "--tech-radius-card": `${theme.radii.card}px`,
    "--tech-radius-input": `${theme.radii.input}px`,
    "--tech-radius-modal": `${theme.radii.modal}px`,
    "--tech-radius-badge": `${theme.radii.badge}px`,
    "--tech-font-family": theme.typography.fontFamily,
    "--tech-font-size-h1": `${theme.typography.h1Size}px`,
    "--tech-font-size-h2": `${theme.typography.h2Size}px`,
    "--tech-font-size-h3": `${theme.typography.h3Size}px`,
    "--tech-font-size-body": `${theme.typography.bodySize}px`,
    "--tech-font-size-small": `${theme.typography.smallSize}px`,
    "--tech-font-size-caption": `${theme.typography.captionSize}px`,
    "--tech-font-size-price": `${theme.typography.priceSize}px`,
    "--tech-font-size-old-price": `${theme.typography.oldPriceSize}px`,
    "--tech-font-size-admin-label": `${theme.typography.adminLabelSize}px`,
    "--tech-line-height-heading": String(theme.typography.headingLineHeight),
    "--tech-line-height-body": String(theme.typography.bodyLineHeight),
    "--tech-control-height-button": `${theme.controls.buttonHeight}px`,
    "--tech-control-height-input": `${theme.controls.inputHeight}px`,
    "--tech-control-size-icon-button": `${theme.controls.iconButtonSize}px`,
    "--tech-shadow-button": theme.effects.buttonShadow,
    "--tech-shadow-card": theme.effects.cardShadow,
    "--tech-shadow-modal": theme.effects.modalShadow,

    "--background": hexToHsl(theme.colors.background),
    "--foreground": hexToHsl(theme.colors.textMain),
    "--card": hexToHsl(theme.colors.surface),
    "--card-foreground": hexToHsl(surfaceForeground),
    "--popover": hexToHsl(theme.colors.surface),
    "--popover-foreground": hexToHsl(surfaceForeground),
    "--primary": hexToHsl(theme.colors.primary),
    "--primary-foreground": hexToHsl(primaryForeground),
    "--secondary": hexToHsl(theme.colors.surfaceMuted),
    "--secondary-foreground": hexToHsl(secondaryForeground),
    "--muted": hexToHsl(theme.colors.surfaceMuted),
    "--muted-foreground": hexToHsl(theme.colors.textMuted),
    "--accent": hexToHsl(theme.colors.primary),
    "--accent-foreground": hexToHsl(accentForeground),
    "--destructive": hexToHsl(theme.colors.danger),
    "--destructive-foreground": hexToHsl(destructiveForeground),
    "--border": hexToHsl(theme.colors.border),
    "--input": hexToHsl(theme.colors.border),
    "--ring": hexToHsl(theme.colors.primary),
    "--radius": `${clamp(theme.radii.card / 16, 0.5, 2)}rem`,
  } satisfies Record<string, string>;
}

export function applyThemeToElement(element: HTMLElement, theme: DesignTheme) {
  const variables = buildThemeCssVariables(theme);
  for (const [key, value] of Object.entries(variables)) {
    element.style.setProperty(key, value);
  }
}
