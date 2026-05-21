import { and, desc, eq, inArray, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import { isProductVisibleOnSite } from "@contracts/product-visibility";
import { getAppSetting, setAppSetting } from "./app-settings";
import { filterDisabledMerchandisingBadges, normalizeMerchandisingBadges } from "@/lib/merchandising-badges";
import { getStorefrontBadgeLabels } from "./merchandising-ai-badges";

type Badge =
  | "top_category"
  | "excellent_price"
  | "store_choice"
  | "new"
  | "recommend"
  | "profitable"
  | "in_stock"
  | "low_stock";

type ProductInput = typeof schema.products.$inferSelect & {
  categoryName?: string | null;
  totalStock: number;
  storeCount: number;
};

type Rule = typeof schema.merchandisingRules.$inferSelect;
type Merch = typeof schema.productMerchandising.$inferSelect;

const DISABLED_BADGES_SETTING_KEY = "merchandising_disabled_badges";

const DEFAULT_RULE = {
  priceWeight: 25,
  stockWeight: 20,
  marginWeight: 15,
  contentWeight: 15,
  newnessWeight: 10,
  categoryWeight: 10,
  manualWeight: 5,
  minScoreForTop: 75,
  minScoreForRecommend: 70,
  excellentPriceThreshold: 90,
  newProductDays: 30,
  minPromoStock: 1,
  minMarginPercent: 20,
  maxTopPercent: 15,
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function toNumber(value: unknown) {
  return Number(value || 0);
}

function median(values: number[]) {
  const clean = values.filter(value => value > 0).sort((a, b) => a - b);
  if (clean.length === 0) return 0;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
}

function getRule(rule?: Rule | null) {
  return rule ?? ({ ...DEFAULT_RULE } as Rule);
}

function getSpecs(product: ProductInput): Record<string, unknown> {
  return product.specs && typeof product.specs === "object" && !Array.isArray(product.specs)
    ? (product.specs as Record<string, unknown>)
    : {};
}

function getBrand(product: ProductInput) {
  const specs = getSpecs(product);
  return String(specs["Производитель"] || specs["Бренд"] || "").trim();
}

function calculatePriceScore(product: ProductInput, categoryMedian: number) {
  if (!product.price || !categoryMedian) return 50;
  const index = product.price / categoryMedian;
  if (index <= 0.8) return 100;
  if (index <= 0.9) return 80;
  if (index <= 1.1) return 50;
  if (index <= 1.2) return 30;
  return 10;
}

function calculateStockScore(totalStock: number) {
  if (totalStock <= 0) return 0;
  if (totalStock >= 25) return 100;
  if (totalStock >= 8) return 70;
  return 40;
}

function calculateContentScore(product: ProductInput) {
  const specs = getSpecs(product);
  const image = product.image || "";
  let score = 0;
  if (
    image &&
    !image.includes("placeholder") &&
    !image.includes("nofoto") &&
    !image.includes("undefined")
  ) score += 20;
  if ((product.description || "").trim().length >= 20) score += 15;
  if (Object.keys(specs).length > 0) score += 20;
  if (getBrand(product)) score += 10;
  if (product.categoryId) score += 10;
  if (product.msId) score += 10;
  if (Object.keys(specs).length >= 4) score += 15;
  return clampScore(score);
}

function calculateNewnessScore(product: ProductInput, rule: Rule) {
  const ageMs = Date.now() - new Date(product.createdAt).getTime();
  const ageDays = ageMs / 86400000;
  if (ageDays <= 7) return 100;
  if (ageDays <= rule.newProductDays) return 80;
  if (ageDays <= 60) return 40;
  return 0;
}

function statusFor(product: ProductInput, contentScore: number, marginScore: number, hidden: boolean) {
  if (hidden) return "excluded_from_promo";
  if (product.totalStock <= 0 || !product.inStock) return "out_of_stock";
  if (contentScore < 55) return "needs_content";
  if (marginScore < 30) return "low_margin";
  return "ready_for_promo";
}

function mergeBadges(autoBadges: Badge[], manualBadges: unknown): Badge[] {
  const manual = Array.isArray(manualBadges) ? manualBadges.map(String) : [];
  return Array.from(new Set([...autoBadges, ...manual])) as Badge[];
}

function buildMerchandisingConditions(input: {
  categoryId?: number;
  badge?: string;
  status?: string;
  scoreMin?: number;
  stockStatus?: "in_stock" | "out_of_stock";
  search?: string;
}) {
  const conditions = [];
  if (input.categoryId) conditions.push(eq(schema.products.categoryId, input.categoryId));
  if (input.status) conditions.push(eq(schema.productMerchandising.status, input.status));
  if (input.scoreMin !== undefined) {
    conditions.push(sql`${schema.productMerchandising.totalScore} >= ${input.scoreMin}`);
  }
  if (input.stockStatus === "in_stock") conditions.push(sql`coalesce(stock.total_stock, 0) > 0`);
  if (input.stockStatus === "out_of_stock") conditions.push(sql`coalesce(stock.total_stock, 0) <= 0`);
  if (input.badge) conditions.push(sql`json_contains(${schema.productMerchandising.badges}, ${JSON.stringify(input.badge)})`);
  if (input.search) conditions.push(sql`${schema.products.name} like ${`%${input.search}%`}`);
  return conditions;
}

export async function getMerchandisingDisabledBadges() {
  const raw = await getAppSetting(DISABLED_BADGES_SETTING_KEY);
  if (!raw) return [] as string[];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? Array.from(new Set(parsed.map(String).filter(Boolean))) : [];
  } catch {
    return [];
  }
}

export async function saveMerchandisingDisabledBadges(disabledBadges: string[]) {
  const normalized = Array.from(new Set(disabledBadges.map(String).filter(Boolean)));
  await setAppSetting(DISABLED_BADGES_SETTING_KEY, JSON.stringify(normalized));
  return normalized;
}

function calculateProductScore(
  product: ProductInput,
  categoryMedian: number,
  rule: Rule,
  existing?: Merch | null
) {
  const manualPriority = existing?.manualPriority ?? 0;
  const isHiddenFromPromo = existing?.isHiddenFromPromo ?? false;
  const priceScore = calculatePriceScore(product, categoryMedian);
  const stockScore = calculateStockScore(product.totalStock);
  const marginScore = 50;
  const contentScore = calculateContentScore(product);
  const newnessScore = calculateNewnessScore(product, rule);
  const categoryPriorityScore = 50;
  const manualScore = clampScore(50 + manualPriority / 2);
  const penaltyScore = isHiddenFromPromo || product.totalStock <= 0 ? 100 : 0;

  const weightTotal =
    rule.priceWeight +
    rule.stockWeight +
    rule.marginWeight +
    rule.contentWeight +
    rule.newnessWeight +
    rule.categoryWeight +
    rule.manualWeight;

  const weighted =
    (priceScore * rule.priceWeight +
      stockScore * rule.stockWeight +
      marginScore * rule.marginWeight +
      contentScore * rule.contentWeight +
      newnessScore * rule.newnessWeight +
      categoryPriorityScore * rule.categoryWeight +
      manualScore * rule.manualWeight) /
    weightTotal;

  const totalScore = clampScore(weighted - penaltyScore * 0.25);
  const status = statusFor(product, contentScore, marginScore, isHiddenFromPromo);
  const autoBadges: Badge[] = [];

  if (product.totalStock >= rule.minPromoStock) autoBadges.push("in_stock");
  if (product.totalStock > 0 && product.totalStock < 4) autoBadges.push("low_stock");
  if (newnessScore >= 80 && product.totalStock > 0) autoBadges.push("new");
  if (
    priceScore >= 80 &&
    marginScore >= rule.minMarginPercent &&
    product.totalStock > 0
  ) {
    autoBadges.push("excellent_price");
  }
  if (priceScore >= 70 && marginScore >= 60 && stockScore >= 60) autoBadges.push("profitable");
  if (
    totalScore >= rule.minScoreForRecommend &&
    contentScore >= 70 &&
    product.totalStock > 0 &&
    !isHiddenFromPromo
  ) {
    autoBadges.push("recommend");
  }

  return {
    totalScore,
    priceScore,
    stockScore,
    marginScore,
    contentScore,
    newnessScore,
    categoryPriorityScore,
    manualPriority,
    penaltyScore,
    badges: mergeBadges(autoBadges, existing?.badges),
    status,
    isFeatured: existing?.isFeatured ?? false,
    isHiddenFromPromo,
    comment: existing?.comment ?? null,
  };
}

async function getProductsWithStock(categoryId?: number) {
  const db = getDb();
  const rows = await db
    .select({
      id: schema.products.id,
      msId: schema.products.msId,
      slug: schema.products.slug,
      name: schema.products.name,
      categoryId: schema.products.categoryId,
      price: schema.products.price,
      isActive: schema.products.isActive,
      isAutoBlocked: schema.products.isAutoBlocked,
      autoBlockReason: schema.products.autoBlockReason,
      oldPrice: schema.products.oldPrice,
      badge: schema.products.badge,
      image: schema.products.image,
      imageVariants: schema.products.imageVariants,
      description: schema.products.description,
      specs: schema.products.specs,
      inStock: schema.products.inStock,
      rating: schema.products.rating,
      reviewCount: schema.products.reviewCount,
      createdAt: schema.products.createdAt,
      categoryName: schema.categories.name,
      totalStock: sql<number>`coalesce(sum(${schema.productStocks.quantity}), 0)`.as("totalStock"),
      storeCount: sql<number>`count(distinct ${schema.productStocks.storeId})`.as("storeCount"),
    })
    .from(schema.products)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .leftJoin(schema.productStocks, eq(schema.productStocks.productId, schema.products.id))
    .where(categoryId ? eq(schema.products.categoryId, categoryId) : undefined)
    .groupBy(
      schema.products.id,
      schema.products.msId,
      schema.products.slug,
      schema.products.name,
      schema.products.categoryId,
      schema.products.price,
      schema.products.isActive,
      schema.products.isAutoBlocked,
      schema.products.autoBlockReason,
      schema.products.oldPrice,
      schema.products.badge,
      schema.products.image,
      schema.products.imageVariants,
      schema.products.description,
      schema.products.specs,
      schema.products.inStock,
      schema.products.rating,
      schema.products.reviewCount,
      schema.products.createdAt,
      schema.categories.name
    );

  return rows.map(row => ({
    ...row,
    totalStock: toNumber(row.totalStock),
    storeCount: toNumber(row.storeCount),
  })) as ProductInput[];
}

async function getRules() {
  const db = getDb();
  const rows = await db.select().from(schema.merchandisingRules);
  const globalRule = rows.find(row => row.scopeType === "global") ?? null;
  const categoryRules = new Map<number, Rule>();
  for (const row of rows) {
    if (row.scopeType === "category" && row.scopeId) categoryRules.set(row.scopeId, row);
  }
  return { globalRule, categoryRules };
}

async function getExisting(productIds: number[]) {
  const db = getDb();
  if (productIds.length === 0) return new Map<number, Merch>();
  const rows = await db
    .select()
    .from(schema.productMerchandising)
    .where(inArray(schema.productMerchandising.productId, productIds));
  return new Map(rows.map(row => [row.productId, row]));
}

export async function recalculateMerchandisingScores(categoryId?: number) {
  const db = getDb();
  const products = await getProductsWithStock(categoryId);
  const { globalRule, categoryRules } = await getRules();
  const existing = await getExisting(products.map(product => product.id));
  const categoryMedians = new Map<number, number>();
  const byCategory = new Map<number, ProductInput[]>();

  for (const product of products) {
    const list = byCategory.get(product.categoryId) ?? [];
    list.push(product);
    byCategory.set(product.categoryId, list);
  }

  for (const [catId, list] of byCategory.entries()) {
    categoryMedians.set(catId, median(list.map(product => product.price)));
  }

  const calculated = products.map(product => {
    const rule = getRule(categoryRules.get(product.categoryId) ?? globalRule);
    const score = calculateProductScore(
      product,
      categoryMedians.get(product.categoryId) ?? 0,
      rule,
      existing.get(product.id)
    );
    return { product, rule, score };
  });

  for (const [catId] of byCategory.entries()) {
    const rule = getRule(categoryRules.get(catId) ?? globalRule);
    const ranked = calculated
      .filter(item => item.product.categoryId === catId)
      .sort((a, b) => b.score.totalScore - a.score.totalScore);
    const topLimit = Math.min(20, Math.max(4, Math.ceil(ranked.length * (rule.maxTopPercent / 100))));
    ranked.slice(0, topLimit).forEach(item => {
      if (
        item.score.totalScore >= rule.minScoreForTop &&
        item.score.contentScore >= 70 &&
        item.product.totalStock > 0 &&
        !item.score.isHiddenFromPromo
      ) {
        item.score.badges = Array.from(new Set([...item.score.badges, "top_category"])) as Badge[];
      }
    });
  }

  for (const item of calculated) {
    await db
      .insert(schema.productMerchandising)
      .values({
        productId: item.product.id,
        ...item.score,
        badges: item.score.badges,
        updatedBy: "robot",
      })
      .onDuplicateKeyUpdate({
        set: {
          totalScore: item.score.totalScore,
          priceScore: item.score.priceScore,
          stockScore: item.score.stockScore,
          marginScore: item.score.marginScore,
          contentScore: item.score.contentScore,
          newnessScore: item.score.newnessScore,
          categoryPriorityScore: item.score.categoryPriorityScore,
          manualPriority: item.score.manualPriority,
          penaltyScore: item.score.penaltyScore,
          badges: item.score.badges,
          status: item.score.status,
          isFeatured: item.score.isFeatured,
          isHiddenFromPromo: item.score.isHiddenFromPromo,
          comment: item.score.comment,
          updatedBy: "robot",
          updatedAt: sql`now()`,
        },
      });
  }

  return {
    recalculatedProducts: calculated.length,
    readyForPromo: calculated.filter(item => item.score.status === "ready_for_promo").length,
    highScore: calculated.filter(item => item.score.totalScore >= 70).length,
  };
}

export async function ensureMerchandisingScores() {
  const db = getDb();
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.productMerchandising);
  if (Number(count) === 0) {
    await recalculateMerchandisingScores();
  }
}

export async function getMerchandisingSummary() {
  await ensureMerchandisingScores();
  const db = getDb();
  const [summary] = await db
    .select({
      totalProducts: sql<number>`count(distinct ${schema.products.id})`,
      inStockProducts: sql<number>`sum(case when coalesce(stock.total_stock, 0) > 0 then 1 else 0 end)`,
      missingImages: sql<number>`sum(case when ${schema.products.image} like '%placeholder%' or ${schema.products.image} like '%nofoto%' or ${schema.products.image} like '%undefined%' then 1 else 0 end)`,
      missingDescriptions: sql<number>`sum(case when ${schema.products.description} = '' then 1 else 0 end)`,
      highScoreProducts: sql<number>`sum(case when ${schema.productMerchandising.totalScore} >= 70 then 1 else 0 end)`,
      readyForPromo: sql<number>`sum(case when ${schema.productMerchandising.status} = 'ready_for_promo' then 1 else 0 end)`,
      lowMarginProducts: sql<number>`sum(case when ${schema.productMerchandising.status} = 'low_margin' then 1 else 0 end)`,
      missingCategoryProducts: sql<number>`sum(case when ${schema.categories.id} is null then 1 else 0 end)`,
    })
    .from(schema.products)
    .leftJoin(
      sql`(select product_id, sum(quantity) as total_stock from product_stocks group by product_id) stock`,
      sql`stock.product_id = ${schema.products.id}`
    )
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, schema.products.id));

  return {
    totalProducts: Number(summary.totalProducts || 0),
    inStockProducts: Number(summary.inStockProducts || 0),
    missingImages: Number(summary.missingImages || 0),
    missingDescriptions: Number(summary.missingDescriptions || 0),
    highScoreProducts: Number(summary.highScoreProducts || 0),
    readyForPromo: Number(summary.readyForPromo || 0),
    lowMarginProducts: Number(summary.lowMarginProducts || 0),
    missingCategoryProducts: Number(summary.missingCategoryProducts || 0),
  };
}

export async function listMerchandisingProducts(input: {
  page: number;
  limit: number;
  categoryId?: number;
  badge?: string;
  status?: string;
  scoreMin?: number;
  stockStatus?: "in_stock" | "out_of_stock";
  search?: string;
}) {
  await ensureMerchandisingScores();
  const db = getDb();
  const offset = (input.page - 1) * input.limit;
  const conditions = buildMerchandisingConditions(input);
  const where = conditions.length ? and(...conditions) : undefined;
  const stockJoin = sql`(select product_id, sum(quantity) as total_stock, count(distinct store_id) as store_count from product_stocks group by product_id) stock`;
  const disabledBadges = await getMerchandisingDisabledBadges();

  const items = await db
    .select({
      id: schema.products.id,
      slug: schema.products.slug,
      name: schema.products.name,
      categoryId: schema.products.categoryId,
      categoryName: schema.categories.name,
      price: schema.products.price,
      isActive: schema.products.isActive,
      isAutoBlocked: schema.products.isAutoBlocked,
      autoBlockReason: schema.products.autoBlockReason,
      oldPrice: schema.products.oldPrice,
      badge: schema.products.badge,
      image: schema.products.image,
      imageVariants: schema.products.imageVariants,
      description: schema.products.description,
      specs: schema.products.specs,
      inStock: schema.products.inStock,
      rating: schema.products.rating,
      reviewCount: schema.products.reviewCount,
      createdAt: schema.products.createdAt,
      totalStock: sql<number>`coalesce(stock.total_stock, 0)`.as("totalStock"),
      storeCount: sql<number>`coalesce(stock.store_count, 0)`.as("storeCount"),
      totalScore: schema.productMerchandising.totalScore,
      priceScore: schema.productMerchandising.priceScore,
      stockScore: schema.productMerchandising.stockScore,
      marginScore: schema.productMerchandising.marginScore,
      contentScore: schema.productMerchandising.contentScore,
      newnessScore: schema.productMerchandising.newnessScore,
      manualPriority: schema.productMerchandising.manualPriority,
      penaltyScore: schema.productMerchandising.penaltyScore,
      badges: schema.productMerchandising.badges,
      status: schema.productMerchandising.status,
      isFeatured: schema.productMerchandising.isFeatured,
      isHiddenFromPromo: schema.productMerchandising.isHiddenFromPromo,
      comment: schema.productMerchandising.comment,
    })
    .from(schema.products)
    .leftJoin(stockJoin, sql`stock.product_id = ${schema.products.id}`)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, schema.products.id))
    .where(where)
    .orderBy(desc(schema.productMerchandising.totalScore), desc(sql`coalesce(stock.total_stock, 0)`))
    .limit(input.limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.products)
    .leftJoin(stockJoin, sql`stock.product_id = ${schema.products.id}`)
    .leftJoin(schema.categories, eq(schema.categories.id, schema.products.categoryId))
    .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, schema.products.id))
    .where(where);

  const aiBadgeMap = await getStorefrontBadgeLabels(items.map(item => item.id));

  return {
    items: items.map(item => {
      const manualBadges = filterDisabledMerchandisingBadges(item.badges, disabledBadges);
      const aiBadges = aiBadgeMap.get(item.id) ?? [];
      return {
        ...item,
        totalStock: Number(item.totalStock || 0),
        storeCount: Number(item.storeCount || 0),
        badges: manualBadges,
        merchandisingBadges: Array.from(new Set([...manualBadges, ...aiBadges])),
      };
    }),
    total: Number(total || 0),
    page: input.page,
    totalPages: Math.ceil(Number(total || 0) / input.limit),
  };
}

export async function getRecommendedProducts(input: {
  limit: number;
  categoryId?: number;
  excludeProductId?: number;
}) {
  await ensureMerchandisingScores();
  const result = await listMerchandisingProducts({
    page: 1,
    limit: Math.max(input.limit * 3, input.limit),
    categoryId: input.categoryId,
    stockStatus: "in_stock",
  });
  return result.items
    .filter(
      item =>
        item.id !== input.excludeProductId &&
        isProductVisibleOnSite({
          price: item.price,
          isActive: (item as any).isActive,
          isAutoBlocked: (item as any).isAutoBlocked,
          autoBlockReason: (item as any).autoBlockReason,
        })
    )
    .slice(0, input.limit);
}

export async function updateManualMerchandising(input: {
  productId: number;
  manualPriority: number;
  badges: string[];
  isFeatured: boolean;
  isHiddenFromPromo: boolean;
  comment?: string | null;
  updatedBy?: string;
}) {
  await ensureMerchandisingScores();
  const db = getDb();
  const [oldValue] = await db
    .select()
    .from(schema.productMerchandising)
    .where(eq(schema.productMerchandising.productId, input.productId))
    .limit(1);

  await db
    .insert(schema.productMerchandising)
    .values({
      productId: input.productId,
      totalScore: oldValue?.totalScore ?? 0,
      priceScore: oldValue?.priceScore ?? 0,
      stockScore: oldValue?.stockScore ?? 0,
      marginScore: oldValue?.marginScore ?? 50,
      contentScore: oldValue?.contentScore ?? 0,
      newnessScore: oldValue?.newnessScore ?? 0,
      categoryPriorityScore: oldValue?.categoryPriorityScore ?? 50,
      manualPriority: input.manualPriority,
      penaltyScore: oldValue?.penaltyScore ?? 0,
      badges: input.badges,
      status: oldValue?.status ?? "manual_review",
      isFeatured: input.isFeatured,
      isHiddenFromPromo: input.isHiddenFromPromo,
      comment: input.comment ?? null,
      updatedBy: input.updatedBy ?? "admin",
    })
    .onDuplicateKeyUpdate({
      set: {
        manualPriority: input.manualPriority,
        badges: input.badges,
        isFeatured: input.isFeatured,
        isHiddenFromPromo: input.isHiddenFromPromo,
        comment: input.comment ?? null,
        updatedBy: input.updatedBy ?? "admin",
        updatedAt: sql`now()`,
      },
    });

  await db.insert(schema.merchandisingHistory).values({
    productId: input.productId,
    userId: input.updatedBy ?? "admin",
    actionType: "manual_update",
    oldValue: oldValue ?? {},
    newValue: input,
    comment: input.comment ?? null,
  });

  await recalculateMerchandisingScores();

  return { success: true };
}

export async function bulkUpdateMerchandisingBadge(input: {
  badge: string;
  action: "add" | "remove";
  categoryId?: number;
  status?: string;
  scoreMin?: number;
  stockStatus?: "in_stock" | "out_of_stock";
  search?: string;
  updatedBy?: string;
}) {
  await ensureMerchandisingScores();
  const db = getDb();
  const stockJoin = sql`(select product_id, sum(quantity) as total_stock, count(distinct store_id) as store_count from product_stocks group by product_id) stock`;
  const conditions = buildMerchandisingConditions(input);
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      productId: schema.products.id,
      badges: schema.productMerchandising.badges,
    })
    .from(schema.products)
    .leftJoin(stockJoin, sql`stock.product_id = ${schema.products.id}`)
    .leftJoin(schema.productMerchandising, eq(schema.productMerchandising.productId, schema.products.id))
    .where(where);

  const changed = rows
    .map(row => {
      const current = normalizeMerchandisingBadges(row.badges);
      const next =
        input.action === "add"
          ? Array.from(new Set([...current, input.badge]))
          : current.filter(item => item !== input.badge);
      const isChanged = next.length !== current.length || next.some((item, index) => item !== current[index]);
      return isChanged
        ? {
            productId: row.productId,
            oldBadges: current,
            newBadges: next,
          }
        : null;
    })
    .filter(Boolean) as Array<{ productId: number; oldBadges: string[]; newBadges: string[] }>;

  for (const item of changed) {
    await db
      .insert(schema.productMerchandising)
      .values({
        productId: item.productId,
        totalScore: 0,
        priceScore: 0,
        stockScore: 0,
        marginScore: 50,
        contentScore: 0,
        newnessScore: 0,
        categoryPriorityScore: 50,
        manualPriority: 0,
        penaltyScore: 0,
        badges: item.newBadges,
        status: "manual_review",
        isFeatured: false,
        isHiddenFromPromo: false,
        comment: null,
        updatedBy: input.updatedBy ?? "admin",
      })
      .onDuplicateKeyUpdate({
        set: {
          badges: item.newBadges,
          updatedBy: input.updatedBy ?? "admin",
          updatedAt: sql`now()`,
        },
      });
  }

  const historyRows = changed.map(item => ({
    productId: item.productId,
    userId: input.updatedBy ?? "admin",
    actionType: input.action === "add" ? "bulk_badge_add" : "bulk_badge_remove",
    oldValue: { badges: item.oldBadges },
    newValue: { badges: item.newBadges, badge: input.badge },
    comment: `${input.action === "add" ? "Массово добавлен" : "Массово удален"} бейдж ${input.badge}`,
  }));

  for (let index = 0; index < historyRows.length; index += 200) {
    const batch = historyRows.slice(index, index + 200);
    if (batch.length > 0) {
      await db.insert(schema.merchandisingHistory).values(batch);
    }
  }

  return {
    success: true,
    affectedProducts: changed.length,
    badge: input.badge,
    action: input.action,
  };
}
