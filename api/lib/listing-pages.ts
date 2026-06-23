import { and, desc, eq, sql } from "drizzle-orm";
import {
  categories,
  listingAuditLogs,
  listingPages,
  products,
  productSpecRules,
  productSpecValues,
  users,
} from "@db/schema";
import { getDb } from "../queries/connection";
import { buildPublicProductVisibilityCondition } from "./product-visibility";
import { filterPublicVisibleCategories } from "./category-visibility";

export const listingIndexationModes = [
  "index",
  "noindex",
  "canonical_to_parent",
  "exclude_from_sitemap",
] as const;

export const listingSeoStatuses = ["empty", "draft", "ready", "published"] as const;
export const listingDuplicateRisks = ["low", "medium", "high"] as const;

export type ListingIndexationMode = (typeof listingIndexationModes)[number];
export type ListingSeoStatus = (typeof listingSeoStatuses)[number];
export type ListingDuplicateRisk = (typeof listingDuplicateRisks)[number];

type CategoryRow = typeof categories.$inferSelect;
type ListingRow = typeof listingPages.$inferSelect;
const publicProductVisibilityCondition = buildPublicProductVisibilityCondition();

const FILTER_LANDING_WHITELIST = new Set([
  "тип",
  "производитель",
  "бренд",
  "цвет",
  "материал",
  "мощность",
  "емкость",
  "разъем",
  "подключение",
  "совместимость",
  "длина",
  "форма",
  "назначение",
]);

export type ListingFilterCandidate = {
  key: string;
  normalizedKey: string;
  value: string;
  normalizedValue: string;
  productCount: number;
  existingListingId: number | null;
  existingIndexationMode: ListingIndexationMode | null;
  existingIsPublished: boolean | null;
};

export type ListingQualityCategoryIssue = {
  type:
    | "empty_category"
    | "missing_meta"
    | "thin_content"
    | "manual_duplicate_review"
    | "published_noindex";
  label: string;
};

export type ListingQualityFilterIssue = {
  type:
    | "high_demand_unpublished"
    | "high_demand_noindex"
    | "high_duplicate_risk";
  label: string;
};

export type ListingQualityDashboard = {
  summary: {
    totalCategories: number;
    indexableCategories: number;
    emptyCategories: number;
    categoriesMissingMeta: number;
    categoriesThinContent: number;
    categoriesNeedDuplicateReview: number;
    categoriesPublishedNoindex: number;
    highDemandFilterCandidates: number;
    highDemandFilterUnpublished: number;
    highDemandFilterNoindex: number;
    highRiskFilterCandidates: number;
    canonicalConflicts: number;
  };
  categoryIssues: Array<{
    categoryId: number;
    categoryName: string;
    categorySlug: string;
    productCount: number;
    indexationMode: ListingIndexationMode;
    contentScore: number;
    duplicateRisk: ListingDuplicateRisk;
    issues: ListingQualityCategoryIssue[];
    url: string;
  }>;
  filterIssues: Array<{
    categoryId: number;
    categoryName: string;
    categorySlug: string;
    filterKey: string;
    filterLabel: string;
    filterValue: string;
    productCount: number;
    duplicateRisk: ListingDuplicateRisk;
    existingListingId: number | null;
    existingIndexationMode: ListingIndexationMode | null;
    existingIsPublished: boolean | null;
    issues: ListingQualityFilterIssue[];
    url: string;
  }>;
  canonicalConflicts: Array<{
    canonicalUrl: string;
    listings: Array<{
      id: number;
      type: string;
      categoryId: number;
      url: string;
    }>;
  }>;
};

export type ListingAuditEvent = {
  id: number;
  listingPageId: number | null;
  actorUserId: number | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  beforeJson: unknown;
  afterJson: unknown;
  metaJson: unknown;
  createdAt: Date;
};

export function trimOrNull(value?: string | null) {
  const next = value?.trim();
  return next ? next : null;
}

export function buildCategoryListingUrl(categorySlug: string) {
  return `/catalog?cat=${categorySlug}`;
}

export function buildCategoryListingTitle(categoryName: string) {
  return `${categoryName} — каталог товаров ТЕХАКС`;
}

export function buildCategoryListingDescription(categoryName: string) {
  return `${categoryName} в интернет-магазине ТЕХАКС: актуальные товары, наличие в магазинах и удобный переход к нужным разделам.`;
}

export function buildFilterListingUrl(
  categorySlug: string,
  filterKey: string,
  filterValue: string
) {
  const params = new URLSearchParams();
  params.set("cat", categorySlug);
  params.append("filter", `${filterKey}:${filterValue}`);
  return `/catalog?${params.toString()}`;
}

export function buildFilterListingTitle(
  categoryName: string,
  filterLabel: string,
  filterValue: string
) {
  return `${categoryName} — ${filterValue} (${filterLabel}) | ТЕХАКС`;
}

export function buildFilterListingDescription(
  categoryName: string,
  filterLabel: string,
  filterValue: string
) {
  return `${categoryName}: подборка товаров по фильтру «${filterLabel}: ${filterValue}» в интернет-магазине ТЕХАКС. Актуальные цены, наличие и самовывоз.`;
}

export function scoreListingContent(fields: {
  title?: string | null;
  metaDescription?: string | null;
  h1?: string | null;
  introText?: string | null;
  bottomText?: string | null;
}) {
  const weights = [
    fields.title ? 24 : 0,
    fields.metaDescription ? 22 : 0,
    fields.h1 ? 18 : 0,
    fields.introText ? 22 : 0,
    fields.bottomText ? 14 : 0,
  ];
  return Math.min(100, weights.reduce((sum, item) => sum + item, 0));
}

export function deriveListingSeoStatus(score: number): ListingSeoStatus {
  if (score >= 85) return "published";
  if (score >= 55) return "ready";
  if (score >= 20) return "draft";
  return "empty";
}

export function normalizeCanonicalUrl(
  canonicalUrl?: string | null
): string | null {
  const value = canonicalUrl?.trim();
  if (!value) return null;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  return value.startsWith("/") ? value : `/${value}`;
}

export function shouldNoindexCategoryListing(
  indexationMode?: string | null
): boolean {
  return indexationMode === "noindex";
}

export function shouldIncludeCategoryListingInSitemap(
  listing: ListingRow | null | undefined
) {
  if (!listing || !listing.isPublished) return true;
  return listing.indexationMode === "index";
}

export async function writeListingAuditEvent(args: {
  listingPageId: number;
  actorUserId?: number | null;
  action: string;
  before?: unknown;
  after?: unknown;
  meta?: unknown;
}) {
  const db = getDb();
  await db.insert(listingAuditLogs).values({
    listingPageId: args.listingPageId,
    actorUserId: args.actorUserId ?? null,
    action: args.action,
    beforeJson: args.before ?? null,
    afterJson: args.after ?? null,
    metaJson: args.meta ?? null,
    createdAt: new Date(),
  });
}

export async function getListingAuditTrail(
  listingPageId: number,
  limit = 20
): Promise<ListingAuditEvent[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: listingAuditLogs.id,
      listingPageId: listingAuditLogs.listingPageId,
      actorUserId: listingAuditLogs.actorUserId,
      actorName: users.fullName,
      actorEmail: users.email,
      action: listingAuditLogs.action,
      beforeJson: listingAuditLogs.beforeJson,
      afterJson: listingAuditLogs.afterJson,
      metaJson: listingAuditLogs.metaJson,
      createdAt: listingAuditLogs.createdAt,
    })
    .from(listingAuditLogs)
    .leftJoin(users, eq(users.id, listingAuditLogs.actorUserId))
    .where(eq(listingAuditLogs.listingPageId, listingPageId))
    .orderBy(desc(listingAuditLogs.createdAt))
    .limit(limit);

  return rows.map(row => ({
    ...row,
    actorName: row.actorName ?? null,
    actorEmail: row.actorEmail ?? null,
    createdAt: row.createdAt ?? new Date(),
  }));
}

function collectDescendantCategoryIds(
  allCategories: CategoryRow[],
  categoryId: number
) {
  const ids = [categoryId];
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop()!;
    const children = allCategories
      .filter(category => category.parentId === current)
      .map(category => category.id);
    for (const childId of children) {
      ids.push(childId);
      stack.push(childId);
    }
  }

  return ids;
}

function collectAncestorCategoryIds(
  allCategories: CategoryRow[],
  categoryId: number
) {
  const byId = new Map(allCategories.map(category => [category.id, category]));
  const ids: number[] = [];
  let currentId: number | null = categoryId;

  while (currentId) {
    const category = byId.get(currentId);
    if (!category) break;
    ids.unshift(category.id);
    currentId = category.parentId ?? null;
  }

  return ids;
}

function buildMergedSpecRulesForCategory(
  allCategories: CategoryRow[],
  rules: Array<typeof productSpecRules.$inferSelect>,
  categoryId: number
) {
  const ancestorCategoryIds = collectAncestorCategoryIds(allCategories, categoryId);
  const rulesByCategoryId = new Map<number, Array<(typeof rules)[number]>>();

  for (const rule of rules) {
    const bucket = rulesByCategoryId.get(rule.categoryId) ?? [];
    bucket.push(rule);
    rulesByCategoryId.set(rule.categoryId, bucket);
  }

  const mergedRules = new Map<string, (typeof rules)[number]>();
  for (const ancestorCategoryId of ancestorCategoryIds) {
    const categoryRules = rulesByCategoryId.get(ancestorCategoryId) ?? [];
    for (const rule of categoryRules) {
      mergedRules.set(rule.sourceNormalizedKey, rule);
    }
  }

  return mergedRules;
}

function isWhitelistedFilterKey(normalizedKey: string) {
  return FILTER_LANDING_WHITELIST.has(normalizedKey);
}

async function fetchCategoryFilterGroups(category: CategoryRow) {
  const db = getDb();
  const allCategories = await db.select().from(categories);
  const categoryIds = collectDescendantCategoryIds(allCategories, category.id);

  const rows = await db
    .select({
      key: productSpecValues.specKey,
      normalizedKey: productSpecValues.normalizedKey,
      value: productSpecValues.specValue,
      normalizedValue: productSpecValues.normalizedValue,
      count: sql<number>`count(distinct ${productSpecValues.productId})`,
    })
    .from(productSpecValues)
    .innerJoin(products, eq(productSpecValues.productId, products.id))
    .where(
      sql`${productSpecValues.categoryId} IN (${sql.join(categoryIds, sql`, `)}) AND ${publicProductVisibilityCondition}`
    )
    .groupBy(
      productSpecValues.specKey,
      productSpecValues.normalizedKey,
      productSpecValues.specValue,
      productSpecValues.normalizedValue
    )
    .orderBy(productSpecValues.specKey, productSpecValues.specValue);

  const rules = await db
    .select()
    .from(productSpecRules)
    .where(
      sql`${productSpecRules.categoryId} IN (${sql.join(
        collectAncestorCategoryIds(allCategories, category.id),
        sql`, `
      )})`
    );
  const rulesByKey = buildMergedSpecRulesForCategory(allCategories, rules, category.id);

  const filters = new Map<
    string,
    {
      key: string;
      normalizedKey: string;
      values: { value: string; normalizedValue: string; count: number }[];
    }
  >();

  for (const row of rows) {
    const rule = rulesByKey.get(row.normalizedKey);
    if (rule && (!rule.isVisible || !rule.isFilterable)) continue;

    const filterKey = rule?.targetNormalizedKey ?? row.normalizedKey;
    if (!isWhitelistedFilterKey(filterKey)) continue;

    const filterLabel = rule?.targetKey ?? row.key;
    const current = filters.get(filterKey) ?? {
      key: filterLabel,
      normalizedKey: filterKey,
      values: [],
    };
    current.values.push({
      value: row.value,
      normalizedValue: row.normalizedValue,
      count: Number(row.count),
    });
    filters.set(filterKey, current);
  }

  return Array.from(filters.values()).map(filter => ({
    ...filter,
    values: filter.values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
  }));
}

export async function countVisibleProductsForCategory(categoryId: number) {
  const db = getDb();
  const allCategories = filterPublicVisibleCategories(await db.select().from(categories));
  if (!allCategories.some(category => category.id === categoryId)) return 0;
  const categoryIds = collectDescendantCategoryIds(allCategories, categoryId);
  const [row] = await db
    .select({ productCount: sql<number>`count(*)` })
    .from(products)
    .where(
      sql`${products.categoryId} IN (${sql.join(categoryIds, sql`, `)}) AND ${publicProductVisibilityCondition}`
    );
  return Number(row?.productCount ?? 0);
}

async function countVisibleProductsForCategoryFilter(
  category: CategoryRow,
  filterKey: string,
  filterValue: string
) {
  const db = getDb();
  const allCategories = filterPublicVisibleCategories(await db.select().from(categories));
  if (!allCategories.some(item => item.id === category.id)) return 0;
  const categoryIds = collectDescendantCategoryIds(allCategories, category.id);
  const [row] = await db
    .select({ productCount: sql<number>`count(distinct ${products.id})` })
    .from(products)
    .where(
      sql`${products.categoryId} IN (${sql.join(categoryIds, sql`, `)})
        AND ${publicProductVisibilityCondition}
        AND EXISTS (
          SELECT 1
          FROM ${productSpecValues}
          WHERE ${productSpecValues.productId} = ${products.id}
            AND ${productSpecValues.normalizedKey} = ${filterKey}
            AND ${productSpecValues.normalizedValue} = ${filterValue}
        )`
    );

  return Number(row?.productCount ?? 0);
}

function deriveFilterDuplicateRisk(productCount: number, parentProductCount: number) {
  if (productCount <= 0 || parentProductCount <= 0) return "high" as const;
  const ratio = productCount / parentProductCount;
  if (ratio >= 0.85) return "high" as const;
  if (ratio >= 0.45) return "medium" as const;
  return "low" as const;
}

export function buildCategoryListingViewModel(
  category: CategoryRow,
  listing: ListingRow | null,
  productCount: number
) {
  const title = listing?.title ?? category.metaTitle ?? buildCategoryListingTitle(category.name);
  const metaDescription =
    listing?.metaDescription ??
    category.metaDescription ??
    buildCategoryListingDescription(category.name);
  const h1 = listing?.h1 ?? category.name;
  const introText = listing?.introText ?? category.description ?? null;
  const bottomText = listing?.bottomText ?? null;
  const contentScore =
    listing?.contentScore ??
    scoreListingContent({ title, metaDescription, h1, introText, bottomText });
  const seoTextStatus = listing?.seoTextStatus ?? deriveListingSeoStatus(contentScore);
  const indexationMode = (listing?.indexationMode ?? "index") as ListingIndexationMode;
  const duplicateRisk =
    productCount === 0
      ? "high"
      : (listing?.duplicateRisk as ListingDuplicateRisk | null) ??
        (productCount < 3 ? "medium" : "low");

  return {
    id: listing?.id ?? null,
    type: "category" as const,
    categoryId: category.id,
    categoryName: category.name,
    categorySlug: category.slug,
    url: listing?.url ?? buildCategoryListingUrl(category.slug),
    title,
    metaDescription,
    h1,
    introText,
    bottomText,
    canonicalUrl: normalizeCanonicalUrl(listing?.canonicalUrl ?? null),
    indexationMode,
    seoTextStatus,
    isPublished: listing?.isPublished ?? true,
    isAutoGenerated: listing?.isAutoGenerated ?? false,
    demandScore: listing?.demandScore ?? 0,
    contentScore,
    duplicateRisk,
    productCount,
    updatedAt: listing?.updatedAt ?? null,
    createdAt: listing?.createdAt ?? null,
  };
}

function buildFilterListingViewModel(input: {
  category: CategoryRow;
  listing: ListingRow | null;
  filterLabel: string;
  filterKey: string;
  filterValueLabel: string;
  filterValue: string;
  productCount: number;
  parentProductCount: number;
}) {
  const {
    category,
    listing,
    filterLabel,
    filterKey,
    filterValueLabel,
    filterValue,
    productCount,
    parentProductCount,
  } = input;
  const title =
    listing?.title ??
    buildFilterListingTitle(category.name, filterLabel, filterValueLabel);
  const metaDescription =
    listing?.metaDescription ??
    buildFilterListingDescription(category.name, filterLabel, filterValueLabel);
  const h1 = listing?.h1 ?? `${category.name}: ${filterValueLabel}`;
  const introText = listing?.introText ?? null;
  const bottomText = listing?.bottomText ?? null;
  const url = listing?.url ?? buildFilterListingUrl(category.slug, filterKey, filterValue);
  const contentScore =
    listing?.contentScore ??
    scoreListingContent({ title, metaDescription, h1, introText, bottomText });
  const seoTextStatus = listing?.seoTextStatus ?? deriveListingSeoStatus(contentScore);

  return {
    id: listing?.id ?? null,
    type: "filter" as const,
    categoryId: category.id,
    categoryName: category.name,
    categorySlug: category.slug,
    filterLabel,
    filterKey,
    filterValueLabel,
    filterValue,
    url,
    title,
    metaDescription,
    h1,
    introText,
    bottomText,
    canonicalUrl: normalizeCanonicalUrl(listing?.canonicalUrl ?? buildCategoryListingUrl(category.slug)),
    indexationMode: (listing?.indexationMode ?? "noindex") as ListingIndexationMode,
    seoTextStatus,
    isPublished: listing?.isPublished ?? false,
    isAutoGenerated: listing?.isAutoGenerated ?? false,
    demandScore: listing?.demandScore ?? 0,
    contentScore,
    duplicateRisk:
      (listing?.duplicateRisk as ListingDuplicateRisk | null) ??
      deriveFilterDuplicateRisk(productCount, parentProductCount),
    productCount,
    parentProductCount,
    updatedAt: listing?.updatedAt ?? null,
    createdAt: listing?.createdAt ?? null,
  };
}

export async function listFilterListingCandidates(categoryId: number) {
  const db = getDb();
  const [category] = await db.select().from(categories).where(eq(categories.id, categoryId)).limit(1);
  if (!category) return [];

  const [filterGroups, existingRows, parentProductCount] = await Promise.all([
    fetchCategoryFilterGroups(category),
    db
      .select()
      .from(listingPages)
      .where(and(eq(listingPages.type, "filter"), eq(listingPages.categoryId, category.id))),
    countVisibleProductsForCategory(category.id),
  ]);

  const listingByComposite = new Map(
    existingRows.map(row => [`${row.filterKey}:${row.filterValue}`, row] as const)
  );

  return filterGroups
    .flatMap(group =>
      group.values.map(value => {
        const existing = listingByComposite.get(
          `${group.normalizedKey}:${value.normalizedValue}`
        );
        return {
          key: group.key,
          normalizedKey: group.normalizedKey,
          value: value.value,
          normalizedValue: value.normalizedValue,
          productCount: value.count,
          existingListingId: existing?.id ?? null,
          existingIndexationMode:
            (existing?.indexationMode as ListingIndexationMode | undefined) ?? null,
          existingIsPublished: existing?.isPublished ?? null,
          duplicateRisk: deriveFilterDuplicateRisk(value.count, parentProductCount),
        };
      })
    )
    .sort((a, b) => b.productCount - a.productCount || a.key.localeCompare(b.key) || a.value.localeCompare(b.value));
}

export async function resolveCategoryListingBySlug(
  categorySlug: string,
  options?: { includeUnpublished?: boolean }
) {
  const db = getDb();
  const allCategories = filterPublicVisibleCategories(await db.select().from(categories));
  const category = allCategories.find(item => item.slug === categorySlug) ?? null;

  if (!category) return null;

  const [listing, productCount] = await Promise.all([
    db
      .select()
      .from(listingPages)
      .where(
        and(
          eq(listingPages.type, "category"),
          eq(listingPages.categoryId, category.id)
        )
      )
      .limit(1)
      .then(rows => rows[0] ?? null),
    countVisibleProductsForCategory(category.id),
  ]);

  const effectiveListing =
    listing && (options?.includeUnpublished || listing.isPublished) ? listing : null;

  return buildCategoryListingViewModel(category, effectiveListing, productCount);
}

export async function resolveFilterListing(input: {
  categorySlug: string;
  filterKey: string;
  filterValue: string;
  includeUnpublished?: boolean;
}) {
  const db = getDb();
  const allCategories = filterPublicVisibleCategories(await db.select().from(categories));
  const category = allCategories.find(item => item.slug === input.categorySlug) ?? null;

  if (!category) return null;

  const [existingListing, candidates, parentProductCount, productCount] = await Promise.all([
    db
      .select()
      .from(listingPages)
      .where(
        and(
          eq(listingPages.type, "filter"),
          eq(listingPages.categoryId, category.id),
          eq(listingPages.filterKey, input.filterKey),
          eq(listingPages.filterValue, input.filterValue)
        )
      )
      .limit(1)
      .then(rows => rows[0] ?? null),
    fetchCategoryFilterGroups(category),
    countVisibleProductsForCategory(category.id),
    countVisibleProductsForCategoryFilter(category, input.filterKey, input.filterValue),
  ]);

  const candidateGroup = candidates.find(group => group.normalizedKey === input.filterKey);
  const candidateValue = candidateGroup?.values.find(
    value => value.normalizedValue === input.filterValue
  );

  if (!candidateGroup || !candidateValue) return null;

  const listing =
    existingListing && (input.includeUnpublished || existingListing.isPublished)
      ? existingListing
      : null;

  return buildFilterListingViewModel({
    category,
    listing,
    filterLabel: candidateGroup.key,
    filterKey: candidateGroup.normalizedKey,
    filterValueLabel: candidateValue.value,
    filterValue: candidateValue.normalizedValue,
    productCount,
    parentProductCount,
  });
}

const HIGH_DEMAND_FILTER_THRESHOLD = 6;

function buildCategoryQualityIssues(item: ReturnType<typeof buildCategoryListingViewModel>) {
  const issues: ListingQualityCategoryIssue[] = [];

  if (item.productCount <= 0) {
    issues.push({
      type: "empty_category",
      label: "Пустая категория",
    });
  }

  if (!trimOrNull(item.title) || !trimOrNull(item.metaDescription) || !trimOrNull(item.h1)) {
    issues.push({
      type: "missing_meta",
      label: "Не хватает meta/H1",
    });
  }

  if (item.productCount > 0 && item.contentScore < 55) {
    issues.push({
      type: "thin_content",
      label: "Слабый контент",
    });
  }

  if (item.duplicateRisk === "high") {
    issues.push({
      type: "manual_duplicate_review",
      label: "Проверить на дубль",
    });
  }

  if (item.isPublished && item.indexationMode !== "index") {
    issues.push({
      type: "published_noindex",
      label: "Опубликовано, но не индексируется",
    });
  }

  return issues;
}

function buildFilterQualityIssues(
  item: Awaited<ReturnType<typeof listFilterListingCandidates>>[number]
) {
  const issues: ListingQualityFilterIssue[] = [];
  const isHighDemand = item.productCount >= HIGH_DEMAND_FILTER_THRESHOLD;

  if (item.duplicateRisk === "high") {
    issues.push({
      type: "high_duplicate_risk",
      label: "Высокий риск дубля",
    });
  }

  if (isHighDemand && !item.existingIsPublished) {
    issues.push({
      type: "high_demand_unpublished",
      label: "Спрос есть, страница не опубликована",
    });
  }

  if (
    isHighDemand &&
    item.existingIsPublished &&
    item.existingIndexationMode &&
    item.existingIndexationMode !== "index"
  ) {
    issues.push({
      type: "high_demand_noindex",
      label: "Спрос есть, но страница закрыта",
    });
  }

  return issues;
}

export async function buildListingQualityDashboard(): Promise<ListingQualityDashboard> {
  const db = getDb();
  const publicCategories = filterPublicVisibleCategories(await db.select().from(categories));
  const [categoryListingRows, filterListingRows] = await Promise.all([
    db.select().from(listingPages).where(eq(listingPages.type, "category")),
    db.select().from(listingPages).where(eq(listingPages.type, "filter")),
  ]);

  const categoryListingByCategoryId = new Map(
    categoryListingRows.map(item => [item.categoryId, item] as const)
  );

  const categoryIssues = (
    await Promise.all(
      publicCategories.map(async category => {
        const productCount = await countVisibleProductsForCategory(category.id);
        const item = buildCategoryListingViewModel(
          category,
          categoryListingByCategoryId.get(category.id) ?? null,
          productCount
        );

        return {
          categoryId: category.id,
          categoryName: category.name,
          categorySlug: category.slug,
          productCount: item.productCount,
          indexationMode: item.indexationMode,
          contentScore: item.contentScore,
          duplicateRisk: item.duplicateRisk,
          issues: buildCategoryQualityIssues(item),
          url: item.url,
        };
      })
    )
  )
    .filter(item => item.issues.length > 0)
    .sort(
      (a, b) =>
        b.issues.length - a.issues.length ||
        a.categoryName.localeCompare(b.categoryName, "ru")
    );

  const filterIssues = (
    await Promise.all(
      publicCategories.map(async category => {
        const candidates = await listFilterListingCandidates(category.id);
        return candidates
          .map(candidate => ({
            categoryId: category.id,
            categoryName: category.name,
            categorySlug: category.slug,
            filterKey: candidate.normalizedKey,
            filterLabel: candidate.key,
            filterValue: candidate.value,
            productCount: candidate.productCount,
            duplicateRisk: candidate.duplicateRisk,
            existingListingId: candidate.existingListingId,
            existingIndexationMode: candidate.existingIndexationMode,
            existingIsPublished: candidate.existingIsPublished,
            issues: buildFilterQualityIssues(candidate),
            url: buildFilterListingUrl(
              category.slug,
              candidate.normalizedKey,
              candidate.normalizedValue
            ),
          }))
          .filter(item => item.issues.length > 0);
      })
    )
  )
    .flat()
    .sort(
      (a, b) =>
        b.productCount - a.productCount ||
        a.categoryName.localeCompare(b.categoryName, "ru") ||
        a.filterLabel.localeCompare(b.filterLabel, "ru")
    );

  const canonicalBuckets = new Map<string, ListingRow[]>();
  for (const row of [...categoryListingRows, ...filterListingRows]) {
    if (!row.isPublished) continue;
    const canonical = normalizeCanonicalUrl(row.canonicalUrl ?? row.url);
    if (!canonical) continue;
    const bucket = canonicalBuckets.get(canonical) ?? [];
    bucket.push(row);
    canonicalBuckets.set(canonical, bucket);
  }

  const canonicalConflicts = Array.from(canonicalBuckets.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([canonicalUrl, rows]) => ({
      canonicalUrl,
      listings: rows.map(row => ({
        id: row.id,
        type: row.type,
        categoryId: row.categoryId,
        url: row.url,
      })),
    }))
    .sort((a, b) => b.listings.length - a.listings.length || a.canonicalUrl.localeCompare(b.canonicalUrl));

  const summary = {
    totalCategories: publicCategories.length,
    indexableCategories:
      publicCategories.length -
      categoryIssues.filter(item => item.issues.some(issue => issue.type === "published_noindex")).length,
    emptyCategories: categoryIssues.filter(item =>
      item.issues.some(issue => issue.type === "empty_category")
    ).length,
    categoriesMissingMeta: categoryIssues.filter(item =>
      item.issues.some(issue => issue.type === "missing_meta")
    ).length,
    categoriesThinContent: categoryIssues.filter(item =>
      item.issues.some(issue => issue.type === "thin_content")
    ).length,
    categoriesNeedDuplicateReview: categoryIssues.filter(item =>
      item.issues.some(issue => issue.type === "manual_duplicate_review")
    ).length,
    categoriesPublishedNoindex: categoryIssues.filter(item =>
      item.issues.some(issue => issue.type === "published_noindex")
    ).length,
    highDemandFilterCandidates: filterIssues.filter(item => item.productCount >= HIGH_DEMAND_FILTER_THRESHOLD).length,
    highDemandFilterUnpublished: filterIssues.filter(item =>
      item.issues.some(issue => issue.type === "high_demand_unpublished")
    ).length,
    highDemandFilterNoindex: filterIssues.filter(item =>
      item.issues.some(issue => issue.type === "high_demand_noindex")
    ).length,
    highRiskFilterCandidates: filterIssues.filter(item =>
      item.issues.some(issue => issue.type === "high_duplicate_risk")
    ).length,
    canonicalConflicts: canonicalConflicts.length,
  };

  return {
    summary,
    categoryIssues: categoryIssues.slice(0, 24),
    filterIssues: filterIssues.slice(0, 24),
    canonicalConflicts: canonicalConflicts.slice(0, 12),
  };
}
