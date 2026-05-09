import { desc, eq, sql } from "drizzle-orm";
import * as schema from "../../db/schema";
import { getDb } from "../queries/connection";
import {
  normalizeSpecToken,
  previewProductNormalization,
  type ProductNormalizationPreview,
} from "./product-normalization";

type ProductRow = Pick<
  typeof schema.products.$inferSelect,
  "id" | "name" | "slug" | "categoryId" | "description" | "specs"
>;

type NormalizationOptions = {
  limit?: number;
  examplesLimit?: number;
  source?: string;
  apply?: boolean;
  skipConflicts?: boolean;
  rebuildIndex?: boolean;
};

type NormalizationExample = {
  id: number;
  name: string;
  slug: string;
  oldDescription: string;
  newDescription: string;
  parsedSpecs: ProductNormalizationPreview["parsedSpecs"];
  mergedSpecs: ProductNormalizationPreview["mergedSpecs"];
  movedSpecCount: number;
  conflicts: ProductNormalizationPreview["conflicts"];
  applied: boolean;
};

function isSpecsRecord(specs: unknown): specs is Record<string, unknown> {
  return Boolean(specs) && typeof specs === "object" && !Array.isArray(specs);
}

function collectKeyCounts(
  keyCounts: Map<string, number>,
  parsedSpecs: Record<string, string>
) {
  for (const key of Object.keys(parsedSpecs)) {
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }
}

export async function rebuildProductSpecIndexForProduct(product: ProductRow) {
  const db = getDb();
  await db
    .delete(schema.productSpecValues)
    .where(eq(schema.productSpecValues.productId, product.id));

  if (!isSpecsRecord(product.specs)) return 0;

  const rows = Object.entries(product.specs)
    .map(([key, value]) => ({
      productId: product.id,
      categoryId: product.categoryId,
      specKey: String(key).trim().slice(0, 120),
      normalizedKey: normalizeSpecToken(key).slice(0, 120),
      specValue: String(value ?? "").trim().slice(0, 512),
      normalizedValue: normalizeSpecToken(value).slice(0, 512),
    }))
    .filter(row => row.specKey && row.normalizedKey && row.specValue && row.normalizedValue);

  if (rows.length > 0) {
    await db.insert(schema.productSpecValues).values(rows);
  }

  return rows.length;
}

export async function rebuildProductSpecIndex(limit = 10000) {
  const db = getDb();
  await db.delete(schema.productSpecValues);

  const rows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .orderBy(desc(schema.products.createdAt))
    .limit(limit);

  let indexedValues = 0;
  for (const product of rows) {
    indexedValues += await rebuildProductSpecIndexForProduct(product);
  }

  return { indexedProducts: rows.length, indexedValues };
}

export async function normalizeProductDescriptions(options: NormalizationOptions = {}) {
  const db = getDb();
  const limit = options.limit ?? 1000;
  const examplesLimit = options.examplesLimit ?? 25;
  const source = options.source ?? "manual";
  const apply = options.apply ?? false;
  const skipConflicts = options.skipConflicts ?? true;
  const rebuildIndex = options.rebuildIndex ?? apply;

  const rows = await db
    .select({
      id: schema.products.id,
      name: schema.products.name,
      slug: schema.products.slug,
      categoryId: schema.products.categoryId,
      description: schema.products.description,
      specs: schema.products.specs,
    })
    .from(schema.products)
    .where(sql`${schema.products.description} IS NOT NULL AND ${schema.products.description} != ''`)
    .orderBy(desc(schema.products.createdAt))
    .limit(limit);

  const keyCounts = new Map<string, number>();
  const examples: NormalizationExample[] = [];
  let changedProducts = 0;
  let appliedProducts = 0;
  let skippedProducts = 0;
  let movedSpecs = 0;
  let conflictCount = 0;
  let indexedValues = 0;

  for (const product of rows) {
    const preview = previewProductNormalization(product.description, product.specs);
    collectKeyCounts(keyCounts, preview.parsedSpecs);

    if (!preview.changed) {
      continue;
    }

    changedProducts++;
    movedSpecs += preview.movedSpecCount;
    conflictCount += preview.conflicts.length;

    const hasConflicts = preview.conflicts.length > 0;
    const shouldApply = apply && (!hasConflicts || !skipConflicts);

    if (shouldApply) {
      await db
        .update(schema.products)
        .set({
          description: preview.newDescription,
          specs: preview.mergedSpecs,
        })
        .where(eq(schema.products.id, product.id));

      await db.insert(schema.productNormalizationLogs).values({
        productId: product.id,
        productName: product.name,
        source,
        status: hasConflicts ? "conflict" : "applied",
        movedSpecCount: preview.movedSpecCount,
        conflictCount: preview.conflicts.length,
        oldDescription: product.description,
        newDescription: preview.newDescription,
        oldSpecs: isSpecsRecord(product.specs) ? product.specs : {},
        newSpecs: preview.mergedSpecs,
        conflicts: preview.conflicts,
      });

      appliedProducts++;

      if (rebuildIndex) {
        indexedValues += await rebuildProductSpecIndexForProduct({
          ...product,
          description: preview.newDescription,
          specs: preview.mergedSpecs,
        });
      }
    } else if (apply) {
      await db.insert(schema.productNormalizationLogs).values({
        productId: product.id,
        productName: product.name,
        source,
        status: "skipped",
        movedSpecCount: preview.movedSpecCount,
        conflictCount: preview.conflicts.length,
        oldDescription: product.description,
        newDescription: preview.newDescription,
        oldSpecs: isSpecsRecord(product.specs) ? product.specs : {},
        newSpecs: preview.mergedSpecs,
        conflicts: preview.conflicts,
      });
      skippedProducts++;
    }

    if (examples.length < examplesLimit) {
      examples.push({
        id: product.id,
        name: product.name,
        slug: product.slug,
        oldDescription: product.description,
        newDescription: preview.newDescription,
        parsedSpecs: preview.parsedSpecs,
        mergedSpecs: preview.mergedSpecs,
        movedSpecCount: preview.movedSpecCount,
        conflicts: preview.conflicts,
        applied: shouldApply,
      });
    }
  }

  return {
    scannedProducts: rows.length,
    changedProducts,
    appliedProducts,
    skippedProducts,
    movedSpecs,
    conflictCount,
    indexedValues,
    topKeys: Array.from(keyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([key, count]) => ({ key, count })),
    examples,
  };
}
