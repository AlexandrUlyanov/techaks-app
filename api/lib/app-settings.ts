import { eq, inArray } from "drizzle-orm";
import { appSettings } from "@db/schema";
import { getDb } from "../queries/connection";

export async function getAppSetting(key: string): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key))
    .limit(1);

  return row?.value ?? null;
}

export async function getAppSettings(
  keys: string[]
): Promise<Record<string, string | null>> {
  if (keys.length === 0) return {};

  const db = getDb();
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, keys));

  const map: Record<string, string | null> = {};
  for (const key of keys) {
    map[key] = null;
  }
  for (const row of rows) {
    map[row.key] = row.value ?? null;
  }

  return map;
}

export async function setAppSetting(key: string, value: string | null) {
  const db = getDb();
  const updatedAt = new Date();
  await db
    .insert(appSettings)
    .values({
      key,
      value,
      updatedAt,
    })
    .onDuplicateKeyUpdate({
      set: {
        value,
        updatedAt,
      },
    });

  return { success: true };
}
