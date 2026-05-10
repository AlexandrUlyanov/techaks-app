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

  const rows = await db
    .select({
      sourceKey: schema.productSpecValues.specKey,
      sourceNormalizedKey: schema.productSpecValues.normalizedKey,
      sourceValue: schema.productSpecValues.specValue,
      sourceNormalizedValue: schema.productSpecValues.normalizedValue,
      productCount: sql<number>`count(distinct ${schema.productSpecValues.productId})`,
    })
    .from(schema.productSpecValues)
    .where(
      sql`${schema.productSpecValues.categoryId} IN (${sql.join(categoryIds, sql`, `)})
        AND ${schema.productSpecValues.normalizedKey} = ${input.sourceNormalizedKey}`
    )
    .groupBy(
      schema.productSpecValues.specKey,
      schema.productSpecValues.normalizedKey,
      schema.productSpecValues.specValue,
      schema.productSpecValues.normalizedValue
    )
    .orderBy(desc(sql`count(distinct ${schema.productSpecValues.productId})`));

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
