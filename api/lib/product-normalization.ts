type Specs = Record<string, string>;

export type SpecConflict = {
  key: string;
  existingValue: string;
  parsedValue: string;
};

export type ProductNormalizationPreview = {
  parsedSpecs: Specs;
  mergedSpecs: Specs;
  newDescription: string;
  movedSpecCount: number;
  conflicts: SpecConflict[];
  changed: boolean;
};

const KEY_ALIASES: Record<string, string> = {
  "прозводитель": "Производитель",
  "производители": "Производитель",
  "материалы": "Материал",
  "цвета": "Цвет",
  "тип товара": "Тип",
  "тип устройства": "Тип",
};

function normalizeAliasKey(key: string): string {
  const normalized = key.trim().replace(/\s+/g, " ");
  return KEY_ALIASES[normalized.toLowerCase().replace(/ё/g, "е")] ?? normalized;
}

function normalizeValue(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeSpecToken(value: unknown): string {
  return normalizeValue(value)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function isSpecLine(line: string) {
  const match = line.match(/^\s*([^:]{2,80}):\s*(\S.*)\s*$/);
  if (!match) return null;

  const key = normalizeAliasKey(match[1]);
  const value = normalizeValue(match[2]);
  if (!key || !value) return null;

  return { key, value };
}

export function previewProductNormalization(
  description: string,
  existingSpecs: unknown
): ProductNormalizationPreview {
  const currentSpecs =
    existingSpecs && typeof existingSpecs === "object" && !Array.isArray(existingSpecs)
      ? Object.fromEntries(
          Object.entries(existingSpecs as Record<string, unknown>).map(([key, value]) => [
            normalizeAliasKey(key),
            normalizeValue(value),
          ])
        )
      : {};

  const parsedSpecs: Specs = {};
  const textLines: string[] = [];

  for (const rawLine of (description || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const spec = isSpecLine(line);
    if (spec) {
      parsedSpecs[spec.key] = spec.value;
    } else {
      textLines.push(line);
    }
  }

  const mergedSpecs: Specs = { ...currentSpecs };
  const conflicts: SpecConflict[] = [];
  let movedSpecCount = 0;

  for (const [key, parsedValue] of Object.entries(parsedSpecs)) {
    const existingValue = mergedSpecs[key];
    if (!existingValue) {
      mergedSpecs[key] = parsedValue;
      movedSpecCount++;
      continue;
    }

    if (normalizeValue(existingValue) !== normalizeValue(parsedValue)) {
      conflicts.push({ key, existingValue, parsedValue });
    }
  }

  const newDescription = textLines.join("\n");

  return {
    parsedSpecs,
    mergedSpecs,
    newDescription,
    movedSpecCount,
    conflicts,
    changed:
      movedSpecCount > 0 ||
      conflicts.length > 0 ||
      newDescription.trim() !== (description || "").trim(),
  };
}
