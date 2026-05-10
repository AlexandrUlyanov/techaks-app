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

export function normalizeSpecKeyForDisplay(key: string): string {
  const normalized = key
    .trim()
    .replace(/^[-–—•*]+\s*/, "")
    .replace(/\s+/g, " ");
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

  const key = normalizeSpecKeyForDisplay(match[1]);
  const value = normalizeValue(match[2]);
  if (!key || !value) return null;

  return { key, value };
}

function extractInlineSpecs(line: string) {
  const keyRegex =
    /(?:^|[\s,;])([А-ЯЁ][а-яё]{2,}[A-Za-zА-Яа-яЁё0-9()./"«»\s]{0,77}?)\s*[:\-]\s*/g;
  const candidates: Array<{ key: string; start: number; valueStart: number }> =
    [];

  for (const match of line.matchAll(keyRegex)) {
    if (typeof match.index !== "number") continue;
    const rawKey = normalizeValue(match[1] ?? "");
    if (!rawKey) continue;

    const firstToken = rawKey.split(/\s+/)[0] ?? "";
    const firstTokenLetters = firstToken.replace(/[^A-Za-zА-Яа-яЁё]/g, "");
    if (firstTokenLetters.length < 3) continue;

    const keyStart = line.indexOf(rawKey, match.index);
    if (keyStart < 0) continue;

    candidates.push({
      key: normalizeSpecKeyForDisplay(rawKey),
      start: keyStart,
      valueStart: match.index + match[0].length,
    });
  }

  if (candidates.length === 0) return { specs: [], rest: line };

  const specs: Array<{ key: string; value: string }> = [];
  const ranges: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const current = candidates[i];
    const next = candidates[i + 1];
    const rawValue = line.slice(current.valueStart, next?.start ?? line.length);
    const value = normalizeValue(rawValue.replace(/^[,;.\s-]+|[,;.\s-]+$/g, ""));
    if (!value) continue;

    specs.push({ key: current.key, value });
    ranges.push({ start: current.start, end: next?.start ?? line.length });
  }

  if (specs.length === 0) return { specs: [], rest: line };

  let cursor = 0;
  const leftovers: string[] = [];
  for (const range of ranges) {
    if (range.start > cursor) leftovers.push(line.slice(cursor, range.start));
    cursor = range.end;
  }
  if (cursor < line.length) leftovers.push(line.slice(cursor));

  const rest = normalizeValue(
    leftovers.join(" ").replace(/^[,;.\s-]+|[,;.\s-]+$/g, "")
  );
  return { specs, rest };
}

export function previewProductNormalization(
  description: string,
  existingSpecs: unknown
): ProductNormalizationPreview {
  const currentSpecs =
    existingSpecs && typeof existingSpecs === "object" && !Array.isArray(existingSpecs)
      ? Object.fromEntries(
          Object.entries(existingSpecs as Record<string, unknown>).map(([key, value]) => [
            normalizeSpecKeyForDisplay(key),
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
      const inline = extractInlineSpecs(line);
      if (inline.specs.length > 0) {
        for (const pair of inline.specs) {
          parsedSpecs[pair.key] = pair.value;
        }
      }
      if (inline.rest) {
        textLines.push(inline.rest);
      }
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
