import { desc, eq, like, or, sql } from "drizzle-orm";
import {
  categories,
  listingDemandClusters,
  listingPages,
  searchClickLogs,
  searchLogs,
  searchTerms,
} from "@db/schema";
import { getDb } from "../queries/connection";

export const demandClusterIntents = [
  "commercial",
  "informational",
  "comparison",
  "mixed",
] as const;

export const demandClusterSources = [
  "manual",
  "internal_search",
  "search_terms",
  "yandex_wordstat",
  "yandex_webmaster",
  "imported",
] as const;

export type DemandClusterIntent = (typeof demandClusterIntents)[number];
export type DemandClusterSource = (typeof demandClusterSources)[number];

type ListingDemandClusterRow = typeof listingDemandClusters.$inferSelect;
type CategoryRow = typeof categories.$inferSelect;
type ListingPageRow = typeof listingPages.$inferSelect;

export type ListingDemandClusterViewModel = {
  id: number | null;
  listingPageId: number | null;
  primaryQuery: string;
  supportingQueries: string[];
  synonyms: string[];
  negatives: string[];
  intent: DemandClusterIntent;
  source: DemandClusterSource;
  sourceLabel: string | null;
  impressions: number;
  clicks: number;
  ctr: number | null;
  avgPosition: number | null;
  notes: string;
  lastImportedAt: Date | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

export type ListingDemandSignal = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number | null;
  source: "search_logs" | "search_terms";
  weight?: number;
  usageCount?: number;
};

function toFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeDemandText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitDemandTokens(values: string[]) {
  return Array.from(
    new Set(
      values
        .flatMap(value => normalizeDemandText(value).split(" "))
        .map(value => value.trim())
        .filter(value => value.length >= 3)
    )
  );
}

function uniqueQueryList(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = normalizeDemandText(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(value.trim());
  }
  return result;
}

function normalizeQueryArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return uniqueQueryList(value.map(item => String(item ?? "").trim()).filter(Boolean));
}

function mapDemandCluster(row: ListingDemandClusterRow | null): ListingDemandClusterViewModel | null {
  if (!row) return null;
  return {
    id: row.id,
    listingPageId: row.listingPageId,
    primaryQuery: row.primaryQuery ?? "",
    supportingQueries: normalizeQueryArray(row.supportingQueriesJson),
    synonyms: normalizeQueryArray(row.synonymsJson),
    negatives: normalizeQueryArray(row.negativesJson),
    intent: (row.intent as DemandClusterIntent | null) ?? "commercial",
    source: (row.source as DemandClusterSource | null) ?? "manual",
    sourceLabel: row.sourceLabel ?? null,
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: toFiniteNumber(row.ctr),
    avgPosition: toFiniteNumber(row.avgPosition),
    notes: row.notes ?? "",
    lastImportedAt: row.lastImportedAt ?? null,
    updatedAt: row.updatedAt ?? null,
    createdAt: row.createdAt ?? null,
  };
}

export async function getDemandClusterByListingPageId(listingPageId: number) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(listingDemandClusters)
    .where(eq(listingDemandClusters.listingPageId, listingPageId))
    .limit(1);
  return mapDemandCluster(row ?? null);
}

function buildFallbackPrimaryQuery(args: {
  category: CategoryRow;
  filterLabel?: string | null;
  filterValue?: string | null;
}) {
  if (args.filterLabel && args.filterValue) {
    return `${args.category.name} ${args.filterValue}`.trim();
  }
  return args.category.name;
}

async function fetchSearchLogSignals(phrases: string[]) {
  if (!phrases.length) return [] as ListingDemandSignal[];
  const db = getDb();
  const whereClause = or(
    ...phrases.map(phrase => like(searchLogs.normalizedQuery, `%${phrase}%`))
  );

  if (!whereClause) return [] as ListingDemandSignal[];

  const rows = await db
    .select({
      query: searchLogs.normalizedQuery,
      impressions: sql<number>`count(distinct ${searchLogs.id})`,
      clicks: sql<number>`count(${searchClickLogs.id})`,
      avgPosition: sql<number>`avg(${searchClickLogs.position})`,
    })
    .from(searchLogs)
    .leftJoin(searchClickLogs, eq(searchClickLogs.searchLogId, searchLogs.id))
    .where(whereClause)
    .groupBy(searchLogs.normalizedQuery)
    .orderBy(desc(sql<number>`count(distinct ${searchLogs.id})`))
    .limit(20);

  return rows.map(row => {
    const impressions = Number(row.impressions ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;
    return {
      query: row.query,
      impressions,
      clicks,
      ctr,
      avgPosition: toFiniteNumber(row.avgPosition),
      source: "search_logs" as const,
    };
  });
}

async function fetchSearchTermSignals(phrases: string[]) {
  if (!phrases.length) return [] as ListingDemandSignal[];
  const db = getDb();
  const whereClause = or(
    ...phrases.map(phrase => like(searchTerms.normalizedTerm, `%${phrase}%`))
  );

  if (!whereClause) return [] as ListingDemandSignal[];

  const rows = await db
    .select({
      term: searchTerms.term,
      usageCount: searchTerms.usageCount,
      weight: searchTerms.weight,
      source: searchTerms.source,
    })
    .from(searchTerms)
    .where(whereClause)
    .orderBy(desc(searchTerms.usageCount), desc(searchTerms.weight))
    .limit(20);

  return rows.map(row => ({
    query: row.term,
    impressions: Number(row.usageCount ?? 0),
    clicks: 0,
    ctr: 0,
    avgPosition: null,
    source: "search_terms" as const,
    usageCount: Number(row.usageCount ?? 0),
    weight: Number(row.weight ?? 0),
  }));
}

export async function buildDemandClusterDraft(args: {
  category: CategoryRow;
  listing: ListingPageRow | null;
  filterLabel?: string | null;
  filterValue?: string | null;
}) {
  const phrases = uniqueQueryList([
    args.category.name,
    args.category.slug.replace(/-/g, " "),
    args.listing?.h1 ?? "",
    args.listing?.title ?? "",
    args.filterLabel ?? "",
    args.filterValue ?? "",
    buildFallbackPrimaryQuery(args),
  ]);
  const tokens = splitDemandTokens(phrases);
  const matchPhrases = uniqueQueryList([...phrases.map(normalizeDemandText), ...tokens]).filter(Boolean);

  const [searchLogSignals, searchTermSignals] = await Promise.all([
    fetchSearchLogSignals(matchPhrases),
    fetchSearchTermSignals(matchPhrases),
  ]);

  const mergedQueries = uniqueQueryList([
    ...searchLogSignals.map(item => item.query),
    ...searchTermSignals.map(item => item.query),
  ]);

  const primaryQuery =
    mergedQueries[0] ?? buildFallbackPrimaryQuery(args);
  const supportingQueries = mergedQueries.filter(item => normalizeDemandText(item) !== normalizeDemandText(primaryQuery)).slice(0, 10);
  const impressions = searchLogSignals.reduce((sum, item) => sum + item.impressions, 0);
  const clicks = searchLogSignals.reduce((sum, item) => sum + item.clicks, 0);
  const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : null;

  const positionRows = searchLogSignals.filter(item => item.avgPosition !== null);
  const weightedPositionBase = positionRows.reduce(
    (sum, item) => sum + (item.avgPosition ?? 0) * Math.max(item.clicks, 1),
    0
  );
  const weightedPositionWeight = positionRows.reduce(
    (sum, item) => sum + Math.max(item.clicks, 1),
    0
  );
  const avgPosition =
    weightedPositionWeight > 0
      ? Number((weightedPositionBase / weightedPositionWeight).toFixed(2))
      : null;

  const source: DemandClusterSource = searchLogSignals.length
    ? "internal_search"
    : searchTermSignals.length
      ? "search_terms"
      : "manual";

  const sourceLabel =
    source === "internal_search"
      ? "Внутренний поиск сайта"
      : source === "search_terms"
        ? "Словарь search_terms"
        : "Ручной ввод";

  return {
    draft: {
      primaryQuery,
      supportingQueries,
      synonyms: [] as string[],
      negatives: [] as string[],
      intent: (args.filterValue ? "commercial" : "mixed") as DemandClusterIntent,
      source,
      sourceLabel,
      impressions,
      clicks,
      ctr,
      avgPosition,
      notes: "",
    },
    suggestions: {
      searchLogSignals,
      searchTermSignals,
    },
  };
}

export async function upsertDemandClusterForListingPage(args: {
  listingPageId: number;
  userId: number | null | undefined;
  data: {
    primaryQuery: string;
    supportingQueries: string[];
    synonyms: string[];
    negatives: string[];
    intent: DemandClusterIntent;
    source: DemandClusterSource;
    sourceLabel?: string | null;
    impressions?: number;
    clicks?: number;
    ctr?: number | null;
    avgPosition?: number | null;
    notes?: string | null;
    markImported?: boolean;
  };
}) {
  const db = getDb();
  const normalizedPayload = {
    primaryQuery: args.data.primaryQuery.trim(),
    supportingQueriesJson: uniqueQueryList(args.data.supportingQueries ?? []),
    synonymsJson: uniqueQueryList(args.data.synonyms ?? []),
    negativesJson: uniqueQueryList(args.data.negatives ?? []),
    intent: args.data.intent,
    source: args.data.source,
    sourceLabel: args.data.sourceLabel?.trim() || null,
    impressions: Math.max(0, Number(args.data.impressions ?? 0)),
    clicks: Math.max(0, Number(args.data.clicks ?? 0)),
    ctr:
      args.data.ctr === null || args.data.ctr === undefined
        ? null
        : args.data.ctr.toFixed(2),
    avgPosition:
      args.data.avgPosition === null || args.data.avgPosition === undefined
        ? null
        : args.data.avgPosition.toFixed(2),
    notes: args.data.notes?.trim() || null,
    updatedBy: args.userId ?? null,
    updatedAt: new Date(),
    ...(args.data.markImported ? { lastImportedAt: new Date() } : {}),
  };

  const [existing] = await db
    .select()
    .from(listingDemandClusters)
    .where(eq(listingDemandClusters.listingPageId, args.listingPageId))
    .limit(1);

  if (existing) {
    await db
      .update(listingDemandClusters)
      .set(normalizedPayload)
      .where(eq(listingDemandClusters.id, existing.id));
    return { before: existing, id: existing.id };
  }

  const result = await db.insert(listingDemandClusters).values({
    listingPageId: args.listingPageId,
    createdBy: args.userId ?? null,
    createdAt: new Date(),
    ...normalizedPayload,
  });

  return { before: null, id: result[0].insertId };
}
