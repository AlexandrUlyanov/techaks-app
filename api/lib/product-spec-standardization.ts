import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "./product-normalization";
import { rebuildProductSpecIndexForProduct } from "./product-normalization-service";

type RuleRow = typeof schema.productSpecRules.$inferSelect;
type ProductRow = Pick<
  typeof schema.products.$inferSelect,
  "id" | "name" | "slug" | "categoryId" | "specs"
>;

function isSpecsRecord(specs: unknown): specs is Record<string, unknown> {
  return Boolean(specs) && typeof specs === "object" && !Array.isArray(specs);
}

function getStandardizedCategoryIds(
  allCategories: Array<typeof schema.categories.$inferSelect>,
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

async function getRulesByCategory(categoryId: number) {
  const db = getDb();
  const rules = await db
    .select()
    .from(schema.productSpecRules)
    .where(eq(schema.productSpecRules.categoryId, categoryId))
    .orderBy(
      asc(schema.productSpecRules.sortOrder),
      asc(schema.productSpecRules.targetKey)
    );

  return new Map(rules.map(rule => [rule.sourceNormalizedKey, rule]));
}

function buildStandardizedSpecs(
  specs: Record<string, unknown>,
  rules: Map<string, RuleRow>
) {
  const nextSpecs: Record<string, string> = {};
  const conflicts: Array<{
    sourceKey: string;
    targetKey: string;
    existingValue: string;
    nextValue: string;
  }> = [];
  let changed = false;

  for (const [rawKey, rawValue] of Object.entries(specs)) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    const displayKey = normalizeSpecKeyForDisplay(String(rawKey));
    const normalizedKey = normalizeSpecToken(displayKey).slice(0, 120);
    const rule = rules.get(normalizedKey);
    const targetKey = rule?.targetKey || displayKey;

    if (targetKey !== displayKey) changed = true;

    if (!(targetKey in nextSpecs)) {
      nextSpecs[targetKey] = value;
      continue;
    }

    if (normalizeSpecToken(nextSpecs[targetKey]) === normalizeSpecToken(value)) {
      changed = true;
      continue;
    }

    conflicts.push({
      sourceKey: displayKey,
      targetKey,
      existingValue: nextSpecs[targetKey],
      nextValue: value,
    });
  }

  return {
    changed,
    nextSpecs,
    conflicts,
  };
}

export async function getCategorySpecStandardization(categoryId: number) {
  const db = getDb();
  const allCategories = await db.select().from(schema.categories);
  const categoryIds = getStandardizedCategoryIds(allCategories, categoryId);
  const rules = await db
    .select()
    .from(schema.productSpecRules)
    .where(eq(schema.productSpecRules.categoryId, categoryId))
    .orderBy(
      asc(schema.productSpecRules.sortOrder),
      asc(schema.productSpecRules.targetKey)
    );

  const rows = await db
    .select({
      sourceKey: schema.productSpecValues.specKey,
      sourceNormalizedKey: schema.productSpecValues.normalizedKey,
      productCount: sql<number>`count(distinct ${schema.productSpecValues.productId})`,
      valueCount: sql<number>`count(distinct ${schema.productSpecValues.normalizedValue})`,
      sampleValue: sql<string>`min(${schema.productSpecValues.specValue})`,
    })
    .from(schema.productSpecValues)
    .where(
      sql`${schema.productSpecValues.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
    )
    .groupBy(
      schema.productSpecValues.specKey,
      schema.productSpecValues.normalizedKey
    )
    .orderBy(desc(sql`count(distinct ${schema.productSpecValues.productId})`));

  const rulesBySource = new Map(
    rules.map(rule => [rule.sourceNormalizedKey, rule])
  );

  return rows.map(row => {
    const rule = rulesBySource.get(row.sourceNormalizedKey);
    return {
      sourceKey: row.sourceKey,
      sourceNormalizedKey: row.sourceNormalizedKey,
      targetKey: rule?.targetKey ?? row.sourceKey,
      targetNormalizedKey:
        rule?.targetNormalizedKey ??
        normalizeSpecToken(row.sourceKey).slice(0, 120),
      isVisible: rule?.isVisible ?? true,
      isFilterable: rule?.isFilterable ?? true,
      sortOrder: rule?.sortOrder ?? 0,
      productCount: Number(row.productCount || 0),
      valueCount: Number(row.valueCount || 0),
      sampleValue: row.sampleValue || "",
      hasRule: Boolean(rule),
    };
  });
}

export async function upsertCategorySpecRule(input: {
  categoryId: number;
  sourceKey: string;
  sourceNormalizedKey: string;
  targetKey: string;
  isVisible: boolean;
  isFilterable: boolean;
  sortOrder?: number;
}) {
  const db = getDb();
  const targetKey = normalizeSpecKeyForDisplay(input.targetKey).slice(0, 120);
  const targetNormalizedKey = normalizeSpecToken(targetKey).slice(0, 120);

  const [existing] = await db
    .select()
    .from(schema.productSpecRules)
    .where(
      and(
        eq(schema.productSpecRules.categoryId, input.categoryId),
        eq(
          schema.productSpecRules.sourceNormalizedKey,
          input.sourceNormalizedKey
        )
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.productSpecRules)
      .set({
        sourceKey: input.sourceKey.slice(0, 120),
        targetKey,
        targetNormalizedKey,
        isVisible: input.isVisible,
        isFilterable: input.isFilterable,
        sortOrder: input.sortOrder ?? 0,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.productSpecRules.id, existing.id));

    return { success: true, id: existing.id };
  }

  const result = await db.insert(schema.productSpecRules).values({
    categoryId: input.categoryId,
    sourceKey: input.sourceKey.slice(0, 120),
    sourceNormalizedKey: input.sourceNormalizedKey.slice(0, 120),
    targetKey,
    targetNormalizedKey,
    isVisible: input.isVisible,
    isFilterable: input.isFilterable,
    sortOrder: input.sortOrder ?? 0,
  });

  return { success: true, id: result[0].insertId };
}

export async function upsertCategorySpecRulesBulk(input: {
  categoryId: number;
  rules: Array<{
    sourceKey: string;
    sourceNormalizedKey: string;
    targetKey: string;
    isVisible: boolean;
    isFilterable: boolean;
    sortOrder?: number;
  }>;
}) {
  let saved = 0;
  for (const rule of input.rules) {
    await upsertCategorySpecRule({
      categoryId: input.categoryId,
      ...rule,
    });
    saved++;
  }

  return { success: true, saved };
}

export async function applyCategorySpecStandardization(input: {
  categoryId: number;
  limit?: number;
}) {
  const db = getDb();
  const rules = await getRulesByCategory(input.categoryId);
  const limit = input.limit ?? 10000;

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(eq(schema.products.categoryId, input.categoryId))
    .orderBy(desc(schema.products.createdAt))
    .limit(limit);

  let scannedProducts = 0;
  let changedProducts = 0;
  let appliedProducts = 0;
  let skippedProducts = 0;
  let conflictCount = 0;
  let indexedValues = 0;
  const examples: Array<{
    id: number;
    name: string;
    slug: string;
    conflicts: Array<{
      sourceKey: string;
      targetKey: string;
      existingValue: string;
      nextValue: string;
    }>;
  }> = [];

  for (const product of products as ProductRow[]) {
    scannedProducts++;
    if (!isSpecsRecord(product.specs)) continue;

    const preview = buildStandardizedSpecs(product.specs, rules);
    if (!preview.changed) continue;

    changedProducts++;

    if (preview.conflicts.length > 0) {
      skippedProducts++;
      conflictCount += preview.conflicts.length;
      if (examples.length < 20) {
        examples.push({
          id: product.id,
          name: product.name,
          slug: product.slug,
          conflicts: preview.conflicts,
        });
      }
      continue;
    }

    await db
      .update(schema.products)
      .set({ specs: preview.nextSpecs })
      .where(eq(schema.products.id, product.id));

    indexedValues += await rebuildProductSpecIndexForProduct({
      ...product,
      description: "",
      specs: preview.nextSpecs,
    });
    appliedProducts++;
  }

  return {
    scannedProducts,
    changedProducts,
    appliedProducts,
    skippedProducts,
    conflictCount,
    indexedValues,
    examples,
  };
}
