import { and, asc, desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import {
  normalizeSpecKeyForDisplay,
  normalizeSpecToken,
} from "./product-normalization";
import { rebuildProductSpecIndexForProduct } from "./product-normalization-service";

type RuleRow = typeof schema.productSpecRules.$inferSelect;
type ValueRuleRow = typeof schema.productSpecValueRules.$inferSelect;
type ProductRow = Pick<
  typeof schema.products.$inferSelect,
  "id" | "name" | "slug" | "categoryId" | "description" | "specs"
>;

type ProductSpecsIndexRow = Pick<
  typeof schema.products.$inferSelect,
  "id" | "categoryId" | "specs"
>;

function isSpecsRecord(specs: unknown): specs is Record<string, unknown> {
  return Boolean(specs) && typeof specs === "object" && !Array.isArray(specs);
}

function aggregateSpecKeyRows(
  products: ProductSpecsIndexRow[],
  options: {
    groupByCategory: boolean;
    normalizedKey?: string;
  }
) {
  const buckets = new Map<
    string,
    {
      categoryId: number;
      sourceKey: string;
      sourceNormalizedKey: string;
      sampleValue: string;
      productIds: Set<number>;
      normalizedValues: Set<string>;
    }
  >();

  for (const product of products) {
    if (!isSpecsRecord(product.specs)) continue;

    for (const [rawKey, rawValue] of Object.entries(product.specs)) {
      const value = String(rawValue ?? "").trim();
      if (!value) continue;

      const sourceKey = normalizeSpecKeyForDisplay(String(rawKey)).slice(0, 120);
      const sourceNormalizedKey = normalizeSpecToken(sourceKey).slice(0, 120);
      if (!sourceKey || !sourceNormalizedKey) continue;
      if (options.normalizedKey && sourceNormalizedKey !== options.normalizedKey) {
        continue;
      }

      const bucketKey = options.groupByCategory
        ? `${product.categoryId}:${sourceNormalizedKey}`
        : sourceNormalizedKey;
      const normalizedValue = normalizeSpecToken(value).slice(0, 512);
      if (!normalizedValue) continue;

      const current = buckets.get(bucketKey) ?? {
        categoryId: product.categoryId,
        sourceKey,
        sourceNormalizedKey,
        sampleValue: value,
        productIds: new Set<number>(),
        normalizedValues: new Set<string>(),
      };
      current.productIds.add(product.id);
      current.normalizedValues.add(normalizedValue);
      if (!current.sampleValue) {
        current.sampleValue = value;
      }
      buckets.set(bucketKey, current);
    }
  }

  return Array.from(buckets.values()).map(bucket => ({
    categoryId: bucket.categoryId,
    sourceKey: bucket.sourceKey,
    sourceNormalizedKey: bucket.sourceNormalizedKey,
    productCount: bucket.productIds.size,
    valueCount: bucket.normalizedValues.size,
    sampleValue: bucket.sampleValue,
  }));
}

function aggregateSpecValueRows(
  products: ProductSpecsIndexRow[],
  sourceNormalizedKey: string
) {
  const buckets = new Map<
    string,
    {
      sourceKey: string;
      sourceNormalizedKey: string;
      sourceValue: string;
      sourceNormalizedValue: string;
      productIds: Set<number>;
    }
  >();

  for (const product of products) {
    if (!isSpecsRecord(product.specs)) continue;

    for (const [rawKey, rawValue] of Object.entries(product.specs)) {
      const sourceKey = normalizeSpecKeyForDisplay(String(rawKey)).slice(0, 120);
      const normalizedKey = normalizeSpecToken(sourceKey).slice(0, 120);
      if (normalizedKey !== sourceNormalizedKey) continue;

      const sourceValue = String(rawValue ?? "").trim().slice(0, 512);
      const sourceNormalizedValue = normalizeSpecToken(sourceValue).slice(0, 512);
      if (!sourceValue || !sourceNormalizedValue) continue;

      const current = buckets.get(sourceNormalizedValue) ?? {
        sourceKey,
        sourceNormalizedKey,
        sourceValue,
        sourceNormalizedValue,
        productIds: new Set<number>(),
      };
      current.productIds.add(product.id);
      buckets.set(sourceNormalizedValue, current);
    }
  }

  return Array.from(buckets.values()).map(bucket => ({
    sourceKey: bucket.sourceKey,
    sourceNormalizedKey: bucket.sourceNormalizedKey,
    sourceValue: bucket.sourceValue,
    sourceNormalizedValue: bucket.sourceNormalizedValue,
    productCount: bucket.productIds.size,
  }));
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

async function getValueRulesByCategory(
  categoryId: number,
  specNormalizedKey: string
) {
  const db = getDb();
  const rules = await db
    .select()
    .from(schema.productSpecValueRules)
    .where(
      and(
        eq(schema.productSpecValueRules.categoryId, categoryId),
        eq(schema.productSpecValueRules.specNormalizedKey, specNormalizedKey)
      )
    )
    .orderBy(
      asc(schema.productSpecValueRules.sortOrder),
      asc(schema.productSpecValueRules.targetValue)
    );

  return new Map(rules.map(rule => [rule.sourceNormalizedValue, rule]));
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

function buildSpecsWithStandardizedValues(
  specs: Record<string, unknown>,
  rules: Map<string, RuleRow>,
  specNormalizedKey: string,
  valueRules: Map<string, ValueRuleRow>
) {
  const nextSpecs: Record<string, string> = {};
  let changed = false;

  for (const [rawKey, rawValue] of Object.entries(specs)) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;

    const displayKey = normalizeSpecKeyForDisplay(String(rawKey));
    const normalizedKey = normalizeSpecToken(displayKey).slice(0, 120);
    const keyRule = rules.get(normalizedKey);
    const targetKey = keyRule?.targetKey || displayKey;

    let nextValue = value;
    if (normalizedKey === specNormalizedKey) {
      const normalizedValue = normalizeSpecToken(value).slice(0, 512);
      const valueRule = valueRules.get(normalizedValue);
      if (valueRule?.targetValue && valueRule.targetValue !== value) {
        nextValue = valueRule.targetValue;
        changed = true;
      }
    }

    if (nextSpecs[targetKey] !== nextValue) {
      if ((targetKey in nextSpecs) && nextSpecs[targetKey] !== nextValue) {
        nextSpecs[targetKey] = nextSpecs[targetKey];
      } else {
        nextSpecs[targetKey] = nextValue;
      }
    }
  }

  return {
    changed,
    nextSpecs,
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

  const products = await db
    .select({
      id: schema.products.id,
      categoryId: schema.products.categoryId,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(
      sql`${schema.products.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
    )
    .orderBy(desc(schema.products.createdAt));

  const rows = aggregateSpecKeyRows(products, { groupByCategory: false }).sort(
    (a, b) => b.productCount - a.productCount || a.sourceKey.localeCompare(b.sourceKey, "ru")
  );

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

export async function getCategorySpecValueStandardization(input: {
  categoryId: number;
  sourceNormalizedKey: string;
}) {
  const db = getDb();
  const allCategories = await db.select().from(schema.categories);
  const categoryIds = getStandardizedCategoryIds(allCategories, input.categoryId);
  const rules = await db
    .select()
    .from(schema.productSpecValueRules)
    .where(
      and(
        eq(schema.productSpecValueRules.categoryId, input.categoryId),
        eq(schema.productSpecValueRules.specNormalizedKey, input.sourceNormalizedKey)
      )
    )
    .orderBy(
      asc(schema.productSpecValueRules.sortOrder),
      asc(schema.productSpecValueRules.targetValue)
    );

  const products = await db
    .select({
      id: schema.products.id,
      categoryId: schema.products.categoryId,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(
      sql`${schema.products.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
    )
    .orderBy(desc(schema.products.createdAt));

  const rows = aggregateSpecValueRows(products, input.sourceNormalizedKey).sort(
    (a, b) => b.productCount - a.productCount || a.sourceValue.localeCompare(b.sourceValue, "ru")
  );

  const rulesBySource = new Map(
    rules.map(rule => [rule.sourceNormalizedValue, rule])
  );

  return rows.map(row => {
    const rule = rulesBySource.get(row.sourceNormalizedValue);
    return {
      sourceKey: row.sourceKey,
      sourceNormalizedKey: row.sourceNormalizedKey,
      sourceValue: row.sourceValue,
      sourceNormalizedValue: row.sourceNormalizedValue,
      targetValue: rule?.targetValue ?? row.sourceValue,
      targetNormalizedValue:
        rule?.targetNormalizedValue ??
        normalizeSpecToken(row.sourceValue).slice(0, 512),
      sortOrder: rule?.sortOrder ?? 0,
      productCount: Number(row.productCount || 0),
      hasRule: Boolean(rule),
    };
  });
}

export async function getSpecStandardizationOverviewRows() {
  const db = getDb();
  const products = await db
    .select({
      id: schema.products.id,
      categoryId: schema.products.categoryId,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .orderBy(desc(schema.products.createdAt));

  return aggregateSpecKeyRows(products, { groupByCategory: true }).sort(
    (a, b) =>
      a.categoryId - b.categoryId ||
      b.productCount - a.productCount ||
      a.sourceKey.localeCompare(b.sourceKey, "ru")
  );
}

export async function bulkManageSpecOverview(input: {
  items: Array<{
    categoryId: number;
    sourceKey: string;
    sourceNormalizedKey: string;
  }>;
  action: "hide" | "exclude_from_filters" | "delete";
}) {
  const db = getDb();
  const uniqueItems = Array.from(
    new Map(
      input.items.map(item => [
        `${item.categoryId}:${item.sourceNormalizedKey}`,
        {
          categoryId: item.categoryId,
          sourceKey: normalizeSpecKeyForDisplay(item.sourceKey).slice(0, 120),
          sourceNormalizedKey: item.sourceNormalizedKey.slice(0, 120),
        },
      ])
    ).values()
  );

  if (uniqueItems.length === 0) {
    return {
      success: true,
      action: input.action,
      affectedRules: 0,
      affectedProducts: 0,
      affectedValues: 0,
    };
  }

  if (input.action === "hide" || input.action === "exclude_from_filters") {
    const categoryIds = Array.from(new Set(uniqueItems.map(item => item.categoryId)));
    const existingRules = await db
      .select()
      .from(schema.productSpecRules)
      .where(sql`${schema.productSpecRules.categoryId} IN (${sql.join(categoryIds, sql`, `)})`);

    const existingMap = new Map(
      existingRules.map(rule => [`${rule.categoryId}:${rule.sourceNormalizedKey}`, rule])
    );

    let affectedRules = 0;
    for (const item of uniqueItems) {
      const existing = existingMap.get(`${item.categoryId}:${item.sourceNormalizedKey}`);
      const targetKey = existing?.targetKey || item.sourceKey;
      await upsertCategorySpecRule({
        categoryId: item.categoryId,
        sourceKey: item.sourceKey,
        sourceNormalizedKey: item.sourceNormalizedKey,
        targetKey,
        isVisible: input.action === "hide" ? false : (existing?.isVisible ?? true),
        isFilterable:
          input.action === "exclude_from_filters"
            ? false
            : (existing?.isFilterable ?? true),
        sortOrder: existing?.sortOrder ?? 0,
      });
      affectedRules++;
    }

    return {
      success: true,
      action: input.action,
      affectedRules,
      affectedProducts: 0,
      affectedValues: 0,
    };
  }

  const byCategory = new Map<number, Set<string>>();
  for (const item of uniqueItems) {
    const bucket = byCategory.get(item.categoryId) ?? new Set<string>();
    bucket.add(item.sourceNormalizedKey);
    byCategory.set(item.categoryId, bucket);
  }

  const categoryIds = Array.from(byCategory.keys());
  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(sql`${schema.products.categoryId} IN (${sql.join(categoryIds, sql`, `)})`);

  let affectedProducts = 0;
  let affectedValues = 0;

  for (const product of products as ProductRow[]) {
    if (!isSpecsRecord(product.specs)) continue;
    const keysToDelete = byCategory.get(product.categoryId);
    if (!keysToDelete || keysToDelete.size === 0) continue;

    const nextSpecs: Record<string, unknown> = {};
    let changed = false;

    for (const [rawKey, rawValue] of Object.entries(product.specs)) {
      const normalizedKey = normalizeSpecToken(
        normalizeSpecKeyForDisplay(String(rawKey))
      ).slice(0, 120);
      if (keysToDelete.has(normalizedKey)) {
        changed = true;
        affectedValues++;
        continue;
      }
      nextSpecs[rawKey] = rawValue;
    }

    if (!changed) continue;

    await db
      .update(schema.products)
      .set({ specs: nextSpecs })
      .where(eq(schema.products.id, product.id));
    await rebuildProductSpecIndexForProduct({
      ...product,
      specs: nextSpecs,
    });
    affectedProducts++;
  }

  for (const item of uniqueItems) {
    await db
      .delete(schema.productSpecRules)
      .where(
        and(
          eq(schema.productSpecRules.categoryId, item.categoryId),
          eq(schema.productSpecRules.sourceNormalizedKey, item.sourceNormalizedKey)
        )
      );
    await db
      .delete(schema.productSpecValueRules)
      .where(
        and(
          eq(schema.productSpecValueRules.categoryId, item.categoryId),
          eq(schema.productSpecValueRules.specNormalizedKey, item.sourceNormalizedKey)
        )
      );
  }

  return {
    success: true,
    action: input.action,
    affectedRules: uniqueItems.length,
    affectedProducts,
    affectedValues,
  };
}

export async function upsertCategorySpecValueRule(input: {
  categoryId: number;
  specNormalizedKey: string;
  sourceValue: string;
  sourceNormalizedValue: string;
  targetValue: string;
  sortOrder?: number;
}) {
  const db = getDb();
  const targetValue = String(input.targetValue ?? "").trim().slice(0, 512);
  const targetNormalizedValue = normalizeSpecToken(targetValue).slice(0, 512);

  const [existing] = await db
    .select()
    .from(schema.productSpecValueRules)
    .where(
      and(
        eq(schema.productSpecValueRules.categoryId, input.categoryId),
        eq(schema.productSpecValueRules.specNormalizedKey, input.specNormalizedKey),
        eq(
          schema.productSpecValueRules.sourceNormalizedValue,
          input.sourceNormalizedValue
        )
      )
    )
    .limit(1);

  if (existing) {
    await db
      .update(schema.productSpecValueRules)
      .set({
        sourceValue: input.sourceValue.slice(0, 512),
        targetValue,
        targetNormalizedValue,
        sortOrder: input.sortOrder ?? 0,
        updatedAt: sql`now()`,
      })
      .where(eq(schema.productSpecValueRules.id, existing.id));

    return { success: true, id: existing.id };
  }

  const result = await db.insert(schema.productSpecValueRules).values({
    categoryId: input.categoryId,
    specNormalizedKey: input.specNormalizedKey.slice(0, 120),
    sourceValue: input.sourceValue.slice(0, 512),
    sourceNormalizedValue: input.sourceNormalizedValue.slice(0, 512),
    targetValue,
    targetNormalizedValue,
    sortOrder: input.sortOrder ?? 0,
  });

  return { success: true, id: result[0].insertId };
}

export async function upsertCategorySpecValueRulesBulk(input: {
  categoryId: number;
  specNormalizedKey: string;
  rules: Array<{
    sourceValue: string;
    sourceNormalizedValue: string;
    targetValue: string;
    sortOrder?: number;
  }>;
}) {
  let saved = 0;
  for (const rule of input.rules) {
    await upsertCategorySpecValueRule({
      categoryId: input.categoryId,
      specNormalizedKey: input.specNormalizedKey,
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
  const allCategories = await db.select().from(schema.categories);
  const categoryIds = getStandardizedCategoryIds(allCategories, input.categoryId);

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(
      sql`${schema.products.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
    )
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

export async function applyCategorySpecValueStandardization(input: {
  categoryId: number;
  sourceNormalizedKey: string;
  limit?: number;
}) {
  const db = getDb();
  const keyRules = await getRulesByCategory(input.categoryId);
  const valueRules = await getValueRulesByCategory(
    input.categoryId,
    input.sourceNormalizedKey
  );
  const limit = input.limit ?? 10000;
  const allCategories = await db.select().from(schema.categories);
  const categoryIds = getStandardizedCategoryIds(allCategories, input.categoryId);

  const products = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(
      sql`${schema.products.categoryId} IN (${sql.join(categoryIds, sql`, `)})`
    )
    .orderBy(desc(schema.products.createdAt))
    .limit(limit);

  let scannedProducts = 0;
  let changedProducts = 0;
  let appliedProducts = 0;
  let indexedValues = 0;

  for (const product of products as ProductRow[]) {
    scannedProducts++;
    if (!isSpecsRecord(product.specs)) continue;

    const preview = buildSpecsWithStandardizedValues(
      product.specs,
      keyRules,
      input.sourceNormalizedKey,
      valueRules
    );

    if (!preview.changed) continue;

    changedProducts++;

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
    indexedValues,
  };
}
