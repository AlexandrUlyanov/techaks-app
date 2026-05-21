import { desc, eq } from "drizzle-orm";
import {
  defaultAdminDesignTheme,
  defaultDesignThemeBundle,
  defaultSiteDarkDesignTheme,
  defaultSiteLightDesignTheme,
  designThemeBundleSchema,
  designThemeHistoryEntrySchema,
  designThemeSchema,
  type DesignTheme,
  type DesignThemeBundle,
} from "@contracts/design-system";
import { designThemeVersions } from "@db/schema";
import { getDb } from "../queries/connection";
import { getAppSetting, setAppSetting } from "./app-settings";

const DESIGN_THEME_PUBLISHED_KEY = "design_theme_published";
const DESIGN_THEME_DRAFT_KEY = "design_theme_draft";

type ThemeActor = {
  id: number;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
};

function cloneThemeBundle(theme: DesignThemeBundle): DesignThemeBundle {
  return JSON.parse(JSON.stringify(theme)) as DesignThemeBundle;
}

function getActorLabel(actor: ThemeActor) {
  return actor.fullName?.trim() || actor.email?.trim() || `User #${actor.id}`;
}

function normalizeLegacyTheme(theme: DesignTheme): DesignThemeBundle {
  return {
    meta: {
      name: theme.meta.name || defaultDesignThemeBundle.meta.name,
      description: theme.meta.description || defaultDesignThemeBundle.meta.description,
    },
    siteLight: theme,
    siteDark: cloneThemeBundle(defaultDesignThemeBundle).siteDark,
    admin: cloneThemeBundle(defaultDesignThemeBundle).admin,
  };
}

function safeParseThemeBundle(value: string | null | undefined): DesignThemeBundle | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    const bundleResult = designThemeBundleSchema.safeParse(parsed);
    if (bundleResult.success) {
      return bundleResult.data;
    }

    const legacyResult = designThemeSchema.safeParse(parsed);
    if (legacyResult.success) {
      return normalizeLegacyTheme(legacyResult.data);
    }
  } catch {
    return null;
  }

  return null;
}

function safeParseThemeBundleFromUnknown(value: unknown): DesignThemeBundle | null {
  const bundleResult = designThemeBundleSchema.safeParse(value);
  if (bundleResult.success) {
    return bundleResult.data;
  }

  const legacyResult = designThemeSchema.safeParse(value);
  if (legacyResult.success) {
    return normalizeLegacyTheme(legacyResult.data);
  }

  return null;
}

function walkThemeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  prefix = ""
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changes: string[] = [];

  for (const key of keys) {
    const path = prefix ? `${prefix}.${key}` : key;
    const oldValue = before[key];
    const newValue = after[key];

    const oldIsObject =
      oldValue && typeof oldValue === "object" && !Array.isArray(oldValue);
    const newIsObject =
      newValue && typeof newValue === "object" && !Array.isArray(newValue);

    if (oldIsObject && newIsObject) {
      changes.push(
        ...walkThemeDiff(
          oldValue as Record<string, unknown>,
          newValue as Record<string, unknown>,
          path
        )
      );
      continue;
    }

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      changes.push(path);
    }
  }

  return changes;
}

function buildChangeSummary(changeNote: string, changes: string[]) {
  const trimmedNote = changeNote.trim();
  if (trimmedNote) return trimmedNote;
  if (changes.length === 0) return "Без визуальных изменений";
  if (changes.length === 1) return `Изменён токен ${changes[0]}`;
  if (changes.length <= 3) return `Изменены токены: ${changes.join(", ")}`;
  return `Изменено ${changes.length} дизайн-токенов`;
}

async function getLatestVersionNumber() {
  const db = getDb();
  const [row] = await db
    .select({ versionNumber: designThemeVersions.versionNumber })
    .from(designThemeVersions)
    .orderBy(desc(designThemeVersions.versionNumber))
    .limit(1);

  return row?.versionNumber ?? 0;
}

export async function getPublishedDesignTheme() {
  const stored = safeParseThemeBundle(await getAppSetting(DESIGN_THEME_PUBLISHED_KEY));
  return stored ? cloneThemeBundle(stored) : cloneThemeBundle(defaultDesignThemeBundle);
}

export async function getDraftDesignTheme() {
  const stored = safeParseThemeBundle(await getAppSetting(DESIGN_THEME_DRAFT_KEY));
  if (stored) return cloneThemeBundle(stored);
  return getPublishedDesignTheme();
}

export async function getDesignThemeHistory(limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(designThemeVersions)
    .orderBy(desc(designThemeVersions.versionNumber))
    .limit(limit);

  const published = await getPublishedDesignTheme();
  const publishedJson = JSON.stringify(published);

  return rows
    .map(row => {
      const parsedTheme = safeParseThemeBundleFromUnknown(row.themeJson);
      if (!parsedTheme) return null;

      return designThemeHistoryEntrySchema.parse({
        id: row.id,
        versionNumber: row.versionNumber,
        themeName: row.themeName,
        actionType: row.actionType,
        changeSummary: row.changeSummary,
        changeDetails: Array.isArray(row.changeDetailsJson) ? row.changeDetailsJson : [],
        changedByUserId: row.changedByUserId ?? null,
        changedByDisplayName: row.changedByDisplayName ?? null,
        changedByRole: row.changedByRole ?? null,
        createdAt: row.createdAt,
        publishedAt: row.publishedAt ?? null,
        sourceVersionId: row.sourceVersionId ?? null,
        isCurrent: JSON.stringify(parsedTheme) === publishedJson,
      });
    })
    .filter(
      (
        entry
      ): entry is ReturnType<typeof designThemeHistoryEntrySchema.parse> => Boolean(entry)
    );
}

export async function getDesignSystemAdminState() {
  const [publishedTheme, draftTheme, history] = await Promise.all([
    getPublishedDesignTheme(),
    getDraftDesignTheme(),
    getDesignThemeHistory(),
  ]);

  return {
    defaultTheme: cloneThemeBundle(defaultDesignThemeBundle),
    publishedTheme,
    draftTheme,
    history,
  };
}

export async function saveDesignThemeDraft(input: {
  theme: DesignThemeBundle;
}) {
  const parsed = designThemeBundleSchema.parse(input.theme);
  await setAppSetting(DESIGN_THEME_DRAFT_KEY, JSON.stringify(parsed));
  return { success: true, draftTheme: parsed };
}

export async function resetDesignThemeDraft() {
  await setAppSetting(DESIGN_THEME_DRAFT_KEY, JSON.stringify(defaultDesignThemeBundle));
  return { success: true, draftTheme: cloneThemeBundle(defaultDesignThemeBundle) };
}

async function persistPublishedVersion(args: {
  actionType: "publish" | "rollback";
  theme: DesignThemeBundle;
  changeSummary: string;
  changeDetails: string[];
  actor: ThemeActor;
  sourceVersionId?: number | null;
}) {
  const db = getDb();
  const versionNumber = (await getLatestVersionNumber()) + 1;
  const now = new Date();

  await db.insert(designThemeVersions).values({
    versionNumber,
    themeName: args.theme.meta.name,
    actionType: args.actionType,
    themeJson: args.theme,
    changeSummary: args.changeSummary,
    changeDetailsJson: args.changeDetails,
    changedByUserId: args.actor.id,
    changedByDisplayName: getActorLabel(args.actor),
    changedByRole: args.actor.role ?? null,
    sourceVersionId: args.sourceVersionId ?? null,
    publishedAt: now,
    createdAt: now,
  });

  await setAppSetting(DESIGN_THEME_PUBLISHED_KEY, JSON.stringify(args.theme));
  await setAppSetting(DESIGN_THEME_DRAFT_KEY, JSON.stringify(args.theme));

  return { success: true, versionNumber, publishedAt: now };
}

export async function publishDesignThemeDraft(args: {
  changeNote?: string;
  actor: ThemeActor;
}) {
  const [publishedTheme, draftTheme] = await Promise.all([
    getPublishedDesignTheme(),
    getDraftDesignTheme(),
  ]);

  const changeDetails = walkThemeDiff(publishedTheme, draftTheme);
  const changeSummary = buildChangeSummary(args.changeNote ?? "", changeDetails);

  return persistPublishedVersion({
    actionType: "publish",
    theme: draftTheme,
    changeSummary,
    changeDetails,
    actor: args.actor,
  });
}

export async function rollbackDesignThemeVersion(args: {
  versionId: number;
  actor: ThemeActor;
}) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(designThemeVersions)
    .where(eq(designThemeVersions.id, args.versionId))
    .limit(1);

  if (!row) {
    throw new Error("Версия темы не найдена.");
  }

  const theme = safeParseThemeBundleFromUnknown(row.themeJson);
  if (!theme) {
    throw new Error("Сохранённая версия темы повреждена.");
  }

  const currentPublishedTheme = await getPublishedDesignTheme();
  const changeDetails = walkThemeDiff(currentPublishedTheme, theme);

  return persistPublishedVersion({
    actionType: "rollback",
    theme,
    changeSummary: `Откат к версии ${row.versionNumber}`,
    changeDetails,
    actor: args.actor,
    sourceVersionId: row.id,
  });
}

export function getDefaultThemeForScope(scope: "siteLight" | "siteDark" | "admin") {
  if (scope === "siteDark") return defaultSiteDarkDesignTheme;
  if (scope === "admin") return defaultAdminDesignTheme;
  return defaultSiteLightDesignTheme;
}
