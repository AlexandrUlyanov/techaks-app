import { eq, inArray } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { getAppSettings, setAppSetting } from "./app-settings";
import { getMoyskladClient } from "./moysklad-client";

export const MOYSKLAD_PUBLICATION_KEYS = {
  fieldId: "moysklad_publication_field_id",
  fieldName: "moysklad_publication_field_name",
  strict: "moysklad_publication_strict_mode",
  hideDisabled: "moysklad_publication_hide_disabled",
  lastCheck: "moysklad_publication_last_check",
} as const;

export type MoyskladPublicationConfig = {
  fieldId: string;
  fieldName: string;
  strictMode: boolean;
  hideDisabled: boolean;
};

type MoyskladPublicationCheck = {
  ok?: boolean;
  fieldId?: string;
  checkedAt?: string;
};

type MsAttribute = {
  id?: string;
  name?: string;
  type?: string;
  value?: unknown;
  meta?: { href?: string };
};

type MsProduct = { id?: string; attributes?: MsAttribute[] };

function attributeId(attribute: MsAttribute) {
  return attribute.id || attribute.meta?.href?.split("/").pop()?.split("?")[0] || "";
}

export async function getMoyskladPublicationConfig(): Promise<MoyskladPublicationConfig> {
  const values = await getAppSettings(Object.values(MOYSKLAD_PUBLICATION_KEYS));
  return {
    fieldId: values[MOYSKLAD_PUBLICATION_KEYS.fieldId]?.trim() || "",
    fieldName: values[MOYSKLAD_PUBLICATION_KEYS.fieldName]?.trim() || "Выгружать на сайт",
    strictMode: values[MOYSKLAD_PUBLICATION_KEYS.strict] === "true",
    hideDisabled: values[MOYSKLAD_PUBLICATION_KEYS.hideDisabled] !== "false",
  };
}

export function getPublicationValue(product: MsProduct, fieldId: string) {
  const attribute = product.attributes?.find(item => attributeId(item) === fieldId);
  return attribute?.value === true;
}

export async function resolveMoyskladPublicationField(config?: MoyskladPublicationConfig) {
  const resolvedConfig = config ?? await getMoyskladPublicationConfig();
  const client = await getMoyskladClient();
  const response = await client.get<{ rows?: MsAttribute[] }>("/entity/product/metadata/attributes");
  const rows = response.rows || [];
  const field = rows.find(item => attributeId(item) === resolvedConfig.fieldId) ||
    rows.find(item => item.name?.trim().toLowerCase() === resolvedConfig.fieldName.toLowerCase());
  if (!field) throw new Error(`В МойСклад не найдено поле «${resolvedConfig.fieldName}». Публикация не изменялась.`);
  if (field.type !== "boolean") throw new Error(`Поле «${resolvedConfig.fieldName}» должно иметь тип «Флажок».`);
  const id = attributeId(field);
  if (!id) throw new Error(`Не удалось определить ID поля «${resolvedConfig.fieldName}».`);
  return { id, name: field.name || resolvedConfig.fieldName };
}

export async function checkMoyskladPublicationField() {
  const config = await getMoyskladPublicationConfig();
  const field = await resolveMoyskladPublicationField(config);
  const client = await getMoyskladClient();
  let offset = 0;
  const limit = 1000;
  const stats = { allowed: 0, disabled: 0, unset: 0, existingWouldHide: 0, newWouldSkip: 0, errors: 0 };
  const all: MsProduct[] = [];
  while (true) {
    const page = await client.get<{ rows?: MsProduct[] }>("/entity/product", { limit, offset });
    const rows = page.rows || [];
    all.push(...rows);
    if (rows.length < limit) break;
    offset += limit;
  }
  const remoteIds = all.map(row => row.id).filter((id): id is string => Boolean(id));
  const localRows = remoteIds.length ? await getDb().select({ msId: schema.products.msId }).from(schema.products)
    .where(inArray(schema.products.msId, remoteIds)) : [];
  const localIds = new Set(localRows.map(row => row.msId));
  for (const product of all) {
    const attribute = product.attributes?.find(item => attributeId(item) === field.id);
    if (!attribute) stats.unset += 1;
    else if (attribute.value === true) stats.allowed += 1;
    else stats.disabled += 1;
    if (attribute?.value !== true) {
      if (product.id && localIds.has(product.id)) stats.existingWouldHide += 1;
      else stats.newWouldSkip += 1;
    }
  }
  const result = { ok: true, fieldId: field.id, fieldName: field.name, checkedAt: new Date().toISOString(), stats };
  await setAppSetting(MOYSKLAD_PUBLICATION_KEYS.fieldId, field.id);
  await setAppSetting(MOYSKLAD_PUBLICATION_KEYS.fieldName, field.name);
  await setAppSetting(MOYSKLAD_PUBLICATION_KEYS.lastCheck, JSON.stringify(result));
  return result;
}

export async function assertMoyskladPublicationChecked(fieldId: string) {
  const values = await getAppSettings([MOYSKLAD_PUBLICATION_KEYS.lastCheck]);
  const raw = values[MOYSKLAD_PUBLICATION_KEYS.lastCheck];
  let lastCheck: MoyskladPublicationCheck | null = null;
  try {
    lastCheck = raw ? JSON.parse(raw) as MoyskladPublicationCheck : null;
  } catch {
    lastCheck = null;
  }

  const checkedAt = lastCheck?.checkedAt ? Date.parse(lastCheck.checkedAt) : NaN;
  const maxAgeMs = 24 * 60 * 60 * 1000;
  if (
    lastCheck?.ok !== true ||
    lastCheck.fieldId !== fieldId ||
    !Number.isFinite(checkedAt) ||
    Date.now() - checkedAt > maxAgeMs
  ) {
    throw new Error(
      "Перед включением строгого режима выполните проверку поля. Проверка должна относиться к выбранному ID и быть не старше 24 часов."
    );
  }
}

export async function applyPublicationToExistingProduct(msId: string, allowed: boolean) {
  await getDb().update(schema.products)
    .set({ isPublishedFromMoySklad: allowed })
    .where(eq(schema.products.msId, msId));
}
