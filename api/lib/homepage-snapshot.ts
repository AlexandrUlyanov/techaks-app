import { desc, eq } from "drizzle-orm";
import { homepageSnapshots } from "@db/schema";
import { getDb } from "../queries/connection";
import { buildHomepageData } from "./homepage-data";
import { defaultSiteProfileSettings } from "./site-profile-settings";

const SNAPSHOT_KEY = "default";
const SNAPSHOT_TTL_MS = 5 * 60 * 1000;

type HomepagePayload = Awaited<ReturnType<typeof buildHomepageData>>;

type SnapshotStatus = {
  hasSnapshot: boolean;
  generatedAt: string | null;
  buildMs: number | null;
  sourceVersion: string | null;
  lastError: string | null;
  ttlMinutes: number;
  isStale: boolean;
  ageSeconds: number | null;
  refreshInProgress: boolean;
};

let refreshPromise: Promise<HomepagePayload> | null = null;

const defaultPublicSiteProfile = {
  contacts: defaultSiteProfileSettings.contacts,
  seller: {
    legalForm: defaultSiteProfileSettings.seller.legalForm,
    fullName: defaultSiteProfileSettings.seller.fullName,
    shortName: defaultSiteProfileSettings.seller.shortName,
    legalAddress: defaultSiteProfileSettings.seller.legalAddress,
    actualAddress: defaultSiteProfileSettings.seller.actualAddress,
    inn: defaultSiteProfileSettings.seller.inn,
    ogrnip: defaultSiteProfileSettings.seller.ogrnip,
    kpp: defaultSiteProfileSettings.seller.kpp,
    okpo: defaultSiteProfileSettings.seller.okpo,
    email: defaultSiteProfileSettings.seller.email,
    phone: defaultSiteProfileSettings.seller.phone,
  },
  bank: defaultSiteProfileSettings.bank,
  documents: defaultSiteProfileSettings.documents,
  legalTexts: defaultSiteProfileSettings.legalTexts,
} satisfies HomepagePayload["siteProfile"];

function nowIso() {
  return new Date().toISOString();
}

function getSourceVersion() {
  return "homepage_snapshot_v1";
}

function ageMs(date: Date | string | null | undefined) {
  if (!date) return null;
  const value = new Date(date).getTime();
  if (!Number.isFinite(value)) return null;
  return Date.now() - value;
}

function isSnapshotStale(date: Date | string | null | undefined) {
  const age = ageMs(date);
  return age === null ? true : age >= SNAPSHOT_TTL_MS;
}

async function readSnapshotRow() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(homepageSnapshots)
    .where(eq(homepageSnapshots.snapshotKey, SNAPSHOT_KEY))
    .orderBy(desc(homepageSnapshots.updatedAt))
    .limit(1);

  return row ?? null;
}

async function writeSnapshot(payload: HomepagePayload, buildMs: number) {
  const db = getDb();
  const existing = await readSnapshotRow();
  const generatedAt = new Date();

  if (existing) {
    await db
      .update(homepageSnapshots)
      .set({
        payload,
        buildMs,
        sourceVersion: getSourceVersion(),
        lastError: null,
        generatedAt,
        updatedAt: generatedAt,
      })
      .where(eq(homepageSnapshots.id, existing.id));
    return;
  }

  await db.insert(homepageSnapshots).values({
    snapshotKey: SNAPSHOT_KEY,
    payload,
    buildMs,
    sourceVersion: getSourceVersion(),
    lastError: null,
    generatedAt,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  });
}

async function writeSnapshotError(message: string) {
  const db = getDb();
  const existing = await readSnapshotRow();
  const updatedAt = new Date();

  if (existing) {
    await db
      .update(homepageSnapshots)
      .set({
        lastError: message.slice(0, 4000),
        updatedAt,
      })
      .where(eq(homepageSnapshots.id, existing.id));
    return;
  }

  const fallbackPayload = {
    siteProfile: defaultPublicSiteProfile,
    hero: {
      variant: "classic" as const,
      slides: [],
      diagnostics: {
        activeSlides: 0,
        totalSlides: 0,
        resolvedTypes: [],
      },
    },
    maintenanceStatus: {
      isEnabled: false,
      reopenDate: null,
    },
    critical: {
      categories: [],
      weekProducts: [],
    },
    secondary: {
      featuredManufacturers: [],
      banners: [],
      stores: [],
      latestPosts: [],
      popularProducts: [],
    },
  } satisfies HomepagePayload;

  await db.insert(homepageSnapshots).values({
    snapshotKey: SNAPSHOT_KEY,
    payload: fallbackPayload,
    buildMs: 0,
    sourceVersion: getSourceVersion(),
    lastError: message.slice(0, 4000),
    generatedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  });
}

export async function refreshHomepageSnapshot() {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const startedAt = Date.now();
    try {
      const payload = await buildHomepageData();
      await writeSnapshot(payload, Date.now() - startedAt);
      return payload;
    } catch (error) {
      await writeSnapshotError(
        error instanceof Error ? error.message : "Не удалось пересобрать главную страницу."
      );
      throw error;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export function scheduleHomepageSnapshotRefresh() {
  if (refreshPromise) return refreshPromise;
  return refreshHomepageSnapshot().catch(() => null);
}

export async function getHomepageSnapshotStatus(): Promise<SnapshotStatus> {
  const row = await readSnapshotRow();
  const age = ageMs(row?.generatedAt);
  return {
    hasSnapshot: Boolean(row),
    generatedAt: row?.generatedAt ? new Date(row.generatedAt).toISOString() : null,
    buildMs: row?.buildMs ?? null,
    sourceVersion: row?.sourceVersion ?? null,
    lastError: row?.lastError ?? null,
    ttlMinutes: Math.round(SNAPSHOT_TTL_MS / 60000),
    isStale: isSnapshotStale(row?.generatedAt),
    ageSeconds: age === null ? null : Math.max(0, Math.round(age / 1000)),
    refreshInProgress: Boolean(refreshPromise),
  };
}

export async function getHomepagePageData() {
  const row = await readSnapshotRow();

  if (row?.payload) {
    const stale = isSnapshotStale(row.generatedAt);
    if (stale) {
      void scheduleHomepageSnapshotRefresh();
    }

    return {
      ...(row.payload as HomepagePayload),
      cache: {
        cacheStatus: stale ? ("stale" as const) : ("snapshot" as const),
        generatedAt: new Date(row.generatedAt).toISOString(),
        expiresAt: new Date(
          new Date(row.generatedAt).getTime() + SNAPSHOT_TTL_MS
        ).toISOString(),
        sourceVersion: row.sourceVersion || getSourceVersion(),
        refreshedInBackground: stale,
      },
    };
  }

  const payload = await refreshHomepageSnapshot();
  return {
    ...payload,
    cache: {
      cacheStatus: "built" as const,
      generatedAt: nowIso(),
      expiresAt: new Date(Date.now() + SNAPSHOT_TTL_MS).toISOString(),
      sourceVersion: getSourceVersion(),
      refreshedInBackground: false,
    },
  };
}
