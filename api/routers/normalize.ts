import { z } from "zod";
import { desc, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { products } from "@db/schema";
import { previewProductNormalization } from "../lib/product-normalization";

export const normalizeRouter = createRouter({
  previewDescriptions: publicQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(1000).default(200),
          examplesLimit: z.number().min(1).max(100).default(25),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const db = getDb();
      const limit = input?.limit ?? 200;
      const examplesLimit = input?.examplesLimit ?? 25;

      const rows = await db
        .select({
          id: products.id,
          name: products.name,
          slug: products.slug,
          description: products.description,
          specs: products.specs,
        })
        .from(products)
        .where(sql`${products.description} IS NOT NULL AND ${products.description} != ''`)
        .orderBy(desc(products.createdAt))
        .limit(limit);

      const keyCounts = new Map<string, number>();
      const examples = [];
      let changedProducts = 0;
      let movedSpecs = 0;
      let conflictCount = 0;

      for (const product of rows) {
        const preview = previewProductNormalization(product.description, product.specs);

        if (preview.changed) {
          changedProducts++;
        }
        movedSpecs += preview.movedSpecCount;
        conflictCount += preview.conflicts.length;

        for (const key of Object.keys(preview.parsedSpecs)) {
          keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
        }

        if (preview.changed && examples.length < examplesLimit) {
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
          });
        }
      }

      return {
        scannedProducts: rows.length,
        changedProducts,
        movedSpecs,
        conflictCount,
        topKeys: Array.from(keyCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([key, count]) => ({ key, count })),
        examples,
      };
    }),
});
