import { z } from "zod";
import { desc } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { productNormalizationLogs } from "@db/schema";
import {
  normalizeProductDescriptions,
  rebuildProductSpecIndex,
} from "../lib/product-normalization-service";

export const normalizeRouter = createRouter({
  previewDescriptions: publicQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(50000).default(10000),
          examplesLimit: z.number().min(1).max(100).default(25),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return normalizeProductDescriptions({
        limit: input?.limit ?? 10000,
        examplesLimit: input?.examplesLimit ?? 25,
        apply: false,
      });
    }),

  applyDescriptions: publicQuery
    .input(
      z
        .object({
          limit: z.number().min(1).max(10000).default(1000),
          examplesLimit: z.number().min(1).max(100).default(25),
          skipConflicts: z.boolean().default(true),
          rebuildIndex: z.boolean().default(true),
        })
        .optional()
    )
    .mutation(async ({ input }) => {
      return normalizeProductDescriptions({
        limit: input?.limit ?? 10000,
        examplesLimit: input?.examplesLimit ?? 25,
        source: "manual",
        apply: true,
        skipConflicts: input?.skipConflicts ?? true,
        rebuildIndex: input?.rebuildIndex ?? true,
      });
    }),

  rebuildSpecIndex: publicQuery
    .input(z.object({ limit: z.number().min(1).max(50000).default(10000) }).optional())
    .mutation(async ({ input }) => {
      return rebuildProductSpecIndex(input?.limit ?? 10000);
    }),

  getLogs: publicQuery.query(async () => {
    const db = getDb();
    return db
      .select()
      .from(productNormalizationLogs)
      .orderBy(desc(productNormalizationLogs.createdAt))
      .limit(50);
    }),
});
